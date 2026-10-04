package services

import (
	"context"
	"fmt"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"crossview-go-server/lib"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/client-go/dynamic"
)

type ManagedResourcesOptions struct {
	Limit    int
	Continue string
	Kind     string
	Search   string
}

type managedResourceTarget struct {
	apiVersion string
	kind       string
	plural     string
}

func buildManagedResourceTargetsFromMRDs(mrdList []map[string]interface{}) []managedResourceTarget {
	resourceTargets := make([]managedResourceTarget, 0, len(mrdList)+6)

	for _, mrd := range mrdList {
		spec, _ := mrd["spec"].(map[string]interface{})
		if spec == nil {
			continue
		}

		group, _ := spec["group"].(string)
		if group == "" {
			continue
		}

		versions, _ := spec["versions"].([]interface{})
		var version string
		if len(versions) > 0 {
			if v, ok := versions[0].(map[string]interface{}); ok {
				version, _ = v["name"].(string)
			}
		}
		if version == "" {
			if v, ok := spec["version"].(string); ok {
				version = v
			}
		}
		if version == "" {
			version = "v1"
		}

		names, _ := spec["names"].(map[string]interface{})
		plural, _ := names["plural"].(string)
		kind, _ := names["kind"].(string)
		if plural == "" || kind == "" {
			continue
		}

		resourceTargets = append(resourceTargets, managedResourceTarget{
			apiVersion: fmt.Sprintf("%s/%s", group, version),
			kind:       kind,
			plural:     plural,
		})
	}

	return resourceTargets
}

func appendOptionalManagedResourceTargets(resourceTargets []managedResourceTarget) []managedResourceTarget {
	return append(resourceTargets,
		managedResourceTarget{apiVersion: "pkg.crossplane.io/v1", kind: "ManagedResourceDefinition", plural: "managedresourcedefinitions"},
		managedResourceTarget{apiVersion: "pkg.crossplane.io/v1beta1", kind: "ManagedResourceDefinition", plural: "managedresourcedefinitions"},
		managedResourceTarget{apiVersion: "pkg.crossplane.io/v1alpha1", kind: "ManagedResourceDefinition", plural: "managedresourcedefinitions"},
		managedResourceTarget{apiVersion: "pkg.crossplane.io/v1", kind: "ManagedResourceActivationPolicy", plural: "managedresourceactivationpolicies"},
		managedResourceTarget{apiVersion: "pkg.crossplane.io/v1beta1", kind: "ManagedResourceActivationPolicy", plural: "managedresourceactivationpolicies"},
		managedResourceTarget{apiVersion: "pkg.crossplane.io/v1alpha1", kind: "ManagedResourceActivationPolicy", plural: "managedresourceactivationpolicies"},
	)
}

func dedupeManagedResources(items []interface{}) []interface{} {
	allResources := make([]interface{}, 0, len(items))
	seenUIDs := make(map[string]struct{}, len(items))
	seenFallbackKeys := make(map[string]struct{}, len(items))

	for _, item := range items {
		itemMap, ok := item.(map[string]interface{})
		if !ok {
			continue
		}

		metadata, _ := itemMap["metadata"].(map[string]interface{})
		if metadata == nil {
			continue
		}

		uid, _ := metadata["uid"].(string)
		if uid != "" {
			if _, seen := seenUIDs[uid]; seen {
				continue
			}
			seenUIDs[uid] = struct{}{}
		} else {
			// Use name/namespace as fallback key when no UID
			name, _ := metadata["name"].(string)
			namespace, _ := metadata["namespace"].(string)
			fallbackKey := fmt.Sprintf("%s/%s", namespace, name)
			if _, seen := seenFallbackKeys[fallbackKey]; seen {
				continue
			}
			seenFallbackKeys[fallbackKey] = struct{}{}
		}

		allResources = append(allResources, itemMap)
	}

	return allResources
}

