package sso

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"crossview-go-server/api/controllers/auth"
	"crossview-go-server/api/middlewares"
	"crossview-go-server/lib"
	"crossview-go-server/models"

	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
)

func TestSSOWithoutDatabaseSessionRoundTrip(t *testing.T) {
	for _, protocol := range []string{"oidc", "saml"} {
		t.Run(protocol, func(t *testing.T) {
			router := setupTestRouter()
			router.Use(sessions.Sessions("session", setupTestSessionStore()))
			logger, env := setupTestLogger(), setupTestEnv()
			env.AuthMode = "session"
			env.DBEnabled = false
			repo := models.NewUserRepository(nil)
			user, err := repo.FindOrCreateSSOUser("testuser", "test@example.com", "", "")
			if err != nil {
				t.Fatal(err)
			}
			mock := MockSSOService{
				HandleOIDCCallbackFunc: func(context.Context, string, string, string) (*models.User, error) {
					return user, nil
				},
				HandleSAMLCallbackFunc: func(context.Context, string, string) (*models.User, error) {
					return user, nil
				},
			}
			controller := NewSSOController(logger, env, mock)
			authController := auth.NewAuthController(logger, lib.Database{}, env)
			router.GET("/oidc", controller.HandleOIDCCallback)
			router.POST("/saml", controller.HandleSAMLCallback)
			router.GET("/api/auth/check", authController.Check)
			router.POST("/api/auth/logout", authController.Logout)
			middleware := middlewares.NewSessionAuthMiddleware(lib.RequestHandler{}, logger, env)
			router.GET("/protected", middleware.Handler(), func(ctx *gin.Context) {
				ctx.Status(http.StatusOK)
			})
			router.GET("/admin", middleware.Handler(), middlewares.RequireAdmin(repo), func(ctx *gin.Context) {
				ctx.Status(http.StatusOK)
			})

			request := httptest.NewRequest(http.MethodGet, "/oidc?code=valid&state=valid", nil)
			if protocol == "saml" {
				request = httptest.NewRequest(http.MethodPost, "/saml?SAMLResponse=valid", nil)
				request.PostForm = map[string][]string{"SAMLResponse": {"valid"}}
			}

			callback := httptest.NewRecorder()
			router.ServeHTTP(callback, request)
			if callback.Code != http.StatusFound || callback.Header().Get("Location") != env.CORSOrigin {
				t.Fatalf("callback failed: %d %s", callback.Code, callback.Body.String())
			}
			cookies := callback.Result().Cookies()
			if len(cookies) == 0 {
				t.Fatal("callback did not issue a session cookie")
			}
			send := func(method, path string, cookies []*http.Cookie) *httptest.ResponseRecorder {
				t.Helper()
				request := httptest.NewRequest(method, path, nil)
				for _, cookie := range cookies {
					request.AddCookie(cookie)
				}
				response := httptest.NewRecorder()
				router.ServeHTTP(response, request)
				return response
			}
			check := send(http.MethodGet, "/api/auth/check", cookies)
			var result struct {
				Authenticated   bool        `json:"authenticated"`
				DatabaseEnabled bool        `json:"databaseEnabled"`
				User            models.User `json:"user"`
			}
			if err := json.Unmarshal(check.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if !result.Authenticated || result.DatabaseEnabled || result.User.Username != user.Username || result.User.Role != "user" {
				t.Fatalf("session identity was lost: %s", check.Body.String())
			}
			if response := send(http.MethodGet, "/protected", cookies); response.Code != http.StatusOK {
				t.Fatalf("protected resource: %d", response.Code)
			}
			if response := send(http.MethodGet, "/admin", cookies); response.Code != http.StatusForbidden {
				t.Fatalf("SSO user must not gain admin rights: %d", response.Code)
			}
			if response := send(http.MethodGet, "/protected", nil); response.Code != http.StatusUnauthorized {
				t.Fatalf("anonymous access must fail: %d", response.Code)
			}
			logout := send(http.MethodPost, "/api/auth/logout", cookies)
			check = send(http.MethodGet, "/api/auth/check", logout.Result().Cookies())
			if err := json.Unmarshal(check.Body.Bytes(), &result); err != nil {
				t.Fatal(err)
			}
			if result.Authenticated {
				t.Fatal("logout did not clear session identity")
			}
		})
	}
}
