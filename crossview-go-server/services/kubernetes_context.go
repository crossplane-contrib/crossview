package services

import (
	"context"
	"fmt"
	"os"
	"path/filepath"
	"time"

	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/client-go/kubernetes"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
)

func init() {
	os.Setenv("AWS_SDK_LOAD_CONFIG", "false")
	os.Setenv("AWS_SHARED_CREDENTIALS_FILE", "")
	os.Setenv("AWS_PROFILE", "")
}

func (k *KubernetesService) getKubeConfigPath() string {
	if kubeConfigPath := os.Getenv("KUBECONFIG"); kubeConfigPath != "" {
		return kubeConfigPath
	}
	homeDir, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(homeDir, ".kube", "config")
}

func (k *KubernetesService) loadKubeConfig() error {
	kubeConfigPath := k.getKubeConfigPath()
	if kubeConfigPath == "" {
		return fmt.Errorf("unable to determine kubeconfig path")
	}

	if _, err := os.Stat(kubeConfigPath); os.IsNotExist(err) {
		return fmt.Errorf("kubeconfig file not found at %s", kubeConfigPath)
	}

	config, err := clientcmd.LoadFromFile(kubeConfigPath)
	if err != nil {
		return fmt.Errorf("failed to load kubeconfig: %w", err)
	}

	k.kubeConfig = config
	return nil
}

func (k *KubernetesService) isInCluster() bool {
	serviceAccountPath := "/var/run/secrets/kubernetes.io/serviceaccount"
	return fileExists(serviceAccountPath) && 
		fileExists(filepath.Join(serviceAccountPath, "token")) &&
		fileExists(filepath.Join(serviceAccountPath, "ca.crt"))
}

func (k *KubernetesService) SetContext(ctxName string) error {
	k.mu.Lock()
	defer k.mu.Unlock()

	targetContext := ctxName
	if k.isInCluster() {
		targetContext = "in-cluster"
	}

	if k.currentContext == targetContext && k.clientset != nil && k.config != nil {
		return nil
	}

	if k.failedContexts[targetContext] {
		return fmt.Errorf("context '%s' has previously failed and will not be retried", targetContext)
	}

	var restConfig *rest.Config
	var err error

	if k.isInCluster() {
		restConfig, err = rest.InClusterConfig()
		if err != nil {
			k.failedContexts[targetContext] = true
			return fmt.Errorf("failed to create in-cluster config: %w", err)
		}
		k.currentContext = "in-cluster"
	} else {
		if ctxName == "" {
			return fmt.Errorf("context parameter is required when not running in cluster")
		}

		if err := k.loadKubeConfig(); err != nil {
			k.failedContexts[targetContext] = true
			return err
		}

		if _, exists := k.kubeConfig.Contexts[ctxName]; !exists {
			k.failedContexts[targetContext] = true
			return fmt.Errorf("context '%s' not found in kubeconfig", ctxName)
		}

		k.kubeConfig.CurrentContext = ctxName
		k.currentContext = ctxName

		overrides := &clientcmd.ConfigOverrides{}
		if k.env.KubeServer != "" {
			overrides.ClusterInfo.Server = k.env.KubeServer
		}
		overrides.ClusterInfo.InsecureSkipTLSVerify = k.env.KubeInsecureSkipTLSVerify
		restConfig, err = clientcmd.NewDefaultClientConfig(*k.kubeConfig, overrides).ClientConfig()
		if err != nil {
			k.failedContexts[targetContext] = true
			return fmt.Errorf("failed to create rest config: %w", err)
		}
	}

	restConfig.WarningHandler = rest.NoWarnings{}

	clientset, err := kubernetes.NewForConfig(restConfig)
	if err != nil {
		k.failedContexts[targetContext] = true
		return fmt.Errorf("failed to create clientset: %w", err)
	}

	k.config = restConfig
	k.clientset = clientset
	k.dynamicClient = nil
	delete(k.failedContexts, targetContext)
	
	// Clear managed resources cache when context changes
	k.managedResourcesCache = make(map[string]map[string]interface{})
	k.managedResourcesCacheTime = make(map[string]time.Time)

	if k.isInCluster() {
		k.logger.Infof("Kubernetes client initialized with context: %s", k.currentContext)
	} else {
		k.logger.Infof("Kubernetes client initialized with context: %s", ctxName)
	}
	return nil
}