func (k *KubernetesService) fetchManagedResourceTarget(contextName string, target managedResourceTarget) ([]interface{}, error) {
	allItems := make([]interface{}, 0)
	continueToken := ""
	pageSize := k.managedPageSize
	if pageSize <= 0 {
		pageSize = lib.DefaultManagedPageSize
	}
	maxItems := k.managedMaxItemsPerType
	if maxItems <= 0 {
		maxItems = lib.DefaultManagedMaxItemsPerType
	}
	itemCount := int64(0)

	for {
		if itemCount >= maxItems {
			break
		}

		result, err := k.GetResources(target.apiVersion, target.kind, "", contextName, target.plural, &pageSize, continueToken)
		if err != nil {
			return nil, err
		}

		items, _ := result["items"].([]interface{})
		if items != nil {
			for _, item := range items {
				if itemMap, ok := item.(map[string]interface{}); ok {
					itemMap["apiVersion"] = target.apiVersion
					itemMap["kind"] = target.kind
					allItems = append(allItems, itemMap)
					itemCount++
					if itemCount >= maxItems {
						break
					}
				}
			}
		}

		nextToken, _ := result["continueToken"].(string)
		if nextToken == "" {
			break
		}
		continueToken = nextToken
	}

	return allItems, nil
}

func (k *KubernetesService) GetManagedResources(contextName string, forceRefresh bool) (map[string]interface{}, error) {
	return k.GetManagedResourcesPaged(contextName, forceRefresh, nil)
}

