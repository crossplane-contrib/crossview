package lib

import (
	"net/http"
	"strings"
)

// NormalizeBasePath returns the URL prefix Crossview is served under, with a
// leading slash and no trailing slash. An empty value or "/" means the root.
func NormalizeBasePath(raw string) string {
	trimmed := strings.Trim(strings.TrimSpace(raw), "/")
	if trimmed == "" {
		return ""
	}
	return "/" + trimmed
}

// HealthPath stays reachable without the base path, so probes need no changes.
const HealthPath = "/api/health"

// WithBasePath serves handler under basePath: the prefix is stripped before the
// request reaches handler, and paths outside the prefix get a 404 (except HealthPath).
func WithBasePath(basePath string, handler http.Handler) http.Handler {
	if basePath == "" {
		return handler
	}
	stripped := http.StripPrefix(basePath, handler)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == HealthPath {
			handler.ServeHTTP(w, r)
			return
		}
		if r.URL.Path == basePath {
			target := basePath + "/"
			if r.URL.RawQuery != "" {
				target += "?" + r.URL.RawQuery
			}
			http.Redirect(w, r, target, http.StatusPermanentRedirect)
			return
		}
		if !strings.HasPrefix(r.URL.Path, basePath+"/") {
			http.NotFound(w, r)
			return
		}
		stripped.ServeHTTP(w, r)
	})
}

// FrontendURL is the public URL of the UI: the CORS origin plus the base path.
func (e Env) FrontendURL() string {
	return strings.TrimRight(e.CORSOrigin, "/") + e.BasePath
}
