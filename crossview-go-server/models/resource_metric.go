package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type ResourceMetric struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	Context         string    `gorm:"index;not null" json:"context"`
	Timestamp       time.Time `gorm:"index;not null" json:"timestamp"`
	TotalResources  int       `json:"totalResources"`
	HealthyCount    int       `json:"healthyCount"`
	DegradedCount   int       `json:"degradedCount"`
	SyncedCount     int       `json:"syncedCount"`
	UnsyncedCount   int       `json:"unsyncedCount"`
	ResourcesByKind string    `gorm:"type:text" json:"resourcesByKind"`
	ProviderHealth  string    `gorm:"type:text" json:"providerHealth"`
}

func (ResourceMetric) TableName() string {
	return "resource_metrics"
}

type ResourceMetricRepository struct {
	db *gorm.DB
}

func NewResourceMetricRepository(db *gorm.DB) *ResourceMetricRepository {
	return &ResourceMetricRepository{db: db}
}

func (r *ResourceMetricRepository) Create(metric *ResourceMetric) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(metric).Error
}

func (r *ResourceMetricRepository) FindByTimeRange(contextName string, from, to time.Time, limit int) ([]ResourceMetric, error) {
	if r.db == nil {
		return nil, nil
	}
	var metrics []ResourceMetric
	query := r.db.Where("context = ? AND timestamp BETWEEN ? AND ?", contextName, from, to)
	err := query.Order("timestamp ASC").Limit(limit).Find(&metrics).Error
	return metrics, err
}

func (r *ResourceMetricRepository) FindLatest(contextName string) (*ResourceMetric, error) {
	if r.db == nil {
		return nil, nil
	}
	var metric ResourceMetric
	err := r.db.Where("context = ?", contextName).Order("timestamp DESC").First(&metric).Error
	if err != nil {
		return nil, err
	}
	return &metric, nil
}

func (r *ResourceMetricRepository) DeleteOlderThan(before time.Time) error {
	if r.db == nil {
		return nil
	}
	return r.db.Where("timestamp < ?", before).Delete(&ResourceMetric{}).Error
}

func (r *ResourceMetricRepository) AutoMigrate() error {
	if r.db == nil {
		return nil
	}
	sqlDB, err := r.db.DB()
	if err != nil {
		return fmt.Errorf("failed to get underlying SQL DB: %w", err)
	}
	if err := sqlDB.Ping(); err != nil {
		return fmt.Errorf("database ping failed: %w", err)
	}
	return r.db.AutoMigrate(&ResourceMetric{})
}
