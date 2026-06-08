package kubernetes

import (
	"crossview-go-server/lib"
	"crossview-go-server/services"

	"github.com/gin-gonic/gin"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
)

func setupTestRouter() *gin.Engine {
	gin.SetMode(gin.TestMode)
	return gin.New()
}

func setupTestLogger() lib.Logger {
	return lib.GetLogger()
}

func setupMockKubernetesService() MockKubernetesService {
	return MockKubernetesService{}
}

type MockKubernetesService struct {
	SetContextFunc           func(ctxName string) error
	GetCurrentContextFunc    func() string
	GetContextsFunc          func() ([]string, error)
	GetClientsetFunc         func() (kubernetes.Interface, error)
	GetConfigFunc            func() (*rest.Config, error)
	IsConnectedFunc          func(ctxName string) (bool, error)
	AddKubeConfigFunc        func(kubeConfigYAML string) ([]string, error)
	RemoveContextFunc        func(ctxName string) error
	ClearFailedContextFunc   func(ctxName string)
	ClearManagedResourcesCacheFunc func(contextName string)
	GetResourcesFunc         func(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error)
	GetResourceFunc          func(apiVersion, kind, name, namespace, contextName, plural string) (map[string]interface{}, error)
	GetEventsFunc            func(kind, name, namespace, contextName string) ([]map[string]interface{}, error)
	GetManagedResourcesFunc  func(contextName string, forceRefresh bool) (map[string]interface{}, error)
	GetResourceTreeFunc      func(apiVersion, kind, name, namespace, contextName string, maxDepth int) (*services.TreeNode, error)
	GetResourceDriftFunc     func(apiVersion, kind, name, namespace, contextName string) (map[string]interface{}, error)
}

func (m MockKubernetesService) SetContext(ctxName string) error {
	if m.SetContextFunc != nil {
		return m.SetContextFunc(ctxName)
	}
	return nil
}

func (m MockKubernetesService) GetCurrentContext() string {
	if m.GetCurrentContextFunc != nil {
		return m.GetCurrentContextFunc()
	}
	return ""
}

func (m MockKubernetesService) GetContexts() ([]string, error) {
	if m.GetContextsFunc != nil {
		return m.GetContextsFunc()
	}
	return []string{}, nil
}

func (m MockKubernetesService) GetClientset() (kubernetes.Interface, error) {
	if m.GetClientsetFunc != nil {
		return m.GetClientsetFunc()
	}
	return nil, nil
}

func (m MockKubernetesService) GetConfig() (*rest.Config, error) {
	if m.GetConfigFunc != nil {
		return m.GetConfigFunc()
	}
	return nil, nil
}

func (m MockKubernetesService) IsConnected(ctxName string) (bool, error) {
	if m.IsConnectedFunc != nil {
		return m.IsConnectedFunc(ctxName)
	}
	return false, nil
}

func (m MockKubernetesService) GetResources(apiVersion, kind, namespace, contextName, plural string, limit *int64, continueToken string) (map[string]interface{}, error) {
	if m.GetResourcesFunc != nil {
		return m.GetResourcesFunc(apiVersion, kind, namespace, contextName, plural, limit, continueToken)
	}
	return map[string]interface{}{"items": []interface{}{}}, nil
}

func (m MockKubernetesService) GetResource(apiVersion, kind, name, namespace, contextName, plural string) (map[string]interface{}, error) {
	if m.GetResourceFunc != nil {
		return m.GetResourceFunc(apiVersion, kind, name, namespace, contextName, plural)
	}
	return map[string]interface{}{}, nil
}

func (m MockKubernetesService) GetEvents(kind, name, namespace, contextName string) ([]map[string]interface{}, error) {
	if m.GetEventsFunc != nil {
		return m.GetEventsFunc(kind, name, namespace, contextName)
	}
	return []map[string]interface{}{}, nil
}

func (m MockKubernetesService) GetManagedResources(contextName string, forceRefresh bool) (map[string]interface{}, error) {
	if m.GetManagedResourcesFunc != nil {
		return m.GetManagedResourcesFunc(contextName, forceRefresh)
	}
	return map[string]interface{}{"items": []interface{}{}}, nil
}

func (m MockKubernetesService) AddKubeConfig(kubeConfigYAML string) ([]string, error) {
	if m.AddKubeConfigFunc != nil {
		return m.AddKubeConfigFunc(kubeConfigYAML)
	}
	return []string{}, nil
}

func (m MockKubernetesService) RemoveContext(ctxName string) error {
	if m.RemoveContextFunc != nil {
		return m.RemoveContextFunc(ctxName)
	}
	return nil
}

func (m MockKubernetesService) ClearFailedContext(ctxName string) {
	if m.ClearFailedContextFunc != nil {
		m.ClearFailedContextFunc(ctxName)
	}
}

func (m MockKubernetesService) ClearManagedResourcesCache(contextName string) {
	if m.ClearManagedResourcesCacheFunc != nil {
		m.ClearManagedResourcesCacheFunc(contextName)
	}
}

func (m MockKubernetesService) GetResourceTree(apiVersion, kind, name, namespace, contextName string, maxDepth int) (*services.TreeNode, error) {
	if m.GetResourceTreeFunc != nil {
		return m.GetResourceTreeFunc(apiVersion, kind, name, namespace, contextName, maxDepth)
	}
	return nil, nil
}

func (m MockKubernetesService) GetResourceDrift(apiVersion, kind, name, namespace, contextName string) (map[string]interface{}, error) {
	if m.GetResourceDriftFunc != nil {
		return m.GetResourceDriftFunc(apiVersion, kind, name, namespace, contextName)
	}
	return map[string]interface{}{"hasDrift": false}, nil
}

