package auth

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"crossview-go-server/lib"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func TestPasswordAuthenticationRequiresDatabase(t *testing.T) {
	router := setupTestRouter()
	router.Use(sessions.Sessions("session", setupTestSessionStore()))
	controller := NewAuthController(setupTestLogger(), lib.Database{}, setupTestEnv())
	router.POST("/login", controller.Login)
	router.POST("/register", controller.Register)
	router.GET("/check", controller.Check)
	for _, path := range []string{"/login", "/register"} {
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodPost, path, nil))
		if response.Code != http.StatusForbidden {
			t.Fatalf("%s must reject password authentication without a DB: %d", path, response.Code)
		}
	}
	response := httptest.NewRecorder()
	router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/check", nil))
	var result map[string]interface{}
	if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
		t.Fatal(err)
	}
	if result["databaseEnabled"] != false || result["authenticated"] != false {
		t.Fatalf("unexpected capabilities: %s", response.Body.String())
	}
}

func TestDatabaseSessionNeverFallsBackToSSOClaims(t *testing.T) {
	for _, value := range []interface{}{uint(999), "invalid", nil} {
		router := setupTestRouter()
		router.Use(sessions.Sessions("session", setupTestSessionStore()))
		controller := NewAuthController(setupTestLogger(), lib.Database{DB: setupTestDB(t)}, setupTestEnv())
		router.GET("/check", func(ctx *gin.Context) {
			session := sessions.Default(ctx)
			session.Set("userId", value)
			session.Set("authMethod", "sso")
			session.Set("username", "deleted-user")
			session.Set("email", "test@example.com")
			session.Set("userRole", "admin")
			controller.Check(ctx)
		})
		response := httptest.NewRecorder()
		router.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/check", nil))
		var result map[string]interface{}
		if err := json.Unmarshal(response.Body.Bytes(), &result); err != nil {
			t.Fatal(err)
		}
		if result["authenticated"] != false || result["databaseEnabled"] != true {
			t.Fatalf("database sessions must require an existing user: %s", response.Body.String())
		}
	}
}
