package kubernetes

import (
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"crossview-go-server/lib"
	"crossview-go-server/models"
	"crossview-go-server/services"
	"github.com/gin-gonic/gin"
)

type KubernetesController struct {
	logger               lib.Logger
	kubernetesService    services.KubernetesServiceInterface
	resourceEventRepo    *models.ResourceEventRepository
	resourceMetricRepo   *models.ResourceMetricRepository
}

func NewKubernetesController(
	logger lib.Logger,
	kubernetesService services.KubernetesServiceInterface,
	database lib.Database,
) KubernetesController {
	var eventRepo *models.ResourceEventRepository
	var metricRepo *models.ResourceMetricRepository
	if database.DB != nil {
		eventRepo = models.NewResourceEventRepository(database.DB)
		metricRepo = models.NewResourceMetricRepository(database.DB)
	}
	return KubernetesController{
		logger:             logger,
		kubernetesService:  kubernetesService,
		resourceEventRepo:  eventRepo,
		resourceMetricRepo: metricRepo,
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

	result, err := c.kubernetesService.GetManagedResources(contextName, forceRefresh)
	if err != nil {
		c.logger.Errorf("Failed to get managed resources: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, result)
}

func (c *KubernetesController) GetResourceTree(ctx *gin.Context) {
	apiVersion := ctx.Query("apiVersion")
	kind := ctx.Query("kind")
	name := ctx.Query("name")
	namespace := ctx.Query("namespace")
	contextName := ctx.Query("context")

	if apiVersion == "" || kind == "" || name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "apiVersion, kind, and name parameters are required"})
		return
	}

	if namespace == "undefined" || namespace == "null" {
		namespace = ""
	}

	maxDepth := 5
	if depthStr := ctx.Query("depth"); depthStr != "" {
		if d, err := strconv.Atoi(depthStr); err == nil && d > 0 {
			maxDepth = d
		}
	}

	tree, err := c.kubernetesService.GetResourceTree(apiVersion, kind, name, namespace, contextName, maxDepth)
	if err != nil {
		c.logger.Errorf("Failed to get resource tree: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, tree)
}

func (c *KubernetesController) GetResourceDrift(ctx *gin.Context) {
	apiVersion := ctx.Query("apiVersion")
	kind := ctx.Query("kind")
	name := ctx.Query("name")
	namespace := ctx.Query("namespace")
	contextName := ctx.Query("context")

	if apiVersion == "" || kind == "" || name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "apiVersion, kind, and name parameters are required"})
		return
	}

	if namespace == "undefined" || namespace == "null" {
		namespace = ""
	}

	drift, err := c.kubernetesService.GetResourceDrift(apiVersion, kind, name, namespace, contextName)
	if err != nil {
		c.logger.Errorf("Failed to get resource drift: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, drift)
}

func (c *KubernetesController) GetResourceHistory(ctx *gin.Context) {
	if c.resourceEventRepo == nil {
		ctx.JSON(http.StatusNotImplemented, gin.H{"error": "History tracking requires database to be enabled"})
		return
	}

	apiVersion := ctx.Query("apiVersion")
	kind := ctx.Query("kind")
	name := ctx.Query("name")
	namespace := ctx.Query("namespace")
	contextName := ctx.Query("context")

	if apiVersion == "" || kind == "" || name == "" {
		ctx.JSON(http.StatusBadRequest, gin.H{"error": "apiVersion, kind, and name parameters are required"})
		return
	}

	if namespace == "undefined" || namespace == "null" {
		namespace = ""
	}

	limit := 50
	if limitStr := ctx.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	events, err := c.resourceEventRepo.FindByResource(apiVersion, kind, name, namespace, contextName, limit)
	if err != nil {
		c.logger.Errorf("Failed to get resource history: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"events": events})
}

func (c *KubernetesController) GetRecentHistory(ctx *gin.Context) {
	if c.resourceEventRepo == nil {
		ctx.JSON(http.StatusNotImplemented, gin.H{"error": "History tracking requires database to be enabled"})
		return
	}

	contextName := ctx.Query("context")
	limit := 20
	if limitStr := ctx.Query("limit"); limitStr != "" {
		if l, err := strconv.Atoi(limitStr); err == nil && l > 0 {
			limit = l
		}
	}

	events, err := c.resourceEventRepo.FindRecent(contextName, limit)
	if err != nil {
		c.logger.Errorf("Failed to get recent history: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"events": events})
}

func (c *KubernetesController) GetMetricsSummary(ctx *gin.Context) {
	if c.resourceMetricRepo == nil {
		ctx.JSON(http.StatusNotImplemented, gin.H{"error": "Metrics requires database to be enabled"})
		return
	}

	contextName := ctx.Query("context")
	if contextName == "" {
		contextName = c.kubernetesService.GetCurrentContext()
	}

	metric, err := c.resourceMetricRepo.FindLatest(contextName)
	if err != nil {
		ctx.JSON(http.StatusOK, gin.H{"message": "No metrics collected yet"})
		return
	}

	ctx.JSON(http.StatusOK, metric)
}

func (c *KubernetesController) GetHealthTrend(ctx *gin.Context) {
	if c.resourceMetricRepo == nil {
		ctx.JSON(http.StatusNotImplemented, gin.H{"error": "Metrics requires database to be enabled"})
		return
	}

	contextName := ctx.Query("context")
	if contextName == "" {
		contextName = c.kubernetesService.GetCurrentContext()
	}

	to := time.Now()
	from := to.Add(-24 * time.Hour)

	if fromStr := ctx.Query("from"); fromStr != "" {
		if t, err := time.Parse(time.RFC3339, fromStr); err == nil {
			from = t
		}
	}
	if toStr := ctx.Query("to"); toStr != "" {
		if t, err := time.Parse(time.RFC3339, toStr); err == nil {
			to = t
		}
	}

	metrics, err := c.resourceMetricRepo.FindByTimeRange(contextName, from, to, 500)
	if err != nil {
		c.logger.Errorf("Failed to get health trend: %s", err.Error())
		ctx.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	ctx.JSON(http.StatusOK, gin.H{"metrics": metrics})
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
