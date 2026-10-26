package kubernetes

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
	"crossview-go-server/lib"
	"crossview-go-server/services"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"
	"k8s.io/client-go/dynamic"
	"k8s.io/client-go/dynamic/dynamicinformer"
	"k8s.io/client-go/tools/cache"
)

type WatchController struct {
	logger            lib.Logger
	kubernetesService services.KubernetesServiceInterface
	upgrader          websocket.Upgrader
	watchers          map[string]*ResourceWatcher
	mu                sync.RWMutex
}

type ResourceWatcher struct {
	conn      *websocket.Conn
	context   string
	resources []WatchRequest
	stop      chan struct{}
	mu        sync.Mutex
	informers map[string]cache.SharedInformer // map[resourceKey]*informer
	informersMu sync.Mutex
}

type WatchRequest struct {
	APIVersion string `json:"apiVersion"`
	Kind       string `json:"kind"`
	Name       string `json:"name"`
	Namespace  string `json:"namespace"`
	Plural     string `json:"plural"`
}

type WatchMessage struct {
	Type     string      `json:"type"`
	Resource interface{} `json:"resource,omitempty"`
	Error    string      `json:"error,omitempty"`
}

func NewWatchController(logger lib.Logger, kubernetesService services.KubernetesServiceInterface) *WatchController {
	return &WatchController{
		logger:            logger,
		kubernetesService: kubernetesService,
		upgrader: websocket.Upgrader{
			CheckOrigin: func(r *http.Request) bool {
				return true
			},
		},
		watchers: make(map[string]*ResourceWatcher),
	}
}

func (c *WatchController) WatchResources(ctx *gin.Context) {
	conn, err := c.upgrader.Upgrade(ctx.Writer, ctx.Request, nil)
	if err != nil {
		c.logger.Errorf("Failed to upgrade websocket connection: %s", err.Error())
		return
	}
	defer conn.Close()

	watcherID := fmt.Sprintf("%p", conn)
	contextName := ctx.Query("context")
	watcher := &ResourceWatcher{
		conn:    conn,
		context: contextName,
		resources: []WatchRequest{},
		stop:    make(chan struct{}),
		informers: make(map[string]cache.SharedInformer),
	}
	c.logger.Infof("New WebSocket connection established with context: %s", contextName)

	c.mu.Lock()
	c.watchers[watcherID] = watcher
	c.mu.Unlock()

	defer func() {
		c.mu.Lock()
		delete(c.watchers, watcherID)
		c.mu.Unlock()
		close(watcher.stop)
	}()

	// Start message handler in a goroutine
	done := make(chan struct{})
	go func() {
		c.handleMessages(watcher)
		close(done)
	}()
	
	// Keep the connection alive - wait for handleMessages to finish (connection closed)
	<-done
	c.logger.Infof("WebSocket connection closed for watcher")
}

func (c *WatchController) handleMessages(watcher *ResourceWatcher) {
	defer func() {
		c.logger.Infof("handleMessages goroutine exiting for watcher")
	}()
	
	for {
		_, message, err := watcher.conn.ReadMessage()
		if err != nil {
			// Check if it's a normal closure
			if websocket.IsCloseError(err, websocket.CloseNormalClosure, websocket.CloseGoingAway) {
				c.logger.Infof("WebSocket closed normally: %s", err.Error())
				return
			}
			// Check if it's an unexpected close error
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure, websocket.CloseNoStatusReceived) {
				c.logger.Warnf("WebSocket closed unexpectedly: %s", err.Error())
			} else {
				c.logger.Debugf("WebSocket read error (likely connection closed): %s", err.Error())
			}
			return
		}

		c.logger.Debugf("Received WebSocket message: %s", string(message))

		var request struct {
			Type     string          `json:"type"`
			Context  string          `json:"context,omitempty"`
			Resource *WatchRequest  `json:"resource,omitempty"`
			Resources []WatchRequest `json:"resources,omitempty"`
		}

		if err := json.Unmarshal(message, &request); err != nil {
			c.logger.Errorf("Failed to unmarshal WebSocket message: %s, error: %s", string(message), err.Error())
			c.sendError(watcher, "Invalid message format")
			continue
		}

		c.logger.Infof("Processing WebSocket message type: %s", request.Type)

		switch request.Type {
		case "subscribe":
			if request.Resource != nil {
				watcher.mu.Lock()
				// Check if already watching this resource
				alreadyWatching := false
				for _, r := range watcher.resources {
					if c.resourceMatches(r, *request.Resource) {
						alreadyWatching = true
						break
					}
				}
				if !alreadyWatching {
					watcher.resources = append(watcher.resources, *request.Resource)
					watcher.mu.Unlock()
					// Start watching this resource
					go c.watchSingleResource(watcher, *request.Resource)
				} else {
					watcher.mu.Unlock()
				}
			} else if len(request.Resources) > 0 {
				c.logger.Infof("Received subscribe request for %d resources", len(request.Resources))
				watcher.mu.Lock()
				watcher.informersMu.Lock()
				// Find new resources that don't have informers yet
				newResources := []WatchRequest{}
				existingInformerKeys := make(map[string]bool)
				for key := range watcher.informers {
					existingInformerKeys[key] = true
				}
				for _, req := range request.Resources {
					key := fmt.Sprintf("%s:%s:%s:%s", req.APIVersion, req.Kind, req.Namespace, req.Name)
					if !existingInformerKeys[key] {
						newResources = append(newResources, req)
					}
				}
				watcher.resources = request.Resources
				watcher.informersMu.Unlock()
				watcher.mu.Unlock()
				// Start watching all new resources with Informers (event-driven, no polling!)
				c.logger.Infof("Subscribing to %d resources, %d are new (will create Informers)", len(request.Resources), len(newResources))
				for _, req := range newResources {
					c.logger.Infof("Starting Informer (event-driven) for resource: %s/%s/%s in namespace %s", req.APIVersion, req.Kind, req.Name, req.Namespace)
					go c.watchSingleResource(watcher, req)
				}
			} else {
				c.logger.Warnf("Subscribe message received but no resources provided")
			}
		case "unsubscribe":
			if request.Resource != nil {
				watcher.mu.Lock()
				filtered := []WatchRequest{}
				for _, r := range watcher.resources {
					if !c.resourceMatches(r, *request.Resource) {
						filtered = append(filtered, r)
					}
				}
				watcher.resources = filtered
				watcher.mu.Unlock()
			}
		case "setContext":
			watcher.context = request.Context
		}
	}
}

