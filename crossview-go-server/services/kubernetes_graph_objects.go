package services

import (
	"fmt"
	"strings"

	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
)

// xrdNodeID returns the graph node ID for an XRD.
func xrdNodeID(name string) string { return "xrd/" + name }

// compositionNodeID returns the graph node ID for a Composition.
func compositionNodeID(name string) string { return "composition/" + name }

// functionNodeID returns the graph node ID for a Function.
func functionNodeID(name string) string { return "function/" + name }

// graphResourceID leaves the version out, so refs and list results that use different versions still match.
func graphResourceID(group, kind, namespace, name string) string {
	return fmt.Sprintf("%s/%s/%s/%s", group, kind, namespace, name)
}

// graphObjectID returns the node ID for an object, from its group, kind, namespace and name.
func graphObjectID(obj map[string]interface{}) string {
	return graphResourceID(
		graphGroup(graphString(obj, "apiVersion")),
		graphString(obj, "kind"),
		graphString(obj, "metadata", "namespace"),
		graphString(obj, "metadata", "name"),
	)
}

// graphKindKey joins a group and a kind, for example "platform.example.org/IdentityClient".
func graphKindKey(group, kind string) string {
	return group + "/" + kind
}

// graphGroup returns the group part of an apiVersion, or "" for the core group.
func graphGroup(apiVersion string) string {
	if i := strings.Index(apiVersion, "/"); i >= 0 {
		return apiVersion[:i]
	}
	return ""
}

// graphString reads a nested string, returning "" when it is missing or not a string.
func graphString(obj map[string]interface{}, fields ...string) string {
	s, _, _ := unstructured.NestedString(obj, fields...)
	return s
}

// graphSlice reads a nested list, returning nil when it is missing or not a list.
func graphSlice(obj map[string]interface{}, fields ...string) []interface{} {
	s, _, _ := unstructured.NestedSlice(obj, fields...)
	return s
}

// graphCondition returns the status of the named condition, or "" when the object has none.
func graphCondition(obj map[string]interface{}, condType string) string {
	for _, c := range graphSlice(obj, "status", "conditions") {
		cond, ok := c.(map[string]interface{})
		if ok && graphString(cond, "type") == condType {
			return graphString(cond, "status")
		}
	}
	return ""
}

// graphReadiness returns the Ready and Synced condition statuses.
func graphReadiness(obj map[string]interface{}) (ready, synced string) {
	return graphCondition(obj, "Ready"), graphCondition(obj, "Synced")
}

// graphRefs prefers the Crossplane v2 location and falls back to v1.
func graphRefs(xr map[string]interface{}) []interface{} {
	if refs, found, _ := unstructured.NestedSlice(xr, "spec", "crossplane", "resourceRefs"); found {
		return refs
	}
	return graphSlice(xr, "spec", "resourceRefs")
}

// graphCompositionName returns the name of the Composition an XR uses, preferring the v2 location.
func graphCompositionName(xr map[string]interface{}) string {
	if name := graphString(xr, "spec", "crossplane", "compositionRef", "name"); name != "" {
		return name
	}
	return graphString(xr, "spec", "compositionRef", "name")
}

// graphItems returns the objects in a list result.
func graphItems(result map[string]interface{}) []map[string]interface{} {
	raw, _ := result["items"].([]interface{})
	items := make([]map[string]interface{}, 0, len(raw))
	for _, r := range raw {
		if m, ok := r.(map[string]interface{}); ok {
			items = append(items, m)
		}
	}
	return items
}

// graphWrappedKind returns the Kind inside a provider-kubernetes Object, so "Object" says what it applies.
func graphWrappedKind(managed map[string]interface{}) string {
	return graphString(managed, "spec", "forProvider", "manifest", "kind")
}
