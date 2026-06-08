package services

import (
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"crossview-go-server/lib"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd/api"
)

type KubernetesServiceInterface interface {
	SetContext(ctxName string) error
	GetCurrentContext() string
	GetContexts() ([]string, error)
	GetClientset() (kubernetes.Interface, error)
	GetConfig() (*rest.Config, error)
	IsConnected(ctxName string) (bool, error)
	AddKubeConfig(kubeConfigYAML string) ([]string, error)
	RemoveContext(ctxName string) error
	ClearFailedContext(ctxName string)
	ClearManagedResourcesCache(contextName string)
	GetResources(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error)
	GetResource(apiVersion, kind, name, namespace, contextName, plural string) (map[string]interface{}, error)
	GetEvents(kind, name, namespace, contextName string) ([]map[string]interface{}, error)
	GetManagedResources(contextName string, forceRefresh bool) (map[string]interface{}, error)
	GetResourceTree(apiVersion, kind, name, namespace, contextName string, maxDepth int) (*TreeNode, error)
	GetResourceDrift(apiVersion, kind, name, namespace, contextName string) (map[string]interface{}, error)
}

type KubernetesService struct {
	logger        lib.Logger
	env           lib.Env
	currentContext string
	kubeConfig    *api.Config
	clientset     kubernetes.Interface
	config        *rest.Config
	dynamicClient interface{}
	pluralCache   map[string]string
	failedContexts map[string]bool
	
	// Managed resources cache
	managedResourcesCache map[string]map[string]interface{}
	managedResourcesCacheTime map[string]time.Time
	managedResourcesCacheTTL time.Duration
	
	mu            sync.RWMutex
}

func NewKubernetesService(logger lib.Logger, env lib.Env) KubernetesServiceInterface {
	service := &KubernetesService{
		logger:        logger,
		env:           env,
		pluralCache:   make(map[string]string),
		failedContexts: make(map[string]bool),
		managedResourcesCache: make(map[string]map[string]interface{}),
		managedResourcesCacheTime: make(map[string]time.Time),
		managedResourcesCacheTTL: 5 * time.Minute, // 5 minute TTL
	}

	serviceAccountPath := "/var/run/secrets/kubernetes.io/serviceaccount"
	if fileExists(serviceAccountPath) && 
		fileExists(filepath.Join(serviceAccountPath, "token")) &&
		fileExists(filepath.Join(serviceAccountPath, "ca.crt")) {
		if err := service.SetContext(""); err != nil {
			logger.Warnf("Failed to auto-initialize Kubernetes service account: %s", err.Error())
		} else {
			logger.Info("Kubernetes service initialized with service account (in-cluster mode)")
		}
	}

	return service
}

func (k *KubernetesService) GetCurrentContext() string {
	k.mu.RLock()
	defer k.mu.RUnlock()
	return k.currentContext
}

func (k *KubernetesService) GetContexts() ([]string, error) {
	serviceAccountPath := "/var/run/secrets/kubernetes.io/serviceaccount"
	if fileExists(serviceAccountPath) && 
		fileExists(filepath.Join(serviceAccountPath, "token")) &&
		fileExists(filepath.Join(serviceAccountPath, "ca.crt")) {
		return []string{"in-cluster"}, nil
	}

	k.mu.RLock()
	if k.kubeConfig == nil {
		k.mu.RUnlock()
		if err := k.loadKubeConfig(); err != nil {
			return nil, err
		}
		k.mu.RLock()
	}
	defer k.mu.RUnlock()

	contexts := make([]string, 0, len(k.kubeConfig.Contexts))
	for name := range k.kubeConfig.Contexts {
		contexts = append(contexts, name)
	}
	return contexts, nil
}

func (k *KubernetesService) GetClientset() (kubernetes.Interface, error) {
	k.mu.RLock()
	defer k.mu.RUnlock()

	if k.clientset == nil {
		return nil, fmt.Errorf("kubernetes client not initialized, call SetContext first")
	}
	return k.clientset, nil
}

func (k *KubernetesService) GetConfig() (*rest.Config, error) {
	k.mu.RLock()
	defer k.mu.RUnlock()

	if k.config == nil {
		return nil, fmt.Errorf("kubernetes config not initialized, call SetContext first")
	}
	return k.config, nil
}

func (k *KubernetesService) ClearFailedContext(ctxName string) {
	k.mu.Lock()
	defer k.mu.Unlock()
	
	targetContext := ctxName
	if k.isInCluster() {
		targetContext = "in-cluster"
	}
	
	delete(k.failedContexts, targetContext)
}

func (k *KubernetesService) ClearManagedResourcesCache(contextName string) {
	k.mu.Lock()
	defer k.mu.Unlock()
	
	if contextName == "" {
		// Clear all cache
		k.managedResourcesCache = make(map[string]map[string]interface{})
		k.managedResourcesCacheTime = make(map[string]time.Time)
		k.logger.Info("Cleared all managed resources cache")
	} else {
		// Clear cache for specific context
		delete(k.managedResourcesCache, contextName)
		delete(k.managedResourcesCacheTime, contextName)
		k.logger.Infof("Cleared managed resources cache for context: %s", contextName)
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return !os.IsNotExist(err)
}