func (c *WatchController) resourceMatches(a, b WatchRequest) bool {
	return a.APIVersion == b.APIVersion &&
		a.Kind == b.Kind &&
		a.Name == b.Name &&
		a.Namespace == b.Namespace
}

func (c *WatchController) watchResources(watcher *ResourceWatcher) {
	watcher.mu.Lock()
	resources := make([]WatchRequest, len(watcher.resources))
	copy(resources, watcher.resources)
	watcher.mu.Unlock()

	if len(resources) == 0 {
		return
	}

	// Start a goroutine for each resource to watch it independently
	var wg sync.WaitGroup
	for _, req := range resources {
		wg.Add(1)
		go func(request WatchRequest) {
			defer wg.Done()
			c.watchSingleResource(watcher, request)
		}(req)
	}

	wg.Wait()
}

func (c *WatchController) watchSingleResource(watcher *ResourceWatcher, req WatchRequest) {
	resourceKey := fmt.Sprintf("%s:%s:%s:%s", req.APIVersion, req.Kind, req.Namespace, req.Name)
	c.logger.Infof("watchSingleResource called for: %s", resourceKey)
	
	if watcher.context == "" {
		watcher.context = c.kubernetesService.GetCurrentContext()
		c.logger.Infof("Using default context: %s", watcher.context)
	}

	if err := c.kubernetesService.SetContext(watcher.context); err != nil {
		c.logger.Errorf("Failed to set context %s: %s", watcher.context, err.Error())
		c.sendError(watcher, fmt.Sprintf("Failed to set context: %s", err.Error()))
		return
	}

	config, err := c.kubernetesService.GetConfig()
	if err != nil {
		c.sendError(watcher, fmt.Sprintf("Failed to get config: %s", err.Error()))
		return
	}

	apiVersionParts := strings.Split(req.APIVersion, "/")
	if len(apiVersionParts) != 2 {
		c.sendError(watcher, fmt.Sprintf("Invalid apiVersion: %s", req.APIVersion))
		return
	}

	plural := req.Plural
	if plural == "" {
		plural = strings.ToLower(req.Kind) + "s"
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		c.sendError(watcher, fmt.Sprintf("Failed to create dynamic client: %s", err.Error()))
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    apiVersionParts[0],
		Version:  apiVersionParts[1],
		Resource: plural,
	}

	// Check if informer already exists for this resource
	watcher.informersMu.Lock()
	if _, exists := watcher.informers[resourceKey]; exists {
		watcher.informersMu.Unlock()
		c.logger.Infof("Informer already exists for resource: %s", resourceKey)
		// Send initial state
		c.updateResource(watcher, req)
		return
	}
	watcher.informersMu.Unlock()

	// Create dynamic informer factory
	factory := dynamicinformer.NewFilteredDynamicSharedInformerFactory(dynamicClient, time.Second*30, req.Namespace, func(options *metav1.ListOptions) {
		options.FieldSelector = fmt.Sprintf("metadata.name=%s", req.Name)
	})

	// Get or create informer for this GVR
	informer := factory.ForResource(gvr).Informer()

	// Set up event handlers - these are called immediately when events occur (event-driven, no polling!)
	informer.AddEventHandler(cache.ResourceEventHandlerFuncs{
		AddFunc: func(obj interface{}) {
			if u, ok := obj.(*unstructured.Unstructured); ok {
				if u.GetName() == req.Name {
					c.logger.Infof("Informer Add event for resource: %s", resourceKey)
					c.sendMessage(watcher, WatchMessage{
						Type:     "updated",
						Resource: services.SecretAsMetadata(u.UnstructuredContent(), req.APIVersion, req.Kind, req.Plural),
					})
				}
			}
		},
		UpdateFunc: func(oldObj, newObj interface{}) {
			if u, ok := newObj.(*unstructured.Unstructured); ok {
				if u.GetName() == req.Name {
					c.logger.Infof("Informer Update event for resource: %s", resourceKey)
					c.sendMessage(watcher, WatchMessage{
						Type:     "updated",
						Resource: services.SecretAsMetadata(u.UnstructuredContent(), req.APIVersion, req.Kind, req.Plural),
					})
				}
			}
		},
		DeleteFunc: func(obj interface{}) {
			if u, ok := obj.(*unstructured.Unstructured); ok {
				if u.GetName() == req.Name {
					c.logger.Infof("Informer Delete event for resource: %s", resourceKey)
					c.sendMessage(watcher, WatchMessage{
						Type: "deleted",
						Resource: map[string]interface{}{
							"apiVersion": req.APIVersion,
							"kind":       req.Kind,
							"metadata": map[string]interface{}{
								"name":      req.Name,
								"namespace": req.Namespace,
							},
						},
					})
				}
			}
		},
	})

	// Store informer
	watcher.informersMu.Lock()
	watcher.informers[resourceKey] = informer
	watcher.informersMu.Unlock()

	// Start the informer (this starts watching in the background, event-driven)
	ctx, cancel := context.WithCancel(context.Background())
	go func() {
		<-watcher.stop
		cancel()
	}()

	go func() {
		informer.Run(ctx.Done())
		// Clean up when informer stops
		watcher.informersMu.Lock()
		delete(watcher.informers, resourceKey)
		watcher.informersMu.Unlock()
		c.logger.Infof("Informer stopped for resource: %s", resourceKey)
	}()

	c.logger.Infof("Successfully started informer (event-driven) for resource: %s", resourceKey)

	// Send initial resource state
	c.updateResource(watcher, req)
}

