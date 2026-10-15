package sso

import "testing"

func TestVikunjaProvider(t *testing.T) {
	a, ok := Get("vikunja")
	if !ok {
		t.Fatal("vikunja is not connected")
	}
	env := a.Env(Client{ID: "vikunja", Secret: "s3cret", Issuer: "https://id.example.com", Address: "https://todo.example.com"})
	for k, want := range map[string]string{
		"VIKUNJA_AUTH_OPENID_ENABLED":                         "true",
		"VIKUNJA_AUTH_OPENID_PROVIDERS_POCKETID_AUTHURL":      "https://id.example.com",
		"VIKUNJA_AUTH_OPENID_PROVIDERS_POCKETID_CLIENTSECRET": "s3cret",
	} {
		if env[k] != want {
			t.Errorf("%s = %q", k, env[k])
		}
	}
	if got := a.CallbackURLs("https://todo.example.com/"); len(got) != 1 || got[0] != "https://todo.example.com/auth/openid/pocketid" {
		t.Errorf("callbacks %v", got)
	}
}
