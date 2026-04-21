package kubernetes

import (
	"crossview-go-server/lib"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestKubernetesController_GetStatus(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	mockService := setupMockKubernetesService()

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

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

	controller := NewKubernetesController(logger, mockService, lib.Database{})

	router.GET("/api/managed", controller.GetManagedResources)

	req, _ := http.NewRequest("GET", "/api/managed?context=test-context", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusInternalServerError {
		t.Errorf("Expected status code %d, got %d", http.StatusInternalServerError, w.Code)
	}
}
