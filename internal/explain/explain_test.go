package explain

import (
	"context"
	"encoding/json"
	"errors"
	"net"
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

// On Linux, Ollama may listen on Docker's own address only, so that the
// containers reach it and the home network does not: it is found there
// when 127.0.0.1 does not answer, and OLLAMA_HOST still wins.
func TestBaseFindsOllamaOnDockersAddress(t *testing.T) {
	listening := map[string]bool{}
	bridge, answers = func() string { return "172.17.0.1" }, func(addr string) bool { return listening[addr] }
	defer func() { bridge, answers = dockerBridge, dials }()
	t.Setenv("OLLAMA_HOST", "")
	for _, c := range []struct {
		on   []string
		want string
	}{
		{nil, "http://127.0.0.1:11434"}, // nowhere: the default, for the error to name
		{[]string{"127.0.0.1:11434"}, "http://127.0.0.1:11434"},
		{[]string{"172.17.0.1:11434"}, "http://172.17.0.1:11434"},
		{[]string{"127.0.0.1:11434", "172.17.0.1:11434"}, "http://127.0.0.1:11434"},
	} {
		listening = map[string]bool{}
		for _, a := range c.on {
			listening[a] = true
		}
		if got := Base(); got != c.want {
			t.Errorf("listening on %v: Base() = %q, want %q", c.on, got, c.want)
		}
	}
	listening = map[string]bool{"172.17.0.1:11434": true}
	t.Setenv("OLLAMA_HOST", "studio.local")
	if got := Base(); got != "http://studio.local:11434" {
		t.Errorf("OLLAMA_HOST is not followed: %q", got)
	}
	bridge = func() string { return "" } // no Docker network here (a Mac)
	t.Setenv("OLLAMA_HOST", "")
	if got := Base(); got != "http://127.0.0.1:11434" {
		t.Errorf("without docker0: %q", got)
	}
}

// The real checks behind bridge and answers: something listening is
// found and a closed port is not; docker0's address is an IPv4 address,
// or nothing where there is no docker0 (a Mac, or Docker run as you).
func TestDialsAndDockerBridge(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	if !dials(addr) {
		t.Errorf("%s listens but does not answer", addr)
	}
	l.Close()
	if dials(addr) {
		t.Errorf("%s is closed but answers", addr)
	}
	if b := dockerBridge(); b != "" && net.ParseIP(b).To4() == nil {
		t.Errorf("docker0's address %q is not IPv4", b)
	}
	v6 := &net.IPNet{IP: net.ParseIP("fe80::42:acff:fe11:1"), Mask: net.CIDRMask(64, 128)}
	v4 := &net.IPNet{IP: net.ParseIP("172.17.0.1"), Mask: net.CIDRMask(16, 32)}
	if got := firstIPv4([]net.Addr{v6, v4}); got != "172.17.0.1" {
		t.Errorf("firstIPv4 = %q", got)
	}
	if got := firstIPv4([]net.Addr{v6}); got != "" {
		t.Errorf("firstIPv4 without one = %q", got)
	}
}

func TestUp(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.Write([]byte("Ollama is running")) }))
	t.Setenv("OLLAMA_HOST", srv.URL)
	if !Up(context.Background()) {
		t.Error("Ollama answering is not up")
	}
	srv.Close()
	if Up(context.Background()) {
		t.Error("Ollama gone is still up")
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
