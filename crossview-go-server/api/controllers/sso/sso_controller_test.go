package sso

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	"crossview-go-server/lib"
	"crossview-go-server/models"

	"github.com/gin-contrib/sessions"
)

func setupMockSSOService() MockSSOService {
	return MockSSOService{}
}

type MockSSOService struct {
	GetSSOStatusFunc       func() lib.SSOConfig
	InitiateOIDCFunc       func(ctx context.Context, callbackURL string) (string, error)
	HandleOIDCCallbackFunc func(ctx context.Context, code, state string, callbackURL string) (*models.User, error)
	InitiateSAMLFunc       func(ctx context.Context, callbackURL string) (string, error)
	HandleSAMLCallbackFunc func(ctx context.Context, samlResponse string, callbackURL string) (*models.User, error)
}

func (m MockSSOService) GetSSOStatus() lib.SSOConfig {
	if m.GetSSOStatusFunc != nil {
		return m.GetSSOStatusFunc()
	}
	return lib.SSOConfig{Enabled: false}
}

func (m MockSSOService) InitiateOIDC(ctx context.Context, callbackURL string) (string, error) {
	if m.InitiateOIDCFunc != nil {
		return m.InitiateOIDCFunc(ctx, callbackURL)
	}
	return "", nil
}

func (m MockSSOService) HandleOIDCCallback(ctx context.Context, code, state string, callbackURL string) (*models.User, error) {
	if m.HandleOIDCCallbackFunc != nil {
		return m.HandleOIDCCallbackFunc(ctx, code, state, callbackURL)
	}
	return nil, nil
}

func (m MockSSOService) InitiateSAML(ctx context.Context, callbackURL string) (string, error) {
	if m.InitiateSAMLFunc != nil {
		return m.InitiateSAMLFunc(ctx, callbackURL)
	}
	return "", nil
}

func (m MockSSOService) HandleSAMLCallback(ctx context.Context, samlResponse string, callbackURL string) (*models.User, error) {
	if m.HandleSAMLCallbackFunc != nil {
		return m.HandleSAMLCallbackFunc(ctx, samlResponse, callbackURL)
	}
	return nil, nil
}

func TestSSOController_GetStatus(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	mockService.GetSSOStatusFunc = func() lib.SSOConfig {
		return lib.SSOConfig{
			Enabled: true,
			OIDC:    lib.OIDCConfig{Enabled: true},
			SAML:    lib.SAMLConfig{Enabled: false},
		}
	}

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/sso/status", controller.GetStatus)

	req, _ := http.NewRequest("GET", "/api/auth/sso/status", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Expected status code %d, got %d", http.StatusOK, w.Code)
	}

	var response map[string]interface{}
	if err := json.Unmarshal(w.Body.Bytes(), &response); err != nil {
		t.Fatalf("Failed to parse response: %v", err)
	}

	if enabled, ok := response["enabled"].(bool); !ok || !enabled {
		t.Error("Expected SSO to be enabled")
	}
}

func TestSSOController_InitiateOIDC_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	mockService.InitiateOIDCFunc = func(ctx context.Context, callbackURL string) (string, error) {
		return "http://example.com/auth?client_id=test", nil
	}

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/oidc", controller.InitiateOIDC)

	req, _ := http.NewRequest("GET", "/api/auth/oidc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	if location != "http://example.com/auth?client_id=test" {
		t.Errorf("Expected redirect to 'http://example.com/auth?client_id=test', got '%s'", location)
	}
}

