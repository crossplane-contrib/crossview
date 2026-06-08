package services

import (
	"fmt"
	"reflect"
	"strings"
)

type FieldDiff struct {
	Path    string      `json:"path"`
	Desired interface{} `json:"desired"`
	Actual  interface{} `json:"actual"`
}

func (k *KubernetesService) GetResourceDrift(apiVersion, kind, name, namespace, contextName string) (map[string]interface{}, error) {
	if contextName != "" {
		if err := k.SetContext(contextName); err != nil {
			return nil, fmt.Errorf("failed to set context: %w", err)
		}
	}

	resource, err := k.GetResource(apiVersion, kind, name, namespace, contextName, "")
	if err != nil {
		return nil, fmt.Errorf("failed to get resource: %w", err)
	}

	result := map[string]interface{}{
		"hasDrift":        false,
		"syncedCondition": nil,
		"readyCondition":  nil,
		"fieldDiffs":      []FieldDiff{},
		"driftSummary":    "No drift detected",
	}

	status, _ := resource["status"].(map[string]interface{})
	if status == nil {
		result["driftSummary"] = "No status available"
		return result, nil
	}

	conditions, _ := status["conditions"].([]interface{})
	var syncedCondition map[string]interface{}
	var readyCondition map[string]interface{}

	for _, c := range conditions {
		cond, ok := c.(map[string]interface{})
		if !ok {
			continue
		}
		condType, _ := cond["type"].(string)
		if condType == "Synced" {
			syncedCondition = cond
		}
		if condType == "Ready" {
			readyCondition = cond
		}
	}

	if syncedCondition != nil {
		result["syncedCondition"] = syncedCondition
	}
	if readyCondition != nil {
		result["readyCondition"] = readyCondition
	}

	hasDrift := false
	var driftReasons []string

	if syncedCondition != nil {
		syncedStatus, _ := syncedCondition["status"].(string)
		if syncedStatus == "False" {
			hasDrift = true
			reason, _ := syncedCondition["reason"].(string)
			message, _ := syncedCondition["message"].(string)
			driftReasons = append(driftReasons, fmt.Sprintf("Not synced: %s - %s", reason, message))
		}
	}

	if readyCondition != nil {
		readyStatus, _ := readyCondition["status"].(string)
		if readyStatus == "False" {
			reason, _ := readyCondition["reason"].(string)
			message, _ := readyCondition["message"].(string)
			driftReasons = append(driftReasons, fmt.Sprintf("Not ready: %s - %s", reason, message))
		}
	}

	spec, _ := resource["spec"].(map[string]interface{})
	fieldDiffs := compareSpecAndStatus(spec, status)
	if len(fieldDiffs) > 0 {
		hasDrift = true
		result["fieldDiffs"] = fieldDiffs
		driftReasons = append(driftReasons, fmt.Sprintf("%d field(s) differ between desired and actual state", len(fieldDiffs)))
	}

	result["hasDrift"] = hasDrift
	if hasDrift {
		result["driftSummary"] = strings.Join(driftReasons, "; ")
	}

	return result, nil
}

func compareSpecAndStatus(spec, status map[string]interface{}) []FieldDiff {
	if spec == nil || status == nil {
		return nil
	}

	forProvider, _ := spec["forProvider"].(map[string]interface{})
	atProvider, _ := status["atProvider"].(map[string]interface{})

	if forProvider == nil || atProvider == nil {
		return nil
	}

	var diffs []FieldDiff
	diffMaps(forProvider, atProvider, "spec.forProvider", &diffs)
	return diffs
}

func diffMaps(desired, actual map[string]interface{}, prefix string, diffs *[]FieldDiff) {
	for key, desiredVal := range desired {
		path := prefix + "." + key
		actualVal, exists := actual[key]

		if !exists {
			*diffs = append(*diffs, FieldDiff{
				Path:    path,
				Desired: desiredVal,
				Actual:  nil,
			})
			continue
		}

		desiredMap, desiredIsMap := desiredVal.(map[string]interface{})
		actualMap, actualIsMap := actualVal.(map[string]interface{})

		if desiredIsMap && actualIsMap {
			diffMaps(desiredMap, actualMap, path, diffs)
			continue
		}

		if !reflect.DeepEqual(desiredVal, actualVal) {
			*diffs = append(*diffs, FieldDiff{
				Path:    path,
				Desired: desiredVal,
				Actual:  actualVal,
			})
		}
	}
}