func (k *KubernetesService) GetManagedResourcesPaged(contextName string, forceRefresh bool, opts *ManagedResourcesOptions) (map[string]interface{}, error) {
	if contextName != "" {
		if err := k.SetContext(contextName); err != nil {
			return nil, fmt.Errorf("failed to set context: %w", err)
		}
	} else {
		currentContext := k.GetCurrentContext()
		if currentContext == "" {
			if err := k.SetContext(""); err != nil {
				return nil, fmt.Errorf("failed to initialize kubernetes context: %w", err)
			}
		}
		contextName = k.GetCurrentContext()
	}

	if !forceRefresh {
		k.mu.RLock()
		cachedResult, exists := k.managedResourcesCache[contextName]
		cacheTime, timeExists := k.managedResourcesCacheTime[contextName]
		ttl := k.managedResourcesCacheTTL
		if ttl <= 0 {
			ttl = time.Duration(lib.DefaultManagedCacheTTLSeconds) * time.Second
		}
		fresh := exists && timeExists && time.Since(cacheTime) < ttl
		var cachedItems []interface{}
		var haveItems bool
		if fresh {
			cachedItems, haveItems = cachedResult["items"].([]interface{})
		}
		k.mu.RUnlock()
		if fresh && haveItems {
			k.logger.Infof("Returning cached managed resources for context: %s", contextName)
			return paginateManagedResourcesResult(cachedItems, true, opts), nil
		}
	}

	k.logger.Infof("Fetching fresh managed resources for context: %s (forceRefresh: %t)", contextName, forceRefresh)

	config, err := k.GetConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	var providers, revisions []interface{}
	var provErr, revErr error
	var provWg sync.WaitGroup
	provWg.Add(2)

	go func() {
		defer provWg.Done()
		providersResult, err := k.GetResources("pkg.crossplane.io/v1", "Provider", "", contextName, "", nil, "")
		if err != nil {
			provErr = err
			return
		}
		providers, _ = providersResult["items"].([]interface{})
	}()

	go func() {
		defer provWg.Done()
		revisionsResult, err := k.GetResources("pkg.crossplane.io/v1", "ProviderRevision", "", contextName, "", nil, "")
		if err != nil {
			revErr = err
			return
		}
		revisions, _ = revisionsResult["items"].([]interface{})
	}()

	provWg.Wait()
	if provErr != nil {
		return nil, fmt.Errorf("failed to get providers: %w", provErr)
	}
	if revErr != nil {
		return nil, fmt.Errorf("failed to get provider revisions: %w", revErr)
	}
	if providers == nil {
		providers = []interface{}{}
	}
	if revisions == nil {
		revisions = []interface{}{}
	}

	providerNameMap := make(map[string]bool)
	for _, prov := range providers {
		provMap, _ := prov.(map[string]interface{})
		if provMap == nil {
			continue
		}
		provMetadata, _ := provMap["metadata"].(map[string]interface{})
		if provMetadata == nil {
			continue
		}
		provName, _ := provMetadata["name"].(string)
		if provName != "" {
			providerNameMap[provName] = true
		}
	}

	revisionToProvider := make(map[string]string)
	for _, rev := range revisions {
		revMap, _ := rev.(map[string]interface{})
		if revMap == nil {
			continue
		}
		metadata, _ := revMap["metadata"].(map[string]interface{})
		if metadata == nil {
			continue
		}
		revName, _ := metadata["name"].(string)
		ownerRefs, _ := metadata["ownerReferences"].([]interface{})
		for _, ownerRef := range ownerRefs {
			owner, _ := ownerRef.(map[string]interface{})
			if owner == nil {
				continue
			}
			ownerKind, _ := owner["kind"].(string)
			ownerAPIVersion, _ := owner["apiVersion"].(string)
			ownerName, _ := owner["name"].(string)
			if ownerKind == "Provider" && ownerAPIVersion == "pkg.crossplane.io/v1" && providerNameMap[ownerName] {
				revisionToProvider[revName] = ownerName
				break
			}
		}
	}

	crdGVR := schema.GroupVersionResource{
		Group:    "apiextensions.k8s.io",
		Version:  "v1",
		Resource: "customresourcedefinitions",
	}
	crdList, err := dynamicClient.Resource(crdGVR).List(context.Background(), metav1.ListOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to list CRDs: %w", err)
	}

	providerCRDs := make(map[string][]map[string]interface{})
	for _, crdItem := range crdList.Items {
		crd := crdItem.UnstructuredContent()
		metadata, _ := crd["metadata"].(map[string]interface{})
		if metadata == nil {
			continue
		}
		ownerRefs, _ := metadata["ownerReferences"].([]interface{})
		for _, ownerRef := range ownerRefs {
			owner, _ := ownerRef.(map[string]interface{})
			if owner == nil {
				continue
			}
			ownerKind, _ := owner["kind"].(string)
			ownerAPIVersion, _ := owner["apiVersion"].(string)
			ownerName, _ := owner["name"].(string)

			var providerName string
			if ownerKind == "Provider" && ownerAPIVersion == "pkg.crossplane.io/v1" && providerNameMap[ownerName] {
				providerName = ownerName
			} else if ownerKind == "ProviderRevision" && ownerAPIVersion == "pkg.crossplane.io/v1" {
				providerName = revisionToProvider[ownerName]
			}

			if providerName != "" {
				if providerCRDs[providerName] == nil {
					providerCRDs[providerName] = []map[string]interface{}{}
				}
				providerCRDs[providerName] = append(providerCRDs[providerName], crd)
				break
			}
		}
	}

	mrdList := make([]map[string]interface{}, 0)
	for _, crds := range providerCRDs {
		for _, crd := range crds {
			spec, _ := crd["spec"].(map[string]interface{})
			if spec == nil {
				continue
			}
			names, _ := spec["names"].(map[string]interface{})
			if names == nil {
				continue
			}
			kind, _ := names["kind"].(string)
			if kind == "ProviderConfig" || kind == "ProviderConfigUsage" {
				continue
			}
			mrdList = append(mrdList, crd)
		}
	}

	type resourceResult struct {
		items []interface{}
		err   error
	}

	resourceTargets := appendOptionalManagedResourceTargets(buildManagedResourceTargetsFromMRDs(mrdList))

	maxConcurrency := k.managedMaxConcurrency
	if maxConcurrency <= 0 {
		maxConcurrency = lib.DefaultManagedMaxConcurrency
	}
	semaphore := make(chan struct{}, maxConcurrency)
	resourceChan := make(chan resourceResult, len(resourceTargets))
	var wg sync.WaitGroup

	for _, target := range resourceTargets {
		wg.Add(1)
		go func(target managedResourceTarget) {
			defer wg.Done()
			semaphore <- struct{}{}
			defer func() { <-semaphore }()
			items, err := k.fetchManagedResourceTarget(contextName, target)
			if err != nil {
				if !lib.IsMissingKubernetesResourceError(err) {
					resourceChan <- resourceResult{items: nil, err: err}
				}
				return
			}
			if items != nil && len(items) > 0 {
				resourceChan <- resourceResult{items: items, err: nil}
			}
		}(target)
	}

	go func() {
		wg.Wait()
		close(resourceChan)
	}()

	allResources := make([]interface{}, 0)
	for result := range resourceChan {
		if result.err == nil && result.items != nil {
			allResources = append(allResources, result.items...)
		}
	}
	allResources = dedupeManagedResources(allResources)
	sortManagedResources(allResources)

	result := paginateManagedResourcesResult(allResources, false, nil)

	k.mu.Lock()
	k.managedResourcesCache[contextName] = map[string]interface{}{
		"items":     allResources,
		"fromCache": false,
	}
	k.managedResourcesCacheTime[contextName] = time.Now()
	k.mu.Unlock()

	k.logger.Infof("Cached managed resources for context: %s (%d items)", contextName, len(allResources))

	if opts == nil || (opts.Limit <= 0 && opts.Kind == "" && opts.Search == "") {
		return result, nil
	}
	return paginateManagedResourcesResult(allResources, false, opts), nil
}