func (c *WatchController) updateResource(watcher *ResourceWatcher, req WatchRequest) {
	if watcher.context == "" {
		watcher.context = c.kubernetesService.GetCurrentContext()
	}

	if err := c.kubernetesService.SetContext(watcher.context); err != nil {
		c.sendError(watcher, fmt.Sprintf("Failed to set context: %s", err.Error()))
		return
	}

	config, err := c.kubernetesService.GetConfig()
	if err != nil {
		c.sendError(watcher, fmt.Sprintf("Failed to get config: %s", err.Error()))
		return
	}

	apiVersionParts := strings.Split(req.APIVersion, "/")
	if len(apiVersionParts) != 2 {
		c.sendError(watcher, fmt.Sprintf("Invalid apiVersion: %s", req.APIVersion))
		return
	}

	plural := req.Plural
	if plural == "" {
		plural = strings.ToLower(req.Kind) + "s"
	}

	dynamicClient, err := dynamic.NewForConfig(config)
	if err != nil {
		c.sendError(watcher, fmt.Sprintf("Failed to create dynamic client: %s", err.Error()))
		return
	}

	gvr := schema.GroupVersionResource{
		Group:    apiVersionParts[0],
		Version:  apiVersionParts[1],
		Resource: plural,
	}

	var resource *unstructured.Unstructured
	if req.Namespace != "" && req.Namespace != "undefined" && req.Namespace != "null" {
		resource, err = dynamicClient.Resource(gvr).Namespace(req.Namespace).Get(context.Background(), req.Name, metav1.GetOptions{})
	} else {
		resource, err = dynamicClient.Resource(gvr).Get(context.Background(), req.Name, metav1.GetOptions{})
	}

	if err != nil {
		if strings.Contains(err.Error(), "not found") || strings.Contains(err.Error(), "404") {
			c.sendMessage(watcher, WatchMessage{
				Type:  "deleted",
				Resource: map[string]interface{}{
					"apiVersion": req.APIVersion,
					"kind":       req.Kind,
					"metadata": map[string]interface{}{
						"name":      req.Name,
						"namespace": req.Namespace,
					},
				},
			})
		} else {
			c.sendError(watcher, fmt.Sprintf("Failed to get resource: %s", err.Error()))
		}
		return
	}

	c.sendMessage(watcher, WatchMessage{
		Type:     "updated",
		Resource: services.SecretAsMetadata(resource.UnstructuredContent(), req.APIVersion, req.Kind, req.Plural),
	})
}

func (c *WatchController) sendMessage(watcher *ResourceWatcher, msg WatchMessage) {
	watcher.mu.Lock()
	defer watcher.mu.Unlock()

	if err := watcher.conn.WriteJSON(msg); err != nil {
		c.logger.Errorf("Failed to send websocket message: %s", err.Error())
	}
}

func (c *WatchController) sendError(watcher *ResourceWatcher, errorMsg string) {
	c.sendMessage(watcher, WatchMessage{
		Type:  "error",
		Error: errorMsg,
	})
}

