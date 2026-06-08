package models

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

type ResourceEvent struct {
	ID         uint      `gorm:"primaryKey" json:"id"`
	Context    string    `gorm:"index;not null" json:"context"`
	APIVersion string    `gorm:"column:api_version;not null" json:"apiVersion"`
	Kind       string    `gorm:"index;not null" json:"kind"`
	Name       string    `gorm:"index;not null" json:"name"`
	Namespace  string    `json:"namespace,omitempty"`
	EventType  string    `gorm:"not null" json:"eventType"`
	Snapshot   string    `gorm:"type:text" json:"snapshot,omitempty"`
	CreatedAt  time.Time `gorm:"index" json:"createdAt"`
}

func (ResourceEvent) TableName() string {
	return "resource_events"
}

type ResourceEventRepository struct {
	db *gorm.DB
}

func NewResourceEventRepository(db *gorm.DB) *ResourceEventRepository {
	return &ResourceEventRepository{db: db}
}

func (r *ResourceEventRepository) Create(event *ResourceEvent) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(event).Error
}

func (r *ResourceEventRepository) FindByResource(apiVersion, kind, name, namespace, contextName string, limit int) ([]ResourceEvent, error) {
	if r.db == nil {
		return nil, nil
	}
	var events []ResourceEvent
	query := r.db.Where("api_version = ? AND kind = ? AND name = ? AND context = ?", apiVersion, kind, name, contextName)
	if namespace != "" {
		query = query.Where("namespace = ?", namespace)
	}
	err := query.Order("created_at DESC").Limit(limit).Find(&events).Error
	return events, err
}

func (r *ResourceEventRepository) FindRecent(contextName string, limit int) ([]ResourceEvent, error) {
	if r.db == nil {
		return nil, nil
	}
	var events []ResourceEvent
	query := r.db
	if contextName != "" {
		query = query.Where("context = ?", contextName)
	}
	err := query.Order("created_at DESC").Limit(limit).Find(&events).Error
	return events, err
}

func (r *ResourceEventRepository) DeleteOlderThan(before time.Time) error {
	if r.db == nil {
		return nil
	}
	return r.db.Where("created_at < ?", before).Delete(&ResourceEvent{}).Error
}

func (r *ResourceEventRepository) AutoMigrate() error {
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
	return r.db.AutoMigrate(&ResourceEvent{})
}
