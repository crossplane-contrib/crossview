package routes

import (
	"strings"
	"testing"
)

const testIndex = `<!doctype html><html><head><title>x</title><script src="./assets/a.js"></script></head><body></body></html>`

func TestInjectBasePath(t *testing.T) {
	t.Run("root", func(t *testing.T) {
		got := string(injectBasePath([]byte(testIndex), ""))
		if !strings.Contains(got, `<head><base href="/"><script>window.__BASE_PATH__="";</script><title>`) {
			t.Fatalf("unexpected output: %s", got)
		}
	})

	t.Run("prefix", func(t *testing.T) {
		got := string(injectBasePath([]byte(testIndex), "/crossview"))
		if !strings.Contains(got, `<base href="/crossview/">`) || !strings.Contains(got, `window.__BASE_PATH__="/crossview";`) {
			t.Fatalf("unexpected output: %s", got)
		}
	})

	t.Run("escapes the base path", func(t *testing.T) {
		got := string(injectBasePath([]byte(testIndex), `/a"><script>x</script>`))
		if strings.Contains(got, `<script>x`) || strings.Contains(got, `x</script>`) {
			t.Fatalf("base path was not escaped: %s", got)
		}
	})

	t.Run("leaves a page without a head alone", func(t *testing.T) {
		in := "<html></html>"
		if got := string(injectBasePath([]byte(in), "/crossview")); got != in {
			t.Fatalf("got %s", got)
		}
	})
}
