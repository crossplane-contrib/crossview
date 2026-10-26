package services

import "testing"

func TestSecretMetadataOnly_KeepsOnlyMetadata(t *testing.T) {
	secret := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Secret",
		"type":       "Opaque",
		"data":       map[string]interface{}{"client-secret": "c2VjcmV0"},
		"stringData": map[string]interface{}{"token": "plain"},
		"metadata": map[string]interface{}{
			"name":      "oidc",
			"namespace": "auth",
			"labels":    map[string]interface{}{"app": "x"},
			"annotations": map[string]interface{}{
				"kubectl.kubernetes.io/last-applied-configuration": `{"data":{"client-secret":"c2VjcmV0"}}`,
			},
			"managedFields": []interface{}{"f:data"},
		},
	}

	got := SecretMetadataOnly(secret)

	for _, field := range []string{"data", "stringData"} {
		if _, found := got[field]; found {
			t.Errorf("%s must not be returned, got %v", field, got)
		}
	}
	meta := got["metadata"].(map[string]interface{})
	for _, field := range []string{"annotations", "managedFields"} {
		if _, found := meta[field]; found {
			t.Errorf("metadata.%s must not be returned, got %v", field, meta)
		}
	}
	if got["kind"] != "Secret" || got["type"] != "Opaque" || meta["name"] != "oidc" || meta["namespace"] != "auth" {
		t.Errorf("expected kind, type, name and namespace kept, got %v", got)
	}
}

func TestSecretMetadataOnly_UnknownFieldsAreDropped(t *testing.T) {
	got := SecretMetadataOnly(map[string]interface{}{"somethingNew": "value", "metadata": map[string]interface{}{"name": "a", "extra": "x"}})
	if _, found := got["somethingNew"]; found {
		t.Errorf("unknown top-level field leaked: %v", got)
	}
	if _, found := got["metadata"].(map[string]interface{})["extra"]; found {
		t.Errorf("unknown metadata field leaked: %v", got)
	}
}

func TestSecretMetadataOnly_EmptyIsFine(t *testing.T) {
	if got := SecretMetadataOnly(map[string]interface{}{}); len(got) != 0 {
		t.Errorf("expected an empty result, got %v", got)
	}
}

func TestIsSecret_AnySpellingOfTheCoreSecret(t *testing.T) {
	cases := []struct {
		apiVersion, kind, plural string
		want                     bool
	}{
		{"v1", "Secret", "", true},
		{"v1", "secret", "", true},
		{"/v1", "Secret", "", true},
		{" v1 ", "Secret", "", true},
		{"v1", "Anything", "secrets", true},
		{"/v1", "Anything", "Secrets", true},
		{"v1", "ConfigMap", "configmaps", false},
		{"apps/v1", "Secret", "", false},
		{"example.org/v1", "Secret", "secrets", false},
	}
	for _, c := range cases {
		if got := IsSecret(c.apiVersion, c.kind, c.plural); got != c.want {
			t.Errorf("IsSecret(%q, %q, %q) = %v, want %v", c.apiVersion, c.kind, c.plural, got, c.want)
		}
	}
}

func TestSecretAsMetadata_ByRequestOrByObject(t *testing.T) {
	withData := func() map[string]interface{} {
		return map[string]interface{}{"data": map[string]interface{}{"k": "v"}, "metadata": map[string]interface{}{"name": "s"}}
	}

	byRequest := SecretAsMetadata(withData(), "/v1", "Foo", "secrets")
	if _, found := byRequest["data"]; found {
		t.Errorf("a Secret named by the request must lose its data, got %v", byRequest)
	}
	if byRequest["kind"] != "Secret" || byRequest["apiVersion"] != "v1" {
		t.Errorf("kind and apiVersion are set from the request, got %v", byRequest)
	}

	byObject := withData()
	byObject["apiVersion"], byObject["kind"] = "v1", "Secret"
	if _, found := SecretAsMetadata(byObject, "example.org/v1", "Foo", "foos")["data"]; found {
		t.Error("an object that says it is a Secret must lose its data")
	}

	other := map[string]interface{}{"kind": "ConfigMap", "data": map[string]interface{}{"k": "v"}}
	if _, found := SecretAsMetadata(other, "v1", "ConfigMap", "configmaps")["data"]; !found {
		t.Error("a ConfigMap must keep its data")
	}
}

func TestSecretListAsMetadata_EveryItem(t *testing.T) {
	result := map[string]interface{}{"items": []interface{}{
		map[string]interface{}{"data": map[string]interface{}{"a": "1"}, "metadata": map[string]interface{}{"name": "one"}},
		map[string]interface{}{"data": map[string]interface{}{"b": "2"}, "metadata": map[string]interface{}{"name": "two"}},
	}, "continueToken": nil}

	got := SecretListAsMetadata(result, "v1", "Secret", "")

	for _, item := range got["items"].([]interface{}) {
		if _, found := item.(map[string]interface{})["data"]; found {
			t.Errorf("every listed Secret must lose its data, got %v", item)
		}
	}
	if _, ok := got["continueToken"]; !ok {
		t.Error("the rest of the list result must stay")
	}
	if SecretListAsMetadata(map[string]interface{}{}, "v1", "Secret", "") == nil {
		t.Error("a result with no items must come back unchanged")
	}
}