func sortManagedResources(items []interface{}) {
	sort.SliceStable(items, func(i, j int) bool {
		mi, _ := items[i].(map[string]interface{})
		mj, _ := items[j].(map[string]interface{})
		if mi == nil || mj == nil {
			return false
		}
		ki, _ := mi["kind"].(string)
		kj, _ := mj["kind"].(string)
		if ki != kj {
			return ki < kj
		}
		mdi, _ := mi["metadata"].(map[string]interface{})
		mdj, _ := mj["metadata"].(map[string]interface{})
		var nsi, nsj, ni, nj string
		if mdi != nil {
			nsi, _ = mdi["namespace"].(string)
			ni, _ = mdi["name"].(string)
		}
		if mdj != nil {
			nsj, _ = mdj["namespace"].(string)
			nj, _ = mdj["name"].(string)
		}
		if nsi != nsj {
			return nsi < nsj
		}
		return ni < nj
	})
}

func filterManagedResources(items []interface{}, kind, search string) []interface{} {
	if kind == "" && search == "" {
		return items
	}
	lowerSearch := strings.ToLower(strings.TrimSpace(search))
	filtered := make([]interface{}, 0, len(items))
	for _, item := range items {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		if kind != "" {
			if k, _ := m["kind"].(string); k != kind {
				continue
			}
		}
		if lowerSearch != "" {
			md, _ := m["metadata"].(map[string]interface{})
			ns, name := "", ""
			if md != nil {
				ns, _ = md["namespace"].(string)
				name, _ = md["name"].(string)
			}
			hay := strings.ToLower(ns + "/" + name)
			if !strings.Contains(hay, lowerSearch) {
				continue
			}
		}
		filtered = append(filtered, item)
	}
	return filtered
}

func paginateManagedResourcesResult(allItems []interface{}, fromCache bool, opts *ManagedResourcesOptions) map[string]interface{} {
	filtered := allItems
	var limit int
	var offset int
	if opts != nil {
		filtered = filterManagedResources(allItems, opts.Kind, opts.Search)
		limit = opts.Limit
		if opts.Continue != "" {
			if v, err := strconv.Atoi(opts.Continue); err == nil && v > 0 {
				offset = v
			}
		}
	}
	totalCount := len(filtered)
	if limit <= 0 {
		return map[string]interface{}{
			"items":        filtered,
			"fromCache":    fromCache,
			"totalCount":   totalCount,
			"continueToken": nil,
		}
	}
	if offset < 0 {
		offset = 0
	}
	if offset > totalCount {
		offset = totalCount
	}
	end := offset + limit
	if end > totalCount {
		end = totalCount
	}
	page := filtered[offset:end]
	var nextToken interface{}
	if end < totalCount {
		nextToken = strconv.Itoa(end)
	}
	return map[string]interface{}{
		"items":         page,
		"fromCache":     fromCache,
		"totalCount":    totalCount,
		"continueToken": nextToken,
	}
}
