package sso

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"crossview-go-server/api/controllers/auth"
	"crossview-go-server/lib"
	"crossview-go-server/models"

	"github.com/gin-contrib/sessions"
)

func TestSSOAndPasswordLoginWithDatabase(t *testing.T) {
	db := setupTestDB(t)
	repo := models.NewUserRepository(db)
	local := &models.User{Username: "local", Email: "local@example.com", Role: "user"}
	if err := local.SetPassword("test-password"); err != nil {
		t.Fatal(err)
	}
	if err := repo.Create(local); err != nil {
		t.Fatal(err)
	}
	ssoUser, err := repo.FindOrCreateSSOUser("sso-user", "sso@example.com", "", "")
	if err != nil {
		t.Fatal(err)
	}
	router := setupTestRouter()
	router.Use(sessions.Sessions("session", setupTestSessionStore()))
	env := setupTestEnv()
	env.AuthMode, env.DBEnabled = "session", true
	authController := auth.NewAuthController(setupTestLogger(), lib.Database{DB: db}, env)
	ssoController := NewSSOController(setupTestLogger(), env, MockSSOService{
		HandleOIDCCallbackFunc: func(context.Context, string, string, string) (*models.User, error) {
			return ssoUser, nil
		},
	})
	router.GET("/oidc", ssoController.HandleOIDCCallback)
	router.POST("/login", authController.Login)
	router.GET("/check", authController.Check)
	for _, method := range []string{"sso", "password"} {
		t.Run(method, func(t *testing.T) {
			request := httptest.NewRequest(http.MethodGet, "/oidc?code=valid&state=valid", nil)
			expected := ssoUser.Username
			if method == "password" {
				request = httptest.NewRequest(http.MethodPost, "/login", bytes.NewBufferString(`{"username":"local","password":"test-password"}`))
				request.Header.Set("Content-Type", "application/json")
				expected = local.Username
			}
			login := httptest.NewRecorder()
			router.ServeHTTP(login, request)
			if login.Code != http.StatusOK && login.Code != http.StatusFound {
				t.Fatalf("login failed: %d %s", login.Code, login.Body.String())
			}
			request = httptest.NewRequest(http.MethodGet, "/check", nil)
			for _, cookie := range login.Result().Cookies() {
				request.AddCookie(cookie)
			}
			check := httptest.NewRecorder()
			router.ServeHTTP(check, request)
			var result struct {
				Authenticated   bool        `json:"authenticated"`
				DatabaseEnabled bool        `json:"databaseEnabled"`
				User            models.User `json:"user"`
			}
			if err := json.Unmarshal(check.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if !result.Authenticated || !result.DatabaseEnabled || result.User.Username != expected {
				t.Fatalf("login did not persist: %s", check.Body.String())
			}
		})
	}
}
