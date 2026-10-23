package explain

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestBase(t *testing.T) {
	for in, want := range map[string]string{
		"":                   "http://127.0.0.1:11434",
		"0.0.0.0":            "http://127.0.0.1:11434",
		"0.0.0.0:9999":       "http://127.0.0.1:9999",
		"studio.local":       "http://studio.local:11434",
		"http://10.0.0.5:1/": "http://10.0.0.5:1",
	} {
		t.Setenv("OLLAMA_HOST", in)
		if got := Base(); got != want {
			t.Errorf("Base(%q) = %q, want %q", in, got, want)
		}
	}
}

func TestRedactAndTail(t *testing.T) {
	log := "db: connecting to postgres://paperless:hunter2@db:5432/x\nPASSWORD=s3cret ok\nAuthorization: Bearer abcdefghijkl\n{\"api_key\": \"k-123\"}"
	got := Redact(log)
	for _, leak := range []string{"hunter2", "s3cret", "abcdefghijkl", "k-123"} {
		if strings.Contains(got, leak) {
			t.Errorf("%q left in:\n%s", leak, got)
		}
	}
	if !strings.Contains(got, "postgres://paperless:…@db") {
		t.Errorf("the address lost its shape:\n%s", got)
	}
	if got := Tail("one\ntwo\nthree\n", 8); got != "three\n" {
		t.Errorf("Tail = %q", got)
	}
}

func TestModelAndExplain(t *testing.T) {
	var asked map[string]any
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/api/tags":
			w.Write([]byte(`{"models":[{"name":"nomic-embed-text:latest"},{"name":"mistral:7b"},{"name":"llama3.2:latest"}]}`))
		case "/api/chat":
			_ = json.NewDecoder(r.Body).Decode(&asked)
			w.Write([]byte(`{"message":{"role":"assistant","content":"  The database refused the password.  "}}`))
		}
	}))
	defer srv.Close()
	t.Setenv("OLLAMA_HOST", srv.URL)
	ctx := context.Background()
	if m, err := Model(ctx, ""); err != nil || m != "llama3.2:latest" {
		t.Errorf("Model = %q, %v", m, err)
	}
	if m, _ := Model(ctx, "mistral:7b"); m != "mistral:7b" {
		t.Errorf("the chosen model: %q", m)
	}
	got, err := Explain(ctx, "llama3.2:latest", "Paperless", "FATAL: password authentication failed\nPASSWORD=x")
	if err != nil || got != "The database refused the password." {
		t.Fatalf("Explain = %q, %v", got, err)
	}
	msgs := asked["messages"].([]any)
	user := msgs[1].(map[string]any)["content"].(string)
	if asked["stream"] != false || !strings.Contains(user, "The app is Paperless") || !strings.Contains(user, "password authentication failed") || strings.Contains(user, "PASSWORD=x") {
		t.Errorf("asked %v", asked)
	}
	if got, _ := Explain(ctx, "m", "X", " \n"); !strings.Contains(got, "empty") {
		t.Errorf("an empty log: %q", got)
	}
}

func TestNoOllama(t *testing.T) {
	t.Setenv("OLLAMA_HOST", "http://127.0.0.1:1")
	if _, err := Model(context.Background(), ""); !errors.Is(err, ErrNoOllama) {
		t.Errorf("err = %v", err)
	}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{"models":[]}`)) }))
	defer srv.Close()
	t.Setenv("OLLAMA_HOST", srv.URL)
	if _, err := Model(context.Background(), ""); !errors.Is(err, ErrNoModel) {
		t.Errorf("no models: %v", err)
	}
}
