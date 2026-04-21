package services

import (
	"fmt"

	"k8s.io/client-go/dynamic"
)

type TreeNode struct {
	APIVersion string                 `json:"apiVersion"`
	Kind       string                 `json:"kind"`
	Name       string                 `json:"name"`
	Namespace  string                 `json:"namespace,omitempty"`
	Status     string                 `json:"status"`
	Resource   map[string]interface{} `json:"resource,omitempty"`
	Children   []*TreeNode            `json:"children,omitempty"`
	RelType    string                 `json:"relType,omitempty"`
}

func (k *KubernetesService) GetResourceTree(apiVersion, kind, name, namespace, contextName string, maxDepth int) (*TreeNode, error) {
	if contextName != "" {
		if err := k.SetContext(contextName); err != nil {
			return nil, fmt.Errorf("failed to set context: %w", err)
		}
	}

	config, err := k.GetConfig()
	if err != nil {
		return nil, fmt.Errorf("failed to get kubernetes config: %w", err)
	}

	dynClient, err := dynamic.NewForConfig(config)
	if err != nil {
		return nil, fmt.Errorf("failed to create dynamic client: %w", err)
	}

	if maxDepth <= 0 {
		maxDepth = 5
	}

	visited := make(map[string]bool)
	root, err := k.buildTreeNode(dynClient, apiVersion, kind, name, namespace, contextName, "", maxDepth, visited)
	if err != nil {
		return nil, err
	}

	return root, nil
}

func (k *KubernetesService) buildTreeNode(dynClient dynamic.Interface, apiVersion, kind, name, namespace, contextName, relType string, depth int, visited map[string]bool) (*TreeNode, error) {
	nodeKey := fmt.Sprintf("%s/%s/%s/%s", apiVersion, kind, namespace, name)
	if visited[nodeKey] || depth <= 0 {
		return &TreeNode{
			APIVersion: apiVersion,
			Kind:       kind,
			Name:       name,
			Namespace:  namespace,
			RelType:    relType,
			Status:     "unknown",
		}, nil
	}
	visited[nodeKey] = true

	resource, err := k.GetResource(apiVersion, kind, name, namespace, contextName, "")
	if err != nil {
		return &TreeNode{
			APIVersion: apiVersion,
			Kind:       kind,
			Name:       name,
			Namespace:  namespace,
			RelType:    relType,
			Status:     "error",
		}, nil
	}

	node := &TreeNode{
		APIVersion: apiVersion,
		Kind:       kind,
		Name:       name,
		Namespace:  namespace,
		RelType:    relType,
		Status:     extractStatus(resource),
		Resource:   resource,
	}

	spec, _ := resource["spec"].(map[string]interface{})
	if spec == nil {
		return node, nil
	}

	if resourceRef, ok := spec["resourceRef"].(map[string]interface{}); ok {
		child, err := k.resolveRef(dynClient, resourceRef, contextName, "compositeResource", depth-1, visited)
		if err == nil && child != nil {
			node.Children = append(node.Children, child)
		}
	}

	if resourceRefs, ok := spec["resourceRefs"].([]interface{}); ok {
		for _, ref := range resourceRefs {
			refMap, ok := ref.(map[string]interface{})
			if !ok {
				continue
			}
			child, err := k.resolveRef(dynClient, refMap, contextName, "managedResource", depth-1, visited)
			if err == nil && child != nil {
				node.Children = append(node.Children, child)
			}
		}
	}

	if compositionRef, ok := spec["compositionRef"].(map[string]interface{}); ok {
		compName, _ := compositionRef["name"].(string)
		if compName != "" {
			child, err := k.buildTreeNode(dynClient, "apiextensions.crossplane.io/v1", "Composition", compName, "", contextName, "composition", depth-1, visited)
			if err == nil && child != nil {
				node.Children = append(node.Children, child)
			}
		}
	}

	if claimRef, ok := spec["claimRef"].(map[string]interface{}); ok {
		child, err := k.resolveRef(dynClient, claimRef, contextName, "claim", depth-1, visited)
		if err == nil && child != nil {
			node.Children = append(node.Children, child)
		}
	}

	return node, nil
}

func (k *KubernetesService) resolveRef(dynClient dynamic.Interface, ref map[string]interface{}, contextName, relType string, depth int, visited map[string]bool) (*TreeNode, error) {
	refName, _ := ref["name"].(string)
	refNamespace, _ := ref["namespace"].(string)
	refKind, _ := ref["kind"].(string)
	refAPIVersion, _ := ref["apiVersion"].(string)

	if refName == "" || refKind == "" {
		return nil, fmt.Errorf("incomplete ref")
	}

	if refAPIVersion == "" {
		refAPIVersion = guessAPIVersion(refKind)
	}

	return k.buildTreeNode(dynClient, refAPIVersion, refKind, refName, refNamespace, contextName, relType, depth, visited)
}

func extractStatus(resource map[string]interface{}) string {
	status, ok := resource["status"].(map[string]interface{})
	if !ok {
		return "unknown"
	}

	conditions, ok := status["conditions"].([]interface{})
	if !ok {
		return "unknown"
	}

	synced := false
	ready := false

	for _, c := range conditions {
		cond, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		condType, _ := cond["type"].(string)
		condStatus, _ := cond["status"].(string)

		if condType == "Synced" && condStatus == "True" {
			synced = true
		}
		if condType == "Ready" && condStatus == "True" {
			ready = true
		}
		if condType == "Healthy" && condStatus == "True" {
			return "healthy"
		}
	}

	if synced && ready {
		return "healthy"
	}
	if synced || ready {
		return "degraded"
	}

	if len(conditions) > 0 {
		return "degraded"
	}

	return "unknown"
}

func guessAPIVersion(kind string) string {
	crossplaneTypes := map[string]string{
		"Composition":                  "apiextensions.crossplane.io/v1",
		"CompositeResourceDefinition":  "apiextensions.crossplane.io/v1",
		"Provider":                     "pkg.crossplane.io/v1",
		"Function":                     "pkg.crossplane.io/v1",
		"ProviderConfig":               "pkg.crossplane.io/v1",
	}

	if av, ok := crossplaneTypes[kind]; ok {
		return av
	}

	return ""
}

