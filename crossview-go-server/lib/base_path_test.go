package lib

import (
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestNormalizeBasePath(t *testing.T) {
	cases := map[string]string{
		"":              "",
		"/":             "",
		"  ":            "",
		"crossview":     "/crossview",
		"/crossview":    "/crossview",
		"/crossview/":   "/crossview",
		" /a/b/ ":       "/a/b",
		"//crossview//": "/crossview",
	}
	for in, want := range cases {
		if got := NormalizeBasePath(in); got != want {
			t.Errorf("NormalizeBasePath(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestWithBasePath(t *testing.T) {
	var seen string
	inner := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = r.URL.Path
		w.WriteHeader(http.StatusOK)
	})

	t.Run("root base path passes requests through", func(t *testing.T) {
		seen = ""
		rec := httptest.NewRecorder()
		WithBasePath("", inner).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/health", nil))
		if rec.Code != http.StatusOK || seen != "/api/health" {
			t.Fatalf("got %d, path %q", rec.Code, seen)
		}
	})

	t.Run("strips the prefix", func(t *testing.T) {
		seen = ""
		rec := httptest.NewRecorder()
		WithBasePath("/crossview", inner).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/crossview/api/health", nil))
		if rec.Code != http.StatusOK || seen != "/api/health" {
			t.Fatalf("got %d, path %q", rec.Code, seen)
		}
	})

	t.Run("serves the index at the prefix with a trailing slash", func(t *testing.T) {
		seen = ""
		rec := httptest.NewRecorder()
		WithBasePath("/crossview", inner).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/crossview/", nil))
		if rec.Code != http.StatusOK || seen != "/" {
			t.Fatalf("got %d, path %q", rec.Code, seen)
		}
	})

	t.Run("redirects the bare prefix and keeps the query", func(t *testing.T) {
		rec := httptest.NewRecorder()
		WithBasePath("/crossview", inner).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/crossview?x=1", nil))
		if rec.Code != http.StatusPermanentRedirect || rec.Header().Get("Location") != "/crossview/?x=1" {
			t.Fatalf("got %d, location %q", rec.Code, rec.Header().Get("Location"))
		}
	})

	t.Run("keeps the health check at the root", func(t *testing.T) {
		seen = ""
		rec := httptest.NewRecorder()
		WithBasePath("/crossview", inner).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, HealthPath, nil))
		if rec.Code != http.StatusOK || seen != HealthPath {
			t.Fatalf("got %d, path %q", rec.Code, seen)
		}
	})

	t.Run("404s outside the prefix", func(t *testing.T) {
		for _, p := range []string{"/", "/api/other", "/crossviewer/x"} {
			rec := httptest.NewRecorder()
			WithBasePath("/crossview", inner).ServeHTTP(rec, httptest.NewRequest(http.MethodGet, p, nil))
			if rec.Code != http.StatusNotFound {
				t.Errorf("%s: got %d, want 404", p, rec.Code)
			}
		}
	})
}

func TestFrontendURL(t *testing.T) {
	cases := []struct {
		origin, base, want string
	}{
		{"https://x.example.com", "", "https://x.example.com"},
		{"https://x.example.com/", "", "https://x.example.com"},
		{"https://x.example.com", "/crossview", "https://x.example.com/crossview"},
	}
	for _, c := range cases {
		if got := (Env{CORSOrigin: c.origin, BasePath: c.base}).FrontendURL(); got != c.want {
			t.Errorf("FrontendURL(%q, %q) = %q, want %q", c.origin, c.base, got, c.want)
		}
	}
}