func TestSSOController_InitiateOIDC_Error(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	mockService.InitiateOIDCFunc = func(ctx context.Context, callbackURL string) (string, error) {
		return "", http.ErrMissingFile
	}

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/oidc", controller.InitiateOIDC)

	req, _ := http.NewRequest("GET", "/api/auth/oidc", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestSSOController_HandleOIDCCallback_Success(t *testing.T) {
	router := setupTestRouter()
	store := setupTestSessionStore()
	router.Use(sessions.Sessions("session", store))

	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	testUser := &models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		Role:     "user",
	}

	mockService.HandleOIDCCallbackFunc = func(ctx context.Context, code, state string, callbackURL string) (*models.User, error) {
		return testUser, nil
	}

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/oidc/callback", controller.HandleOIDCCallback)

	req, _ := http.NewRequest("GET", "/api/auth/oidc/callback?code=test-code&state=test-state", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	if location != env.CORSOrigin {
		t.Errorf("Expected redirect to '%s', got '%s'", env.CORSOrigin, location)
	}
}

func TestSSOController_HandleOIDCCallback_ErrorParam(t *testing.T) {
	router := setupTestRouter()
	store := setupTestSessionStore()
	router.Use(sessions.Sessions("session", store))

	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/oidc/callback", controller.HandleOIDCCallback)

	req, _ := http.NewRequest("GET", "/api/auth/oidc/callback?error=access_denied", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	expectedLocation := env.CORSOrigin + "/login?error=sso_failed"
	if location != expectedLocation {
		t.Errorf("Expected redirect to '%s', got '%s'", expectedLocation, location)
	}
}

func TestSSOController_HandleOIDCCallback_MissingCode(t *testing.T) {
	router := setupTestRouter()
	store := setupTestSessionStore()
	router.Use(sessions.Sessions("session", store))

	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/oidc/callback", controller.HandleOIDCCallback)

	req, _ := http.NewRequest("GET", "/api/auth/oidc/callback", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	expectedLocation := env.CORSOrigin + "/login?error=sso_failed"
	if location != expectedLocation {
		t.Errorf("Expected redirect to '%s', got '%s'", expectedLocation, location)
	}
}

func TestSSOController_HandleOIDCCallback_ServiceError(t *testing.T) {
	router := setupTestRouter()
	store := setupTestSessionStore()
	router.Use(sessions.Sessions("session", store))

	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	mockService.HandleOIDCCallbackFunc = func(ctx context.Context, code, state string, callbackURL string) (*models.User, error) {
		return nil, http.ErrMissingFile
	}

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/oidc/callback", controller.HandleOIDCCallback)

	req, _ := http.NewRequest("GET", "/api/auth/oidc/callback?code=test-code", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	expectedLocation := env.CORSOrigin + "/login?error=sso_failed"
	if location != expectedLocation {
		t.Errorf("Expected redirect to '%s', got '%s'", expectedLocation, location)
	}
}

func TestSSOController_InitiateSAML_Success(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	mockService.InitiateSAMLFunc = func(ctx context.Context, callbackURL string) (string, error) {
		return "http://example.com/saml/login", nil
	}

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/saml", controller.InitiateSAML)

	req, _ := http.NewRequest("GET", "/api/auth/saml", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	if location != "http://example.com/saml/login" {
		t.Errorf("Expected redirect to 'http://example.com/saml/login', got '%s'", location)
	}
}

func TestSSOController_InitiateSAML_Error(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	mockService.InitiateSAMLFunc = func(ctx context.Context, callbackURL string) (string, error) {
		return "", http.ErrMissingFile
	}

	controller := NewSSOController(logger, env, mockService)

	router.GET("/api/auth/saml", controller.InitiateSAML)

	req, _ := http.NewRequest("GET", "/api/auth/saml", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusNotFound {
		t.Errorf("Expected status code %d, got %d", http.StatusNotFound, w.Code)
	}
}

func TestSSOController_HandleSAMLCallback_Success(t *testing.T) {
	router := setupTestRouter()
	store := setupTestSessionStore()
	router.Use(sessions.Sessions("session", store))

	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	testUser := &models.User{
		ID:       1,
		Username: "testuser",
		Email:    "test@example.com",
		Role:     "user",
	}

	mockService.HandleSAMLCallbackFunc = func(ctx context.Context, samlResponse string, callbackURL string) (*models.User, error) {
		return testUser, nil
	}

	controller := NewSSOController(logger, env, mockService)

	router.POST("/api/auth/saml/callback", controller.HandleSAMLCallback)

	formData := bytes.NewBufferString("SAMLResponse=test-saml-response")
	req, _ := http.NewRequest("POST", "/api/auth/saml/callback", formData)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	if location != env.CORSOrigin {
		t.Errorf("Expected redirect to '%s', got '%s'", env.CORSOrigin, location)
	}
}

func TestSSOController_HandleSAMLCallback_MissingResponse(t *testing.T) {
	router := setupTestRouter()
	store := setupTestSessionStore()
	router.Use(sessions.Sessions("session", store))

	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	controller := NewSSOController(logger, env, mockService)

	router.POST("/api/auth/saml/callback", controller.HandleSAMLCallback)

	req, _ := http.NewRequest("POST", "/api/auth/saml/callback", nil)
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	expectedLocation := env.CORSOrigin + "/login?error=sso_failed"
	if location != expectedLocation {
		t.Errorf("Expected redirect to '%s', got '%s'", expectedLocation, location)
	}
}

func TestSSOController_HandleSAMLCallback_ServiceError(t *testing.T) {
	router := setupTestRouter()
	store := setupTestSessionStore()
	router.Use(sessions.Sessions("session", store))

	logger := setupTestLogger()
	env := setupTestEnv()
	mockService := setupMockSSOService()

	mockService.HandleSAMLCallbackFunc = func(ctx context.Context, samlResponse string, callbackURL string) (*models.User, error) {
		return nil, http.ErrMissingFile
	}

	controller := NewSSOController(logger, env, mockService)

	router.POST("/api/auth/saml/callback", controller.HandleSAMLCallback)

	formData := bytes.NewBufferString("SAMLResponse=test-saml-response")
	req, _ := http.NewRequest("POST", "/api/auth/saml/callback", formData)
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	w := httptest.NewRecorder()
	router.ServeHTTP(w, req)

	if w.Code != http.StatusFound {
		t.Errorf("Expected status code %d, got %d", http.StatusFound, w.Code)
	}

	location := w.Header().Get("Location")
	expectedLocation := env.CORSOrigin + "/login?error=sso_failed"
	if location != expectedLocation {
		t.Errorf("Expected redirect to '%s', got '%s'", expectedLocation, location)
	}
}

func TestSSOController_BasePath(t *testing.T) {
	router := setupTestRouter()
	logger := setupTestLogger()
	env := setupTestEnv()
	env.CORSOrigin = "https://crossview.example.com"
	env.BasePath = "/crossview"
	mockService := setupMockSSOService()

	var gotCallback string
	mockService.InitiateOIDCFunc = func(ctx context.Context, callbackURL string) (string, error) {
		gotCallback = callbackURL
		return "https://idp.example.com/authorize", nil
	}
	mockService.HandleOIDCCallbackFunc = func(ctx context.Context, code, state string, callbackURL string) (*models.User, error) {
		gotCallback = callbackURL
		return nil, errors.New("boom")
	}

	controller := NewSSOController(logger, env, mockService)
	router.GET("/api/auth/oidc", controller.InitiateOIDC)
	router.GET("/api/auth/oidc/callback", controller.HandleOIDCCallback)

	t.Run("the callback URL carries the base path", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/auth/oidc", nil)
		req.Host = "crossview.example.com"
		req.Header.Set("X-Forwarded-Proto", "https")
		router.ServeHTTP(httptest.NewRecorder(), req)

		if want := "https://crossview.example.com/crossview/api/auth/oidc/callback"; gotCallback != want {
			t.Errorf("callback URL = %q, want %q", gotCallback, want)
		}
	})

	t.Run("a failed login returns to the UI under the base path", func(t *testing.T) {
		req, _ := http.NewRequest("GET", "/api/auth/oidc/callback?code=abc&state=s", nil)
		req.Host = "crossview.example.com"
		w := httptest.NewRecorder()
		router.ServeHTTP(w, req)

		if want := "https://crossview.example.com/crossview/login?error=sso_failed"; w.Header().Get("Location") != want {
			t.Errorf("Location = %q, want %q", w.Header().Get("Location"), want)
		}
	})
}
