package notify

import (
	"context"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestAppLinksMatchTheIPhoneApp(t *testing.T) {
	// The forms apple-client/Shared/Models/DeepLink.swift reads.
	for got, want := range map[string]string{
		AppLink("radarr", ""):        "homelab://app/radarr",
		AppLink("radarr", "restart"): "homelab://app/radarr?do=restart",
		AppLink("radarr", "logs"):    "homelab://app/radarr?do=logs",
		StatusLink:                   "homelab://status",
	} {
		if got != want {
			t.Errorf("link %q, want %q", got, want)
		}
	}
	for _, id := range []string{"", "-radarr", "rad arr", "radarr/../x", "radarr?do=stop", "ïmmich", strings.Repeat("a", 65)} {
		if AppLink(id, "restart") != "" {
			t.Errorf("an id that isn't one, %q, made a link", id)
		}
	}
	if AppLink("radarr", "delete") != "" {
		t.Error("an action the app doesn't take made a link")
	}
}

func TestButtonsForApps(t *testing.T) {
	isApp := func(id string) bool { return id == "radarr" || id == "sonarr" }
	one := DownButtons([]string{"radarr", "disk space (/)"}, isApp)
	if len(one) != 2 || one[0] != (Action{"Restart", "homelab://app/radarr?do=restart"}) || one[1] != (Action{"Show Logs", "homelab://app/radarr?do=logs"}) {
		t.Fatalf("one app down: %+v", one)
	}
	if many := DownButtons([]string{"radarr", "sonarr"}, isApp); len(many) != 1 || many[0] != (Action{"Open Status", StatusLink}) {
		t.Fatalf("two apps down: %+v", many)
	}
	if none := DownButtons([]string{"docker engine", "disk space (/)"}, isApp); none != nil {
		t.Fatalf("no app down, no buttons: %+v", none)
	}
	if loop := StoppedButtons([]string{"radarr"}, isApp); len(loop) != 2 || loop[0].Label != "Show Logs" || loop[1] != (Action{"Start", "homelab://app/radarr?do=start"}) {
		t.Fatalf("a stopped app: %+v", loop)
	}
}

func TestPublishButtons(t *testing.T) {
	var got string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { got = r.Header.Get("Actions") }))
	defer srv.Close()
	c := New(srv.URL)
	m := Message{Title: "Homelab: an app is down", Body: "radarr: no answer", Actions: DownButtons([]string{"radarr"}, func(string) bool { return true })}
	if err := c.Publish(context.Background(), "tunnel-watchdog", m); err != nil {
		t.Fatal(err)
	}
	if want := "action=view, label=Restart, url=homelab://app/radarr?do=restart; action=view, label=Show Logs, url=homelab://app/radarr?do=logs"; got != want {
		t.Fatalf("Actions header %q, want %q", got, want)
	}
	// Only the app's own links, and only what ntfy's header can carry: a
	// button that isn't is left off, never sent half-read.
	m.Actions = []Action{
		{"Open", "https://example.com"},
		{"Re,start", "homelab://status"},
		{"Re=start", "homelab://status"},
		{"Fine", "homelab://status; view, Evil, https://evil.example"},
		{"", "homelab://status"},
		{"Open Status", StatusLink},
	}
	if err := c.Publish(context.Background(), "tunnel-watchdog", m); err != nil || got != "action=view, label=Open Status, url=homelab://status" {
		t.Fatalf("Actions header %q (%v)", got, err)
	}
	// ntfy takes three at most.
	m.Actions = []Action{{"A", StatusLink}, {"B", StatusLink}, {"C", StatusLink}, {"D", StatusLink}}
	if err := c.Publish(context.Background(), "tunnel-watchdog", m); err != nil || strings.Count(got, "action=view,") != 3 {
		t.Fatalf("Actions header %q (%v)", got, err)
	}
	m.Actions = nil
	if err := c.Publish(context.Background(), "tunnel-watchdog", m); err != nil || got != "" {
		t.Fatalf("no buttons, no header: %q (%v)", got, err)
	}
}
