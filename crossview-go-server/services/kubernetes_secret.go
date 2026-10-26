package services

import "strings"

// A Secret is returned as metadata only, with no values, key names or annotations.
// It lists what is allowed, so a field nobody thought of can never leak.
func SecretMetadataOnly(secret map[string]interface{}) map[string]interface{} {
	safe := map[string]interface{}{}
	for _, field := range []string{"apiVersion", "kind", "type"} {
		if value, ok := secret[field]; ok {
			safe[field] = value
		}
	}
	if meta, ok := secret["metadata"].(map[string]interface{}); ok {
		safeMeta := map[string]interface{}{}
		for _, field := range []string{"name", "namespace", "labels", "creationTimestamp", "ownerReferences"} {
			if value, ok := meta[field]; ok {
				safeMeta[field] = value
			}
		}
		safe["metadata"] = safeMeta
	}
	return safe
}

// The core group is written "v1", and also "/v1" because a leading slash gives an empty group.
func isCoreVersion(apiVersion string) bool {
	return strings.TrimPrefix(strings.TrimSpace(apiVersion), "/") == "v1"
}

// IsSecret says whether a request names the core Secret, by its kind or its plural, in any spelling.
func IsSecret(apiVersion, kind, plural string) bool {
	return isCoreVersion(apiVersion) && (strings.EqualFold(kind, "Secret") || strings.EqualFold(plural, "secrets"))
}

func isSecretObject(obj map[string]interface{}) bool {
	apiVersion, _ := obj["apiVersion"].(string)
	kind, _ := obj["kind"].(string)
	return isCoreVersion(apiVersion) && strings.EqualFold(kind, "Secret")
}

// SecretAsMetadata returns a Secret as metadata only, whether the request or the object says it is one.
// Any other object comes back as it is. The typed client leaves kind empty, so it is set from the request.
func SecretAsMetadata(obj map[string]interface{}, apiVersion, kind, plural string) map[string]interface{} {
	if !IsSecret(apiVersion, kind, plural) && !isSecretObject(obj) {
		return obj
	}
	safe := SecretMetadataOnly(obj)
	safe["apiVersion"] = "v1"
	safe["kind"] = "Secret"
	return safe
}

// SecretListAsMetadata does the same for every item of a list result.
func SecretListAsMetadata(result map[string]interface{}, apiVersion, kind, plural string) map[string]interface{} {
	items, ok := result["items"].([]interface{})
	if !ok {
		return result
	}
	for i, item := range items {
		if obj, ok := item.(map[string]interface{}); ok {
			items[i] = SecretAsMetadata(obj, apiVersion, kind, plural)
		}
	}
	return result
}
