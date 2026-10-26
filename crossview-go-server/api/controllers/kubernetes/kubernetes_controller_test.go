package kubernetes

import (
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestKubernetesController_GetStatus(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/kubernetes/status", controller.GetStatus)

	req, _ := http.NewRequest("GET", "/api/kubernetes/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if status, ok := response["status"].(string); !ok || status != "ok" {
		t.Errorf("Expected status 'ok', got '%v'", response["status"])
	}
}

func TestKubernetesController_GetCurrentContext(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetCurrentContextFunc = func() string {
		return "test-context"
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/kubernetes/context", controller.GetCurrentContext)

	req, _ := http.NewRequest("GET", "/api/kubernetes/context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if context, ok := response["context"].(string); !ok || context != "test-context" {
		t.Errorf("Expected context 'test-context', got '%v'", response["context"])
	}
}

func TestKubernetesController_GetContexts_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	expectedContexts := []string{"context1", "context2", "context3"}
	mockService.GetContextsFunc = func() ([]string, error) {
		return expectedContexts, nil
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/kubernetes/contexts", controller.GetContexts)

	req, _ := http.NewRequest("GET", "/api/kubernetes/contexts", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var response []string
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if len(response) != len(expectedContexts) {
		t.Errorf("Expected %d contexts, got %d", len(expectedContexts), len(response))
	}
}

func TestKubernetesController_GetContexts_Error(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetContextsFunc = func() ([]string, error) {
		return nil, http.ErrMissingFile
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/kubernetes/contexts", controller.GetContexts)

	req, _ := http.NewRequest("GET", "/api/kubernetes/contexts", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}
}

func TestKubernetesController_SetContext_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.SetContextFunc = func(ctxName string) error {
		return nil
	}

	mockService.GetCurrentContextFunc = func() string {
		return "test-context"
	}

	controller := NewKubernetesController(logger, mockService)

	router.POST("/api/kubernetes/context", controller.SetContext)

	req, _ := http.NewRequest("POST", "/api/kubernetes/context?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if success, ok := response["success"].(bool); !ok || !success {
		t.Error("Expected success to be true")
	}
}

func TestKubernetesController_SetContext_Error(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.SetContextFunc = func(ctxName string) error {
		return http.ErrMissingFile
	}

	controller := NewKubernetesController(logger, mockService)

	router.POST("/api/kubernetes/context", controller.SetContext)

	req, _ := http.NewRequest("POST", "/api/kubernetes/context?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}
}

func TestKubernetesController_CheckConnection_WithContext(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.IsConnectedFunc = func(ctxName string) (bool, error) {
		return true, nil
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/kubernetes/connection", controller.CheckConnection)

	req, _ := http.NewRequest("GET", "/api/kubernetes/connection?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if connected, ok := response["connected"].(bool); !ok || !connected {
		t.Error("Expected connected to be true")
	}
}

func TestKubernetesController_CheckConnection_NoContext(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetCurrentContextFunc = func() string {
		return ""
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/kubernetes/connection", controller.CheckConnection)

	req, _ := http.NewRequest("GET", "/api/kubernetes/connection", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetResources_MissingApiVersion(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resources", controller.GetResources)

	req, _ := http.NewRequest("GET", "/api/resources?kind=Pod", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetResources_MissingKind(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resources", controller.GetResources)

	req, _ := http.NewRequest("GET", "/api/resources?apiVersion=v1", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetResources_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	expectedResult := map[string]interface{}{
		"items":              []interface{}{},
		"continueToken":      nil,
		"remainingItemCount": nil,
	}

	mockService.GetResourcesFunc = func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
		return expectedResult, nil
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resources", controller.GetResources)

	req, _ := http.NewRequest("GET", "/api/resources?apiVersion=v1&kind=Pod", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
}

func TestKubernetesController_GetResources_NotFound(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetResourcesFunc = func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
		return nil, fmt.Errorf("404 Not Found")
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resources", controller.GetResources)

	req, _ := http.NewRequest("GET", "/api/resources?apiVersion=v1&kind=Pod", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d for NotFound, got %d", http.StatusOK, w.Code)
	}
}

func TestKubernetesController_GetResources_MissingApiResource(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetResourcesFunc = func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
		return nil, fmt.Errorf("failed to list resources: the server could not find the requested resource")
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resources", controller.GetResources)

	req, _ := http.NewRequest("GET", "/api/resources?apiVersion=pkg.crossplane.io/v1&kind=Function", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d for missing API resource, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	items, ok := response["items"].([]interface{})
	if !ok {
		t.Fatalf("Expected items array in response, got %T", response["items"])
	}

	if len(items) != 0 {
		t.Fatalf("Expected empty items array, got %d items", len(items))
	}
}

func TestKubernetesController_GetResource_MissingApiVersion(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resource", controller.GetResource)

	req, _ := http.NewRequest("GET", "/api/resource?kind=Pod&name=test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetResource_MissingKind(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resource", controller.GetResource)

	req, _ := http.NewRequest("GET", "/api/resource?apiVersion=v1&name=test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetResource_MissingName(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resource", controller.GetResource)

	req, _ := http.NewRequest("GET", "/api/resource?apiVersion=v1&kind=Pod", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetResource_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	expectedResource := map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Pod",
		"metadata": map[string]interface{}{
			"name": "test-pod",
		},
	}

	mockService.GetResourceFunc = func(apiVersion, kind, name, namespace, contextName, plural string) (map[string]interface{}, error) {
		return expectedResource, nil
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resource", controller.GetResource)

	req, _ := http.NewRequest("GET", "/api/resource?apiVersion=v1&kind=Pod&name=test-pod", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
}

func TestKubernetesController_GetResource_NotFound(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetResourceFunc = func(apiVersion, kind, name, namespace, contextName, plural string) (map[string]interface{}, error) {
		return nil, fmt.Errorf("resource not found: Pod/test-pod")
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/resource", controller.GetResource)

	req, _ := http.NewRequest("GET", "/api/resource?apiVersion=v1&kind=Pod&name=test-pod", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestKubernetesController_GetEvents_MissingKind(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/events", controller.GetEvents)

	req, _ := http.NewRequest("GET", "/api/events?name=test", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetEvents_MissingName(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/events", controller.GetEvents)

	req, _ := http.NewRequest("GET", "/api/events?kind=Pod", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func TestKubernetesController_GetEvents_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	expectedEvents := []map[string]interface{}{
		{
			"type":   "Normal",
			"reason": "Started",
		},
	}

	mockService.GetEventsFunc = func(kind, name, namespace, contextName string) ([]map[string]interface{}, error) {
		return expectedEvents, nil
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/events", controller.GetEvents)

	req, _ := http.NewRequest("GET", "/api/events?kind=Pod&name=test-pod&namespace=default", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
}

func TestKubernetesController_GetEvents_Error(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetEventsFunc = func(kind, name, namespace, contextName string) ([]map[string]interface{}, error) {
		return nil, http.ErrMissingFile
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/events", controller.GetEvents)

	req, _ := http.NewRequest("GET", "/api/events?kind=Pod&name=test-pod&namespace=default", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d for error case, got %d", http.StatusOK, w.Code)
	}

	var response []interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if len(response) != 0 {
		t.Errorf("Expected empty array on error, got %d items", len(response))
	}
}

func TestKubernetesController_GetManagedResources_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	expectedResult := map[string]interface{}{
		"items":     []interface{}{},
		"fromCache": false,
	}

	mockService.GetManagedResourcesFunc = func(contextName string, forceRefresh bool) (map[string]interface{}, error) {
		return expectedResult, nil
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/managed", controller.GetManagedResources)

	req, _ := http.NewRequest("GET", "/api/managed?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
}

func TestKubernetesController_GetManagedResources_Error(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetManagedResourcesFunc = func(contextName string, forceRefresh bool) (map[string]interface{}, error) {
		return nil, http.ErrMissingFile
	}

	controller := NewKubernetesController(logger, mockService)

	router.GET("/api/managed", controller.GetManagedResources)

	req, _ := http.NewRequest("GET", "/api/managed?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}
}

func TestKubernetesController_GetGraph_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetResourcesFunc = func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
		if kind == "Composition" {
			return map[string]interface{}{"items": []interface{}{
				map[string]interface{}{
					"apiVersion": "apiextensions.crossplane.io/v1",
					"kind":       "Composition",
					"metadata":   map[string]interface{}{"name": "web"},
				},
			}}, nil
		}
		return map[string]interface{}{"items": []interface{}{}}, nil
	}

	controller := NewKubernetesController(logger, mockService)
	router.GET("/api/graph", controller.GetGraph)

	req, _ := http.NewRequest("GET", "/api/graph?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var body struct {
		Nodes []map[string]interface{} `json:"nodes"`
		Edges []map[string]interface{} `json:"edges"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}
	if len(body.Nodes) != 1 || body.Nodes[0]["id"] != "composition/web" {
		t.Errorf("Expected a single composition node, got %v", body.Nodes)
	}
	if body.Edges == nil {
		t.Error("Expected edges to be an empty array, not null")
	}
}

func TestKubernetesController_GetGraph_Error(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	mockService.GetCurrentContextFunc = func() string { return "test-context" }
	mockService.GetResourcesFunc = func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
		return nil, fmt.Errorf("boom")
	}

	controller := NewKubernetesController(logger, mockService)
	router.GET("/api/graph", controller.GetGraph)

	req, _ := http.NewRequest("GET", "/api/graph", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}
	if strings.Contains(w.Body.String(), "boom") {
		t.Errorf("Expected the internal error to stay out of the response, got %s", w.Body.String())
	}
}

func TestKubernetesController_GetGraph_IncludeManaged(t *testing.T) {
	for query, wantCalled := range map[string]bool{"": true, "?includeManaged=true": true, "?includeManaged=false": false} {
		router := setupTestRouter()
		mockService := setupMockKubernetesService()
		mockService.GetCurrentContextFunc = func() string { return "test-context" }
		called := false
		mockService.GetManagedResourcesFunc = func(contextName string, forceRefresh bool) (map[string]interface{}, error) {
			called = true
			return map[string]interface{}{"items": []interface{}{}}, nil
		}

		controller := NewKubernetesController(setupTestLogger(), mockService)
		router.GET("/api/graph", controller.GetGraph)

		req, _ := http.NewRequest("GET", "/api/graph"+query, nil)
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if w.Code != http.StatusOK {
			t.Fatalf("%q: expected status %d, got %d", query, http.StatusOK, w.Code)
		}
		if called != wantCalled {
			t.Errorf("%q: expected managed list called=%v, got %v", query, wantCalled, called)
		}
	}
}

func TestKubernetesController_GetGraph_UsesCurrentContext(t *testing.T) {
	router := setupTestRouter()
	mockService := setupMockKubernetesService()
	mockService.GetCurrentContextFunc = func() string { return "current-context" }
	var listedWith string
	mockService.GetResourcesFunc = func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
		listedWith = contextName
		return map[string]interface{}{"items": []interface{}{}}, nil
	}

	controller := NewKubernetesController(setupTestLogger(), mockService)
	router.GET("/api/graph", controller.GetGraph)

	req, _ := http.NewRequest("GET", "/api/graph", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
	if listedWith != "current-context" {
		t.Errorf("Expected the current context to be used, got %q", listedWith)
	}
}

func TestKubernetesController_GetGraph_NoContext(t *testing.T) {
	router := setupTestRouter()
	mockService := setupMockKubernetesService()
	mockService.GetCurrentContextFunc = func() string { return "" }

	controller := NewKubernetesController(setupTestLogger(), mockService)
	router.GET("/api/graph", controller.GetGraph)

	req, _ := http.NewRequest("GET", "/api/graph", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Expected status code %d, got %d", http.StatusBadRequest, w.Code)
	}
}

func getResourceBody(t *testing.T, query string, resource map[string]interface{}) map[string]interface{} {
	t.Helper()
	router := setupTestRouter()
	mockService := setupMockKubernetesService()
	mockService.GetResourceFunc = func(apiVersion, kind, name, namespace, contextName, plural string) (map[string]interface{}, error) {
		return resource, nil
	}
	controller := NewKubernetesController(setupTestLogger(), mockService)
	router.GET("/api/resource", controller.GetResource)

	req, _ := http.NewRequest("GET", "/api/resource?"+query, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
	var body map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("Expected a JSON body: %v", err)
	}
	return body
}

func TestKubernetesController_GetResource_SecretReturnsMetadataOnly(t *testing.T) {
	body := getResourceBody(t, "apiVersion=v1&kind=Secret&name=oidc&namespace=auth", map[string]interface{}{
		"apiVersion": "v1",
		"kind":       "Secret",
		"type":       "Opaque",
		"data":       map[string]interface{}{"client-secret": "c2VjcmV0"},
		"stringData": map[string]interface{}{"token": "plain"},
		"metadata": map[string]interface{}{
			"name":          "oidc",
			"namespace":     "auth",
			"annotations":   map[string]interface{}{"kubectl.kubernetes.io/last-applied-configuration": "{}"},
			"managedFields": []interface{}{"f:data"},
		},
	})

	for _, field := range []string{"data", "stringData"} {
		if _, found := body[field]; found {
			t.Errorf("%s must not be returned, got %v", field, body)
		}
	}
	meta := body["metadata"].(map[string]interface{})
	for _, field := range []string{"annotations", "managedFields"} {
		if _, found := meta[field]; found {
			t.Errorf("metadata.%s must not be returned, got %v", field, meta)
		}
	}
	if body["kind"] != "Secret" || body["type"] != "Opaque" || meta["name"] != "oidc" || meta["namespace"] != "auth" {
		t.Errorf("Expected kind, type, name and namespace kept, got %v", body)
	}
}

func TestKubernetesController_GetResource_OtherKindsAreUnchanged(t *testing.T) {
	body := getResourceBody(t, "apiVersion=v1&kind=ConfigMap&name=cfg&namespace=auth", map[string]interface{}{
		"kind": "ConfigMap",
		"data": map[string]interface{}{"key": "value"},
	})

	data, ok := body["data"].(map[string]interface{})
	if !ok || data["key"] != "value" {
		t.Errorf("Expected a ConfigMap to keep its data, got %v", body)
	}
}

func listBody(t *testing.T, query string, items []interface{}) []interface{} {
	t.Helper()
	router := setupTestRouter()
	mockService := setupMockKubernetesService()
	mockService.GetResourcesFunc = func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
		return map[string]interface{}{"items": items}, nil
	}
	controller := NewKubernetesController(setupTestLogger(), mockService)
	router.GET("/api/resources", controller.GetResources)

	req, _ := http.NewRequest("GET", "/api/resources?"+query, nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Fatalf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}
	var body struct {
		Items []interface{} `json:"items"`
	}
	if err := json.Unmarshal(w.Body.Bytes(), &body); err != nil {
		t.Fatalf("Expected a JSON body: %v", err)
	}
	return body.Items
}

func secretItems() []interface{} {
	return []interface{}{
		map[string]interface{}{"data": map[string]interface{}{"client-secret": "c2VjcmV0"}, "metadata": map[string]interface{}{"name": "a", "namespace": "ns"}},
		map[string]interface{}{"stringData": map[string]interface{}{"token": "plain"}, "metadata": map[string]interface{}{"name": "b", "namespace": "ns"}},
	}
}

func TestKubernetesController_GetResources_SecretsReturnMetadataOnly(t *testing.T) {
	for _, query := range []string{
		"apiVersion=v1&kind=Secret",
		"apiVersion=/v1&kind=Secret",
		"apiVersion=/v1&kind=Anything&plural=secrets",
	} {
		items := listBody(t, query, secretItems())
		if len(items) != 2 {
			t.Fatalf("%s: expected both items, got %d", query, len(items))
		}
		for _, item := range items {
			obj := item.(map[string]interface{})
			if _, found := obj["data"]; found {
				t.Errorf("%s: data must not be returned, got %v", query, obj)
			}
			if _, found := obj["stringData"]; found {
				t.Errorf("%s: stringData must not be returned, got %v", query, obj)
			}
			if obj["metadata"].(map[string]interface{})["name"] == nil {
				t.Errorf("%s: the name must stay, got %v", query, obj)
			}
		}
	}
}

func TestKubernetesController_GetResources_OtherKindsAreUnchanged(t *testing.T) {
	items := listBody(t, "apiVersion=v1&kind=ConfigMap", []interface{}{
		map[string]interface{}{"data": map[string]interface{}{"key": "value"}, "metadata": map[string]interface{}{"name": "cfg"}},
	})

	obj := items[0].(map[string]interface{})
	if obj["data"].(map[string]interface{})["key"] != "value" {
		t.Errorf("Expected a ConfigMap to keep its data, got %v", obj)
	}
}

func TestKubernetesController_GetResource_SecretByEverySpelling(t *testing.T) {
	for _, query := range []string{
		"apiVersion=v1&kind=Secret&name=oidc&namespace=auth",
		"apiVersion=/v1&kind=Secret&name=oidc&namespace=auth",
		"apiVersion=/v1&kind=Anything&plural=secrets&name=oidc&namespace=auth",
	} {
		body := getResourceBody(t, query, map[string]interface{}{
			"data":     map[string]interface{}{"client-secret": "c2VjcmV0"},
			"metadata": map[string]interface{}{"name": "oidc", "namespace": "auth"},
		})
		if _, found := body["data"]; found {
			t.Errorf("%s: data must not be returned, got %v", query, body)
		}
		if body["kind"] != "Secret" {
			t.Errorf("%s: kind must be set from the request, got %v", query, body)
		}
	}
}
