package middlewares

import (
	"crossview-go-server/models"

	"github.com/gin-contrib/sessions"
)

func SetSSOIdentity(session sessions.Session, user *models.User) {
	session.Clear()
	session.Set("authMethod", "sso")
	session.Set("userId", user.ID)
	session.Set("username", user.Username)
	session.Set("email", user.Email)
	session.Set("userRole", user.Role)
}

func SSOIdentity(session sessions.Session) *models.User {
	if session.Get("authMethod") != "sso" {
		return nil
	}
	id, validID := session.Get("userId").(uint)
	username, _ := session.Get("username").(string)
	email, _ := session.Get("email").(string)
	role, _ := session.Get("userRole").(string)
	if !validID || id == 0 || (username == "" && email == "") || role == "" {
		return nil
	}
	return &models.User{ID: id, Username: username, Email: email, Role: role}
}
