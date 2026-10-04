package kubernetes

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"crossview-go-server/lib"
	"crossview-go-server/services"
	"github.com/gin-gonic/gin"
)

type KubernetesController struct {
	logger            lib.Logger
	kubernetesService services.KubernetesServiceInterface
}

func NewKubernetesController(logger lib.Logger, kubernetesService services.KubernetesServiceInterface) KubernetesController {
	return KubernetesController{
		logger:            logger,
		kubernetesService: kubernetesService,
	}
}

func (c *KubernetesController) GetStatus(ctx *gin.Context) {
	ctx.JSON(http.StatusOK, gin.H{
		"status": "ok",
	})
}

func (c *KubernetesController) SetContext(ctx *gin.Context) {
	var request struct {
		Context string `json:"context"`
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		request.Context = ctx.Query("context")
	}

	if err := c.kubernetesService.SetContext(request.Context); err != nil {
		c.logger.Errorf("Failed to set Kubernetes context: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	currentContext := c.kubernetesService.GetCurrentContext()
	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"context": currentContext,
	})
}

func (c *KubernetesController) GetCurrentContext(ctx *gin.Context) {
	currentContext := c.kubernetesService.GetCurrentContext()
	ctx.JSON(http.StatusOK, gin.H{
		"context": currentContext,
	})
}

func (c *KubernetesController) GetContexts(ctx *gin.Context) {
	contexts, err := c.kubernetesService.GetContexts()
	if err != nil {
		c.logger.Errorf("Failed to get Kubernetes contexts: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, contexts)
}

func (c *KubernetesController) CheckConnection(ctx *gin.Context) {
	contextName := ctx.Query("context")
	if contextName == "" {
		contextName = c.kubernetesService.GetCurrentContext()
		if contextName == "" {
			ctx.JSON(http.StatusBadRequest, gin.H{"error": "context parameter is required"})
			return
		}
	}

	connected, err := c.kubernetesService.IsConnected(contextName)
	if err != nil {
		c.logger.Errorf("Failed to check Kubernetes connection: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"connected": connected,
		"context":   contextName,
	})
}

func (c *KubernetesController) GetResources(ctx *gin.Context) {
	apiVersion := ctx.Query("apiVersion")
	kind := ctx.Query("kind")
	namespace := ctx.Query("namespace")
	contextName := ctx.Query("context")
	plural := ctx.Query("plural")
	continueToken := ctx.Query("continue")

	var limit *int64
	if limitStr := ctx.Query("limit"); limitStr != "" {
		if limitVal, err := parseInt64(limitStr); err == nil {
			limit = &limitVal
		}
	}

	if apiVersion == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "apiVersion parameter is required"})
		return
	}

	if kind == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "kind parameter is required"})
		return
	}

	result, err := c.kubernetesService.GetResources(apiVersion, kind, namespace, contextName, plural, limit, continueToken)
	if err != nil {
		if lib.IsMissingKubernetesResourceError(err) {
			ctx.JSON(http.StatusOK, gin.H{
				"items":              []interface{}{},
				"continueToken":      nil,
				"remainingItemCount": nil,
			})
			return
		}
		c.logger.Errorf("Failed to get resources: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func parseInt64(s string) (int64, error) {
	return strconv.ParseInt(s, 10, 64)
}

func (c *KubernetesController) GetResource(ctx *gin.Context) {
	apiVersion := ctx.Query("apiVersion")
	kind := ctx.Query("kind")
	name := ctx.Query("name")
	namespace := ctx.Query("namespace")
	contextName := ctx.Query("context")
	plural := ctx.Query("plural")

	if apiVersion == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "apiVersion parameter is required"})
		return
	}
	if kind == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "kind parameter is required"})
		return
	}
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "name parameter is required"})
		return
	}

	cleanNamespace := namespace
	if namespace == "undefined" || namespace == "null" {
		cleanNamespace = ""
	}

	resource, err := c.kubernetesService.GetResource(apiVersion, kind, name, cleanNamespace, contextName, plural)
	if err != nil {
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "404") || strings.Contains(err.Error(), "NotFound") {
			ctx.JSON(http.StatusNotFound, gin.H{"error": "Resource not found"})
			return
		}
		c.logger.Errorf("Failed to get resource: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, resource)
}

func (c *KubernetesController) GetEvents(ctx *gin.Context) {
	kind := ctx.Query("kind")
	name := ctx.Query("name")
	namespace := ctx.Query("namespace")
	contextName := ctx.Query("context")

	if kind == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "kind parameter is required"})
		return
	}
	if name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "name parameter is required"})
		return
	}

	events, err := c.kubernetesService.GetEvents(kind, name, namespace, contextName)
	if err != nil {
		c.logger.Errorf("Failed to get events: %s", err.Error())
		ctx.JSON(http.StatusOK, []interface{}{})
		return
	}

	ctx.JSON(http.StatusOK, events)
}

func (c *KubernetesController) GetManagedResources(ctx *gin.Context) {
	contextName := ctx.Query("context")
	forceRefresh := ctx.Query("refresh") == "true"

	var opts *services.ManagedResourcesOptions
	if limitStr, kind, search, cont := ctx.Query("limit"), ctx.Query("kind"), ctx.Query("search"), ctx.Query("continue"); limitStr != "" || kind != "" || search != "" || cont != "" {
		o := &services.ManagedResourcesOptions{
			Kind:     kind,
			Search:   search,
			Continue: cont,
		}
		if limitStr != "" {
			if v, err := parseInt64(limitStr); err == nil && v > 0 {
				if v > 2000 {
					v = 2000
				}
				o.Limit = int(v)
			}
		}
		opts = o
	}

	result, err := c.kubernetesService.GetManagedResourcesPaged(contextName, forceRefresh, opts)
	if err != nil {
		c.logger.Errorf("Failed to get managed resources: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *KubernetesController) AddKubeConfig(ctx *gin.Context) {
	var request struct {
		KubeConfig string `json:"kubeConfig"`
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfig is required"})
		return
	}

	if request.KubeConfig == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "kubeConfig cannot be empty"})
		return
	}

	addedContexts, err := c.kubernetesService.AddKubeConfig(request.KubeConfig)
	if err != nil {
		c.logger.Errorf("Failed to add kubeconfig: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success":       true,
		"addedContexts": addedContexts,
		"message":       fmt.Sprintf("Successfully added %d context(s)", len(addedContexts)),
	})
}

func (c *KubernetesController) RemoveContext(ctx *gin.Context) {
	var request struct {
		Context string `json:"context"`
	}

	if err := ctx.ShouldBindJSON(&request); err != nil {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "context is required"})
		return
	}

	if request.Context == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "context cannot be empty"})
		return
	}

	if err := c.kubernetesService.RemoveContext(request.Context); err != nil {
		c.logger.Errorf("Failed to remove context: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{
		"success": true,
		"message": fmt.Sprintf("Successfully removed context: %s", request.Context),
	})
}
