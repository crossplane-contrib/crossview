package kubernetes

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"crossview-go-server/services"
)

func TestKubernetesController_GetManagedResources_PassesPagingOptions(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	var gotOpts *services.ManagedResourcesOptions
	mockService.GetManagedResourcesPagedFunc = func(contextName string, forceRefresh bool, opts *services.ManagedResourcesOptions) (map[string]interface{}, error) {
		gotOpts = opts
		return map[string]interface{}{
			"items":         []interface{}{},
			"fromCache":     false,
			"totalCount":    0,
			"continueToken": nil,
		}, nil
	}

	controller := NewKubernetesController(logger, mockService)
	router.GET("/api/managed", controller.GetManagedResources)

	req, _ := http.NewRequest("GET", "/api/managed?context=test-context&limit=100&continue=100&kind=Widget&search=alpha", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if gotOpts == nil {
		t.Fatal("expected paging options to be passed to service")
	}
	if gotOpts.Limit != 100 || gotOpts.Continue != "100" || gotOpts.Kind != "Widget" || gotOpts.Search != "alpha" {
		t.Fatalf("unexpected paging options: %+v", gotOpts)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("failed to parse response: %v", err)
	}
	if _, ok := response["totalCount"]; !ok {
		t.Error("expected totalCount in paged response")
	}
}

func TestKubernetesController_GetManagedResources_LegacyCallHasNilOptions(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	var gotOpts *services.ManagedResourcesOptions
	called := false
	mockService.GetManagedResourcesPagedFunc = func(contextName string, forceRefresh bool, opts *services.ManagedResourcesOptions) (map[string]interface{}, error) {
		called = true
		gotOpts = opts
		return map[string]interface{}{"items": []interface{}{}, "fromCache": false}, nil
	}

	controller := NewKubernetesController(logger, mockService)
	router.GET("/api/managed", controller.GetManagedResources)

	req, _ := http.NewRequest("GET", "/api/managed?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", w.Code)
	}
	if !called {
		t.Fatal("expected service to be called")
	}
	if gotOpts != nil {
		t.Fatalf("expected nil options for legacy call, got %+v", gotOpts)
	}
}
