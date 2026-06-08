package services

import (
	"encoding/json"
	"time"

	"crossview-go-server/lib"
	"crossview-go-server/models"
)

type MetricsCollector struct {
	logger     lib.Logger
	k8sService KubernetesServiceInterface
	metricRepo *models.ResourceMetricRepository
	interval   time.Duration
	retention  time.Duration
	stopCh     chan struct{}
}

func NewMetricsCollector(
	logger lib.Logger,
	k8sService KubernetesServiceInterface,
	metricRepo *models.ResourceMetricRepository,
	intervalSeconds int,
	retentionDays int,
) *MetricsCollector {
	if intervalSeconds <= 0 {
		intervalSeconds = 300
	}
	if retentionDays <= 0 {
		retentionDays = 90
	}

	return &MetricsCollector{
		logger:     logger,
		k8sService: k8sService,
		metricRepo: metricRepo,
		interval:   time.Duration(intervalSeconds) * time.Second,
		retention:  time.Duration(retentionDays) * 24 * time.Hour,
		stopCh:     make(chan struct{}),
	}
}

func (mc *MetricsCollector) Start() {
	mc.logger.Info("Starting metrics collector")
	go mc.run()
}

func (mc *MetricsCollector) Stop() {
	close(mc.stopCh)
}

func (mc *MetricsCollector) run() {
	ticker := time.NewTicker(mc.interval)
	defer ticker.Stop()

	mc.collect()

	for {
		select {
		case <-ticker.C:
			mc.collect()
		case <-mc.stopCh:
			mc.logger.Info("Stopping metrics collector")
			return
		}
	}
}

func (mc *MetricsCollector) collect() {
	contextName := mc.k8sService.GetCurrentContext()
	if contextName == "" {
		return
	}

	metric := &models.ResourceMetric{
		Context:   contextName,
		Timestamp: time.Now(),
	}

	resourceTypes := []struct {
		apiVersion string
		kind       string
	}{
		{"apiextensions.crossplane.io/v1", "Composition"},
		{"apiextensions.crossplane.io/v1", "CompositeResourceDefinition"},
		{"pkg.crossplane.io/v1", "Provider"},
		{"pkg.crossplane.io/v1", "Function"},
	}

	kindCounts := make(map[string]int)
	providerHealth := make(map[string]string)

	for _, rt := range resourceTypes {
		result, err := mc.k8sService.GetResources(rt.apiVersion, rt.kind, "", contextName, "", nil, "")
		if err != nil {
			continue
		}

		items, _ := result["items"].([]interface{})
		kindCounts[rt.kind] = len(items)
		metric.TotalResources += len(items)

		for _, item := range items {
			resource, ok := item.(map[string]interface{})
			if !ok {
				continue
			}

			status := extractStatus(resource)
			switch status {
			case "healthy":
				metric.HealthyCount++
				metric.SyncedCount++
			case "degraded":
				metric.DegradedCount++
				metric.UnsyncedCount++
			default:
				metric.DegradedCount++
			}

			if rt.kind == "Provider" {
				metadata, _ := resource["metadata"].(map[string]interface{})
				name, _ := metadata["name"].(string)
				if name != "" {
					providerHealth[name] = status
				}
			}
		}
	}

	kindJSON, _ := json.Marshal(kindCounts)
	metric.ResourcesByKind = string(kindJSON)

	providerJSON, _ := json.Marshal(providerHealth)
	metric.ProviderHealth = string(providerJSON)

	if err := mc.metricRepo.Create(metric); err != nil {
		mc.logger.Errorf("Failed to store metric: %s", err.Error())
		return
	}

	cutoff := time.Now().Add(-mc.retention)
	if err := mc.metricRepo.DeleteOlderThan(cutoff); err != nil {
		mc.logger.Warnf("Failed to clean old metrics: %s", err.Error())
	}

	mc.logger.Infof("Collected metrics: total=%d healthy=%d degraded=%d", metric.TotalResources, metric.HealthyCount, metric.DegradedCount)
}
