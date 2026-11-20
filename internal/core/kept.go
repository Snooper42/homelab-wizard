package core

import (
	"os"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/catalog"
	"github.com/Snooper42/homelab-wizard/internal/kept"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// Secrets are the passwords and keys of the installed apps that a person
// keeps in their password manager (Sign-in details' groups): a login's
// secret, a key to paste into another app, what opens the backups, and the
// API key an app keeps itself once it has made it. User names and emails
// aren't counted, nor anything not set yet.
func Secrets(root string, c *catalog.Catalog, st *api.Status) []kept.Secret {
	if c == nil || st == nil {
		return nil
	}
	env := Env(root)
	example := settings.SecretKeys(root)
	set := func(k string) bool {
		v := strings.TrimSpace(env[k])
		return v != "" && !strings.HasPrefix(v, "__")
	}
	installed := map[string]bool{}
	for _, a := range st.Apps {
		if a.State != "missing" {
			installed[a.ID] = true
		}
	}
	home, _ := os.UserHomeDir()
	var out []kept.Secret
	for _, a := range c.Apps {
		if !installed[a.ID] {
			continue
		}
		name := a.Name()
		add := func(k string, recovery bool) {
			if set(k) {
				out = append(out, kept.Secret{App: a.ID, Key: k, Label: name + ": " + words(k), Recovery: recovery})
			}
		}
		for _, k := range a.Meta.Login {
			if settings.IsSecret(k, "") || example[k] {
				add(k, false)
			}
		}
		for _, k := range a.Meta.Keys {
			add(k, false)
		}
		for _, k := range a.Meta.Recovery {
			add(k, true)
		}
		if f := a.Meta.KeyFile; f != "" {
			dir := wiring.AppsFrom(c, func(id string) bool { return id == a.ID }, env, home)[a.ID].ConfigDir
			if _, err := wiring.KeptKey(dir, f); err == nil {
				out = append(out, kept.Secret{App: a.ID, Key: "app:" + a.ID, Label: name + ": its API key"})
			}
		}
	}
	return out
}

// words is a setting's name in lower-case words (DUPLICATI_PASSPHRASE:
// "duplicati passphrase").
func words(k string) string { return strings.ToLower(strings.ReplaceAll(k, "_", " ")) }
