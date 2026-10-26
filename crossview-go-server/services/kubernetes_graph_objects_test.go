package services

import (
	"reflect"
	"testing"
)

func TestGraphGroup(t *testing.T) {
	if got := graphGroup("platform.example.org/v1alpha1"); got != "platform.example.org" {
		t.Errorf("group = %q, want platform.example.org", got)
	}
	if got := graphGroup("v1"); got != "" {
		t.Errorf("core group = %q, want empty", got)
	}
}

func TestGraphResourceID_LeavesTheVersionOut(t *testing.T) {
	v1 := map[string]interface{}{"apiVersion": "example.org/v1", "kind": "K", "metadata": map[string]interface{}{"name": "n", "namespace": "ns"}}
	v2 := map[string]interface{}{"apiVersion": "example.org/v2", "kind": "K", "metadata": map[string]interface{}{"name": "n", "namespace": "ns"}}
	if graphObjectID(v1) != graphObjectID(v2) {
		t.Errorf("ids differ across versions: %q and %q", graphObjectID(v1), graphObjectID(v2))
	}
	if got, want := graphObjectID(v1), "example.org/K/ns/n"; got != want {
		t.Errorf("id = %q, want %q", got, want)
	}
}

func TestGraphString_MissingFieldIsEmpty(t *testing.T) {
	obj := map[string]interface{}{"metadata": map[string]interface{}{"name": "a", "count": 3}}
	if got := graphString(obj, "metadata", "name"); got != "a" {
		t.Errorf("name = %q, want a", got)
	}
	for _, path := range [][]string{{"metadata", "missing"}, {"nothing", "here"}, {"metadata", "count"}} {
		if got := graphString(obj, path...); got != "" {
			t.Errorf("%v = %q, want empty", path, got)
		}
	}
}

func TestGraphCondition(t *testing.T) {
	obj := map[string]interface{}{"status": map[string]interface{}{"conditions": []interface{}{
		map[string]interface{}{"type": "Ready", "status": "False"},
		map[string]interface{}{"type": "Synced", "status": "True"},
		"not a condition",
	}}}
	ready, synced := graphReadiness(obj)
	if ready != "False" || synced != "True" {
		t.Errorf("readiness = %q, %q, want False, True", ready, synced)
	}
	if got := graphCondition(obj, "Healthy"); got != "" {
		t.Errorf("missing condition = %q, want empty", got)
	}
	if got := graphCondition(map[string]interface{}{}, "Ready"); got != "" {
		t.Errorf("object with no status = %q, want empty", got)
	}
}

func TestGraphRefs_PrefersV2AndFallsBackToV1(t *testing.T) {
	v1Ref := map[string]interface{}{"name": "v1"}
	v2Ref := map[string]interface{}{"name": "v2"}
	both := map[string]interface{}{"spec": map[string]interface{}{
		"resourceRefs": []interface{}{v1Ref},
		"crossplane":   map[string]interface{}{"resourceRefs": []interface{}{v2Ref}},
	}}
	if got := graphRefs(both); !reflect.DeepEqual(got, []interface{}{v2Ref}) {
		t.Errorf("both locations = %v, want the v2 refs", got)
	}
	onlyV1 := map[string]interface{}{"spec": map[string]interface{}{"resourceRefs": []interface{}{v1Ref}}}
	if got := graphRefs(onlyV1); !reflect.DeepEqual(got, []interface{}{v1Ref}) {
		t.Errorf("v1 only = %v, want the v1 refs", got)
	}
	if got := graphRefs(map[string]interface{}{}); len(got) != 0 {
		t.Errorf("no refs = %v, want none", got)
	}
}

func TestGraphCompositionName_PrefersV2AndFallsBackToV1(t *testing.T) {
	v2 := map[string]interface{}{"spec": map[string]interface{}{
		"compositionRef": map[string]interface{}{"name": "old"},
		"crossplane":     map[string]interface{}{"compositionRef": map[string]interface{}{"name": "new"}},
	}}
	if got := graphCompositionName(v2); got != "new" {
		t.Errorf("name = %q, want new", got)
	}
	v1 := map[string]interface{}{"spec": map[string]interface{}{"compositionRef": map[string]interface{}{"name": "old"}}}
	if got := graphCompositionName(v1); got != "old" {
		t.Errorf("name = %q, want old", got)
	}
	if got := graphCompositionName(map[string]interface{}{}); got != "" {
		t.Errorf("no ref = %q, want empty", got)
	}
}

func TestGraphItems_SkipsEntriesThatAreNotObjects(t *testing.T) {
	result := map[string]interface{}{"items": []interface{}{map[string]interface{}{"a": 1}, "junk", nil}}
	if got := graphItems(result); len(got) != 1 {
		t.Errorf("items = %d, want 1", len(got))
	}
	if got := graphItems(map[string]interface{}{}); got == nil || len(got) != 0 {
		t.Errorf("no items = %v, want an empty list", got)
	}
}

func TestGraphWrappedKind(t *testing.T) {
	wrapper := map[string]interface{}{"spec": map[string]interface{}{"forProvider": map[string]interface{}{
		"manifest": map[string]interface{}{"kind": "ConfigMap"},
	}}}
	if got := graphWrappedKind(wrapper); got != "ConfigMap" {
		t.Errorf("wrapped kind = %q, want ConfigMap", got)
	}
	if got := graphWrappedKind(map[string]interface{}{"spec": map[string]interface{}{}}); got != "" {
		t.Errorf("no manifest = %q, want empty", got)
	}
}
