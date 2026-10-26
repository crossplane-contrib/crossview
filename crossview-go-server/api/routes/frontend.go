package routes

import (
	"encoding/json"
	"html"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"github.com/gin-gonic/gin"
	"crossview-go-server/lib"
)

type FrontendRoutes struct {
	logger  lib.Logger
	handler lib.RequestHandler
	env     lib.Env
}

func NewFrontendRoutes(
	logger lib.Logger,
	handler lib.RequestHandler,
	env lib.Env,
) FrontendRoutes {
	return FrontendRoutes{
		logger:  logger,
		handler: handler,
		env:     env,
	}
}

func (r FrontendRoutes) Setup() {
	r.logger.Info("Setting up frontend routes")
	
	wd, _ := os.Getwd()
	distPath := filepath.Join(wd, "dist")
	
	if _, err := os.Stat(distPath); os.IsNotExist(err) {
		distPath = filepath.Join(wd, "..", "dist")
	}
	
	if _, err := os.Stat(distPath); os.IsNotExist(err) {
		r.logger.Warn("dist directory not found, frontend will not be served")
		return
	}
	
	r.logger.Info("Serving frontend from: " + distPath)
	
	r.handler.Gin.Static("/assets", filepath.Join(distPath, "assets"))
	r.handler.Gin.Static("/images", filepath.Join(distPath, "images"))
	r.handler.Gin.StaticFile("/favicon.ico", filepath.Join(distPath, "favicon.ico"))
	
	r.handler.Gin.NoRoute(func(c *gin.Context) {
		path := c.Request.URL.Path
		if len(path) >= 4 && path[:4] == "/api" {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		index, err := os.ReadFile(filepath.Join(distPath, "index.html"))
		if err != nil {
			c.JSON(http.StatusNotFound, gin.H{"error": "Not found"})
			return
		}
		c.Data(http.StatusOK, "text/html; charset=utf-8", injectBasePath(index, r.env.BasePath))
	})
}


// injectBasePath points the page's relative URLs at basePath and tells the frontend
// where it is mounted. The build uses relative asset URLs, so one image works at any prefix.
func injectBasePath(index []byte, basePath string) []byte {
	encoded, _ := json.Marshal(basePath)
	tags := `<base href="` + html.EscapeString(basePath+"/") + `"><script>window.__BASE_PATH__=` + string(encoded) + `;</script>`
	return []byte(strings.Replace(string(index), "<head>", "<head>"+tags, 1))
}
