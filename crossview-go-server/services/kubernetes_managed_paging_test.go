package services

import (
	"fmt"
	"testing"

	"crossview-go-server/lib"
)

func makePagingItem(kind, namespace, name string) map[string]interface{} {
	return map[string]interface{}{
		"kind": kind,
		"metadata": map[string]interface{}{
			"namespace": namespace,
			"name":      name,
			"uid":       fmt.Sprintf("%s-%s-%s", kind, namespace, name),
		},
	}
}

func makePagingItems(n int) []interface{} {
	items := make([]interface{}, 0, n)
	for i := 0; i < n; i++ {
		items = append(items, makePagingItem("Widget", "default", fmt.Sprintf("item-%04d", i)))
	}
	return items
}

func TestPaginateManagedResourcesResult_NoOptionsReturnsFullList(t *testing.T) {
	items := makePagingItems(5)
	result := paginateManagedResourcesResult(items, false, nil)

	got, _ := result["items"].([]interface{})
	if len(got) != 5 {
		t.Fatalf("expected 5 items, got %d", len(got))
	}
	if result["totalCount"] != 5 {
		t.Fatalf("expected totalCount 5, got %v", result["totalCount"])
	}
	if result["continueToken"] != nil {
		t.Fatalf("expected nil continueToken, got %v", result["continueToken"])
	}
}

func TestPaginateManagedResourcesResult_PagesThroughLargeList(t *testing.T) {
	items := makePagingItems(250)
	var collected []interface{}
	token := ""
	pages := 0
	for {
		result := paginateManagedResourcesResult(items, false, &ManagedResourcesOptions{Limit: 100, Continue: token})
		page, _ := result["items"].([]interface{})
		collected = append(collected, page...)
		pages++
		next, _ := result["continueToken"].(string)
		if next == "" {
			break
		}
		token = next
		if pages > 10 {
			t.Fatal("paging did not terminate")
		}
	}
	if len(collected) != 250 {
		t.Fatalf("expected 250 items across pages, got %d", len(collected))
	}
	if pages != 3 {
		t.Fatalf("expected 3 pages for 250 items at limit 100, got %d", pages)
	}
}

func TestPaginateManagedResourcesResult_KindAndSearchFilter(t *testing.T) {
	items := []interface{}{
		makePagingItem("Widget", "default", "alpha"),
		makePagingItem("Gadget", "default", "alpha"),
		makePagingItem("Widget", "other", "beta"),
	}
	byKind := paginateManagedResourcesResult(items, false, &ManagedResourcesOptions{Kind: "Gadget"})
	if byKind["totalCount"] != 1 {
		t.Fatalf("expected 1 gadget, got %v", byKind["totalCount"])
	}
	bySearch := paginateManagedResourcesResult(items, false, &ManagedResourcesOptions{Search: "BETA"})
	if bySearch["totalCount"] != 1 {
		t.Fatalf("expected 1 search hit, got %v", bySearch["totalCount"])
	}
}

func TestSortManagedResources_DeterministicOrder(t *testing.T) {
	items := []interface{}{
		makePagingItem("Widget", "default", "b"),
		makePagingItem("Gadget", "default", "a"),
		makePagingItem("Widget", "default", "a"),
	}
	sortManagedResources(items)
	first, _ := items[0].(map[string]interface{})
	if first["kind"] != "Gadget" {
		t.Fatalf("expected Gadget first after sort, got %v", first["kind"])
	}
}

func TestNewKubernetesService_AppliesManagedTuningDefaults(t *testing.T) {
	service := NewKubernetesService(setupTestLogger(), setupTestEnv())
	ks, ok := service.(*KubernetesService)
	if !ok {
		t.Fatal("expected *KubernetesService")
	}
	if ks.managedPageSize != lib.DefaultManagedPageSize {
		t.Fatalf("expected default page size %d, got %d", lib.DefaultManagedPageSize, ks.managedPageSize)
	}
	if ks.managedMaxItemsPerType != lib.DefaultManagedMaxItemsPerType {
		t.Fatalf("expected default max items %d, got %d", lib.DefaultManagedMaxItemsPerType, ks.managedMaxItemsPerType)
	}
	if ks.managedMaxConcurrency != lib.DefaultManagedMaxConcurrency {
		t.Fatalf("expected default concurrency %d, got %d", lib.DefaultManagedMaxConcurrency, ks.managedMaxConcurrency)
	}
}

func TestNewKubernetesService_AppliesManagedTuningFromEnv(t *testing.T) {
	env := setupTestEnv()
	env.ManagedPageSize = 250
	env.ManagedMaxItemsPerType = 10000
	env.ManagedMaxConcurrency = 4
	env.ManagedCacheTTLSeconds = 60
	service := NewKubernetesService(setupTestLogger(), env)
	ks, ok := service.(*KubernetesService)
	if !ok {
		t.Fatal("expected *KubernetesService")
	}
	if ks.managedPageSize != 250 || ks.managedMaxItemsPerType != 10000 || ks.managedMaxConcurrency != 4 {
		t.Fatalf("tuning not applied: %+v", ks)
	}
	if ttl := env.ManagedCacheTTL().Seconds(); ttl != 60 {
		t.Fatalf("expected 60s TTL, got %v", ttl)
	}
}
