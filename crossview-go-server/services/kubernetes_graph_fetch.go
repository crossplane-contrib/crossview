package services

import (
	"fmt"
	"sort"
	"strings"
	"sync"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

const (
	GraphWarningKindUnavailable = "xr-kind-unavailable"
	GraphWarningManagedFailed   = "managed-unavailable"
	GraphWarningManagedCached   = "managed-cached"
	GraphWarningManagedCapped   = "managed-capped"
	GraphWarningManagedSkipped  = "managed-skipped"
)

// graphListConcurrency caps the XR kind lists in flight, so many XRDs do not flood the API server.
const graphListConcurrency = 8

// GraphOptions tunes what GetGraph fetches; the zero value fetches everything.
type GraphOptions struct {
	SkipManaged bool
}

// GetGraph lists XRDs, Compositions and Functions, then every XR kind and the managed resources.
// Anything it could not list or only partly listed becomes a warning on the graph.
func GetGraph(svc KubernetesServiceInterface, contextName string, opts GraphOptions) (Graph, error) {
	lister := graphLister{svc: svc, contextName: contextName}

	var in GraphInput
	var err error
	if in.XRDs, err = lister.list("apiextensions.crossplane.io/v1", "CompositeResourceDefinition", ""); err != nil {
		return Graph{}, fmt.Errorf("failed to list XRDs: %w", err)
	}
	if in.Compositions, err = lister.list("apiextensions.crossplane.io/v1", "Composition", ""); err != nil {
		return Graph{}, fmt.Errorf("failed to list compositions: %w", err)
	}
	if in.Functions, err = lister.list("pkg.crossplane.io/v1", "Function", ""); err != nil {
		return Graph{}, fmt.Errorf("failed to list functions: %w", err)
	}

	var warnings []GraphWarning
	in.XRs, warnings = lister.listXRs(in.XRDs)

	if opts.SkipManaged {
		warnings = append(warnings, GraphWarning{
			Code:    GraphWarningManagedSkipped,
			Message: "Composed Resource health was not loaded.",
		})
	} else {
		managedItems, managedWarnings := lister.listManaged()
		in.Managed = managedItems
		warnings = append(warnings, managedWarnings...)
	}

	graph := BuildGraph(in)
	graph.Warnings = sortedWarnings(warnings)
	return graph, nil
}

// sortedWarnings returns the warnings in a fixed order, because they are collected in parallel.
func sortedWarnings(warnings []GraphWarning) []GraphWarning {
	sort.Slice(warnings, func(i, j int) bool {
		if warnings[i].Code != warnings[j].Code {
			return warnings[i].Code < warnings[j].Code
		}
		return warnings[i].Message < warnings[j].Message
	})
	if warnings == nil {
		return []GraphWarning{}
	}
	return warnings
}

type graphLister struct {
	svc         KubernetesServiceInterface
	contextName string
}

// list returns the items of a kind from every namespace in one call.
func (l graphLister) list(apiVersion, kind, plural string) ([]map[string]interface{}, error) {
	result, err := l.svc.GetResources(apiVersion, kind, "", l.contextName, plural, nil, "")
	if err != nil {
		return nil, err
	}
	return graphItems(result), nil
}

// listManaged lists the managed resources that give composed nodes their health.
// Failing is not fatal, since composed nodes still show without it.
func (l graphLister) listManaged() ([]map[string]interface{}, []GraphWarning) {
	result, err := l.svc.GetManagedResources(l.contextName, false)
	if err != nil {
		return nil, []GraphWarning{{
			Code:    GraphWarningManagedFailed,
			Message: fmt.Sprintf("Composed Resource health is unknown because the managed resource list failed: %v.", err),
		}}
	}

	items := graphItems(result)
	var warnings []GraphWarning
	if cached, _ := result["fromCache"].(bool); cached {
		warnings = append(warnings, GraphWarning{
			Code:    GraphWarningManagedCached,
			Message: "Composed Resource health comes from a cache and may be a few minutes old.",
		})
	}
	maxItems := l.svc.ManagedMaxItemsPerType()
	if kinds := kindsAtItemCap(items, maxItems); len(kinds) > 0 {
		warnings = append(warnings, GraphWarning{
			Code: GraphWarningManagedCapped,
			Message: fmt.Sprintf("These kinds hit the %d item limit, so some of their Composed Resources have no health: %s.",
				maxItems, joinSorted(kinds)),
		})
	}
	return items, warnings
}

// kindsAtItemCap returns the kinds that have as many managed resources as the per-kind cap allows.
func kindsAtItemCap(items []map[string]interface{}, maxItems int64) []string {
	perKind := map[string]int{}
	for _, item := range items {
		perKind[graphString(item, "kind")]++
	}
	var capped []string
	for kind, count := range perKind {
		if int64(count) >= maxItems {
			capped = append(capped, kind)
		}
	}
	return capped
}

// joinSorted joins values in alphabetical order, for stable messages.
func joinSorted(values []string) string {
	sort.Strings(values)
	return strings.Join(values, ", ")
}

// listXRs lists the instances of every kind the XRDs define, one call per kind, a few at a time.
// A kind that fails to list is reported as a warning, so one broken CRD does not hide the rest.
func (l graphLister) listXRs(xrds []map[string]interface{}) ([]map[string]interface{}, []GraphWarning) {
	var (
		mu       sync.Mutex
		wg       sync.WaitGroup
		xrs      []map[string]interface{}
		warnings []GraphWarning
		slots    = make(chan struct{}, graphListConcurrency)
	)
	for _, xrd := range xrds {
		kind, ok := newXRKind(xrd)
		if !ok {
			continue
		}
		wg.Add(1)
		slots <- struct{}{}
		go func() {
			defer wg.Done()
			defer func() { <-slots }()
			items, err := l.listKind(kind)
			mu.Lock()
			defer mu.Unlock()
			if err != nil {
				warnings = append(warnings, GraphWarning{
					Code:    GraphWarningKindUnavailable,
					Message: fmt.Sprintf("Could not list %s: %v. Its Composite Resources are not in this graph.", kind.kind, err),
				})
				return
			}
			xrs = append(xrs, items...)
		}()
	}
	wg.Wait()
	return xrs, warnings
}

// xrKind is a kind an XRD defines, with what is needed to list its instances.
type xrKind struct {
	apiVersion, kind, plural string
}

// newXRKind reads the kind an XRD defines, returning false when the XRD does not name one.
func newXRKind(xrd map[string]interface{}) (xrKind, bool) {
	group := graphString(xrd, "spec", "group")
	version := graphXRDVersion(xrd)
	k := xrKind{
		apiVersion: group + "/" + version,
		kind:       graphString(xrd, "spec", "names", "kind"),
		plural:     graphString(xrd, "spec", "names", "plural"),
	}
	return k, group != "" && version != "" && k.kind != "" && k.plural != ""
}

// listKind lists instances of a kind and stamps each with what a list result leaves out.
func (l graphLister) listKind(k xrKind) ([]map[string]interface{}, error) {
	items, err := l.list(k.apiVersion, k.kind, k.plural)
	if err != nil {
		return nil, err
	}
	for _, item := range items {
		item["apiVersion"] = k.apiVersion
		item["kind"] = k.kind
		item["plural"] = k.plural
	}
	return items, nil
}

// graphXRDVersion picks the served, referenceable version, else the first one.
func graphXRDVersion(xrd map[string]interface{}) string {
	versions := graphSlice(xrd, "spec", "versions")
	for _, v := range versions {
		version, _ := v.(map[string]interface{})
		referenceable, _, _ := unstructured.NestedBool(version, "referenceable")
		served, found, _ := unstructured.NestedBool(version, "served")
		if referenceable && (served || !found) {
			return graphString(version, "name")
		}
	}
	if len(versions) > 0 {
		first, _ := versions[0].(map[string]interface{})
		return graphString(first, "name")
	}
	return ""
}