func (k *KubernetesService) IsConnected(ctxName string) (bool, error) {
	originalContext := k.GetCurrentContext()
	
	if err := k.SetContext(ctxName); err != nil {
		return false, err
	}

	clientset, err := k.GetClientset()
	if err != nil {
		if originalContext != "" {
			k.SetContext(originalContext)
		}
		return false, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	_, err = clientset.CoreV1().Namespaces().List(ctx, metav1.ListOptions{Limit: 1})
	if originalContext != "" && originalContext != ctxName {
		k.SetContext(originalContext)
	}
	
	if err != nil {
		return false, err
	}

	return true, nil
}

func (k *KubernetesService) AddKubeConfig(kubeConfigYAML string) ([]string, error) {
	if k.isInCluster() {
		return nil, fmt.Errorf("cannot add contexts in in-cluster mode")
	}

	newConfig, err := clientcmd.Load([]byte(kubeConfigYAML))
	if err != nil {
		return nil, fmt.Errorf("failed to parse kubeconfig: %w", err)
	}

	if err := k.loadKubeConfig(); err != nil {
		return nil, err
	}

	k.mu.Lock()
	defer k.mu.Unlock()

	addedContexts := []string{}
	for name, context := range newConfig.Contexts {
		if _, exists := k.kubeConfig.Contexts[name]; !exists {
			k.kubeConfig.Contexts[name] = context
			addedContexts = append(addedContexts, name)
		}
	}

	for name, cluster := range newConfig.Clusters {
		if _, exists := k.kubeConfig.Clusters[name]; !exists {
			k.kubeConfig.Clusters[name] = cluster
		}
	}

	for name, authInfo := range newConfig.AuthInfos {
		if _, exists := k.kubeConfig.AuthInfos[name]; !exists {
			k.kubeConfig.AuthInfos[name] = authInfo
		}
	}

	kubeConfigPath := k.getKubeConfigPath()
	if err := clientcmd.WriteToFile(*k.kubeConfig, kubeConfigPath); err != nil {
		return nil, fmt.Errorf("failed to write kubeconfig: %w", err)
	}

	k.kubeConfig = nil
	if err := k.loadKubeConfig(); err != nil {
		return nil, err
	}

	return addedContexts, nil
}

func (k *KubernetesService) RemoveContext(ctxName string) error {
	if k.isInCluster() {
		return fmt.Errorf("cannot remove contexts in in-cluster mode")
	}

	if err := k.loadKubeConfig(); err != nil {
		return err
	}

	k.mu.Lock()
	defer k.mu.Unlock()

	if _, exists := k.kubeConfig.Contexts[ctxName]; !exists {
		return fmt.Errorf("context '%s' not found", ctxName)
	}

	context := k.kubeConfig.Contexts[ctxName]
	clusterName := context.Cluster
	userName := context.AuthInfo

	delete(k.kubeConfig.Contexts, ctxName)

	if k.kubeConfig.CurrentContext == ctxName {
		if len(k.kubeConfig.Contexts) > 0 {
			for name := range k.kubeConfig.Contexts {
				k.kubeConfig.CurrentContext = name
				break
			}
		} else {
			k.kubeConfig.CurrentContext = ""
		}
	}

	clusterStillUsed := false
	userStillUsed := false

	for _, ctx := range k.kubeConfig.Contexts {
		if ctx.Cluster == clusterName {
			clusterStillUsed = true
		}
		if ctx.AuthInfo == userName {
			userStillUsed = true
		}
		if clusterStillUsed && userStillUsed {
			break
		}
	}

	if !clusterStillUsed && clusterName != "" {
		delete(k.kubeConfig.Clusters, clusterName)
	}

	if !userStillUsed && userName != "" {
		delete(k.kubeConfig.AuthInfos, userName)
	}

	kubeConfigPath := k.getKubeConfigPath()
	if err := clientcmd.WriteToFile(*k.kubeConfig, kubeConfigPath); err != nil {
		return fmt.Errorf("failed to write kubeconfig: %w", err)
	}

	k.kubeConfig = nil
	if err := k.loadKubeConfig(); err != nil {
		return err
	}

	return nil
}

