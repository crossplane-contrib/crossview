package models

import (
	"crypto/rand"
	"fmt"
	"strings"
	"time"

	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Username     string    `gorm:"uniqueIndex;not null" json:"username"`
	Email        string    `gorm:"uniqueIndex;not null" json:"email"`
	PasswordHash string    `gorm:"column:password_hash;not null" json:"-"`
	Role         string    `gorm:"default:user" json:"role"`
	FirstName    *string   `gorm:"column:first_name" json:"first_name,omitempty"`
	LastName     *string   `gorm:"column:last_name" json:"last_name,omitempty"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (User) TableName() string {
	return "users"
}

func (u *User) SetPassword(password string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	u.PasswordHash = string(hash)
	return nil
}

func (u *User) VerifyPassword(password string) bool {
	err := bcrypt.CompareHashAndPassword([]byte(u.PasswordHash), []byte(password))
	return err == nil
}

type UserRepository struct {
	db *gorm.DB
}

func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

func (r *UserRepository) DB() *gorm.DB {
	return r.db
}

func (r *UserRepository) Create(user *User) error {
	if r.db == nil {
		return nil
	}
	return r.db.Create(user).Error
}

func (r *UserRepository) FindByID(id uint) (*User, error) {
	if r.db == nil {
		return nil, nil
	}
	var user User
	err := r.db.Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByUsername(username string) (*User, error) {
	if r.db == nil {
		return nil, nil
	}
	var user User
	err := r.db.Where("username = ?", username).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) FindByEmail(email string) (*User, error) {
	if r.db == nil {
		return nil, nil
	}
	var user User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func (r *UserRepository) Count() (int64, error) {
	if r.db == nil {
		return 0, nil
	}
	var count int64
	err := r.db.Model(&User{}).Count(&count).Error
	return count, err
}

func (r *UserRepository) HasAdmin() (bool, error) {
	if r.db == nil {
		return false, nil
	}
	var count int64
	err := r.db.Model(&User{}).Where("role = ?", "admin").Count(&count).Error
	if err != nil {
		return false, err
	}
	if count > 0 {
		return true, nil
	} else {

	}
	return count > 0, nil
}

func (r *UserRepository) FindAll() ([]User, error) {
	if r.db == nil {
		return nil, nil
	}
	var users []User
	err := r.db.Order("created_at DESC").Find(&users).Error
	return users, err
}

func (r *UserRepository) Update(user *User) error {
	if r.db == nil {
		return nil
	}
	return r.db.Save(user).Error
}

func (r *UserRepository) Delete(id uint) error {
	if r.db == nil {
		return nil
	}
	return r.db.Delete(&User{}, id).Error
}

func (r *UserRepository) AutoMigrate() error {
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

	var tableExists bool
	err = r.db.Raw("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')").Scan(&tableExists).Error
	if err != nil {
		return fmt.Errorf("failed to check if users table exists: %w", err)
	}

	if !tableExists {
		if err := r.db.AutoMigrate(&User{}); err != nil {
			return fmt.Errorf("auto migrate failed: %w", err)
		}
		return nil
	}

	migrator := r.db.Migrator()
	if err := migrator.AutoMigrate(&User{}); err != nil {
		errStr := err.Error()
		if errStr == "insufficient arguments" || errStr == "auto migrate failed: insufficient arguments" {
			return nil
		}
		return fmt.Errorf("auto migrate failed: %w", err)
	}

	return nil
}

func (r *UserRepository) FindOrCreateSSOUser(username, email, firstName, lastName string) (*User, error) {
	if username == "" && email == "" {
		return nil, fmt.Errorf("username or email is required from SSO provider")
	}

	if r.db == nil {
		return &User{
			ID:       hashStringToUint(username + email),
			Username: username,
			Email:    email,
			Role:     "user",
		}, nil
	}

	var user *User
	var err error

	if email != "" {
		user, err = r.FindByEmail(email)
		if err == nil && user != nil {
			return r.updateSSOUserInfo(user, email, firstName, lastName)
		}
	}

	if user == nil && username != "" {
		user, err = r.FindByUsername(username)
		if err == nil && user != nil {
			return r.updateSSOUserInfo(user, email, firstName, lastName)
		}
	}

	if user != nil {
		return user, nil
	}

	hasUsers, _ := r.Count()
	role := "user"
	if hasUsers == 0 {
		role = "admin"
	}

	if username == "" {
		if email != "" {
			if idx := strings.Index(email, "@"); idx > 0 {
				username = email[:idx]
			} else {
				username = "sso_user"
			}
		} else {
			username = "sso_user"
		}
	}
	if email == "" {
		email = fmt.Sprintf("%s@sso.local", username)
	}

	user = &User{
		Username:  username,
		Email:     email,
		Role:      role,
		FirstName: stringPtr(firstName),
		LastName:  stringPtr(lastName),
	}

	randomPassword := generateRandomPassword()
	if err := user.SetPassword(randomPassword); err != nil {
		return nil, err
	}

	if err := r.Create(user); err != nil {
		return nil, err
	}

	return user, nil
}

func (r *UserRepository) updateSSOUserInfo(user *User, email, firstName, lastName string) (*User, error) {
	updated := false

	if email != "" && user.Email != email {
		user.Email = email
		updated = true
	}
	if firstName != "" && (user.FirstName == nil || *user.FirstName != firstName) {
		user.FirstName = stringPtr(firstName)
		updated = true
	}
	if lastName != "" && (user.LastName == nil || *user.LastName != lastName) {
		user.LastName = stringPtr(lastName)
		updated = true
	}

	if updated {
		if err := r.Update(user); err != nil {
			return nil, err
		}
	}

	return user, nil
}

func stringPtr(s string) *string {
	if s == "" {
		return nil
	}
	return &s
}

func generateRandomPassword() string {
	const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, 32)
	rand.Read(b)
	for i := range b {
		b[i] = charset[b[i]%byte(len(charset))]
	}
	return string(b)
}

func hashStringToUint(s string) uint {
	var h uint32
	for i := 0; i < len(s); i++ {
		h = 31*h + uint32(s[i])
	}
	return uint(h)
}
