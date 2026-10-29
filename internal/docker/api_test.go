package docker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/dockerapi"
)

func fakeEngine(t *testing.T, h http.HandlerFunc) *dockerapi.Client {
	t.Helper()
	// Each test starts with the API rested, whatever the last one left.
	fallbackMu.Lock()
	fallback = Fallback{}
	fallbackMu.Unlock()
	t.Cleanup(func() { fallbackMu.Lock(); fallback = Fallback{}; fallbackMu.Unlock() })
	l, addr, host := listenEngine(t)
	srv := &http.Server{Handler: h}
	go srv.Serve(l)
	t.Cleanup(func() { srv.Close() })
	engineHosts[addr] = host
	return dockerapi.New(addr)
}

// engineHosts is how DOCKER_HOST names each fake engine.
var engineHosts = map[string]string{}

// With the API, the containers come from it, decoded as docker inspect's,
// and the CLI is not asked.
func TestContainersFromTheAPI(t *testing.T) {
	api := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/containers/json":
			w.Write([]byte(`[{"Id":"aaa"}]`))
		case "/containers/aaa/json":
			w.Write([]byte(`{"Id":"aaa","Name":"/homelab_security-ntfy-1","Image":"sha256:1","Config":{"Image":"binwiederhier/ntfy:latest","Labels":{"com.docker.compose.project":"homelab_security","com.docker.compose.service":"ntfy"}},"State":{"Status":"running","Running":true},"Mounts":[],"NetworkSettings":{"Ports":{}}}`))
		}
	})
	fake := &FakeRunner{}
	c := &Client{Runner: fake, Bin: "docker", API: api}
	cs, err := c.Containers(context.Background())
	if err != nil || len(cs) != 1 || cs[0].Service() != "ntfy" || !cs[0].Running || cs[0].Name != "homelab_security-ntfy-1" {
		t.Fatalf("%+v %v", cs, err)
	}
	if len(fake.Calls) != 0 {
		t.Errorf("the CLI was asked too: %v", fake.Calls)
	}
	if !strings.Contains(c.Reads(), "engine's API at ") {
		t.Errorf("Reads %q", c.Reads())
	}
}

// An error from the API goes back to the CLI, which answers in its own
// words, and the fallback is kept for doctor.
func TestFallsBackToTheCLI(t *testing.T) {
	api := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"message":"something new"}`))
	})
	fake := &FakeRunner{Containers: []FakeContainer{{Name: "homelab_security-ntfy-1", Project: "homelab_security", Service: "ntfy", Running: true}}, InfoJSON: `{"ServerVersion":"27.0.0"}`}
	c := &Client{Runner: fake, Bin: "docker", API: api}
	cs, err := c.Containers(context.Background())
	if err != nil || len(cs) != 1 || cs[0].Service() != "ntfy" {
		t.Fatalf("%+v %v", cs, err)
	}
	if f := LastFallback(); f.Read != "containers" || !strings.Contains(f.Err, "something new") || f.When.IsZero() {
		t.Errorf("fallback %+v", f)
	}
	if info, err := c.Info(context.Background()); err != nil || info.ServerVersion != "27.0.0" {
		t.Errorf("info %+v %v", info, err)
	}
	// The API rests a while after a fallback: the CLI answered info at
	// once, without the API asked again.
	if f := LastFallback(); f.Read != "containers" || !resting() {
		t.Errorf("fallback %+v, resting %v", f, resting())
	}
}

func TestStatsFromTheAPI(t *testing.T) {
	api := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/containers/json":
			w.Write([]byte(`[{"Id":"a","Names":["/quiet"]},{"Id":"b","Names":["/busy"]}]`))
		case "/containers/a/stats":
			w.Write([]byte(`{"cpu_stats":{"cpu_usage":{"total_usage":2},"system_cpu_usage":20,"online_cpus":1},"precpu_stats":{"cpu_usage":{"total_usage":1},"system_cpu_usage":10},"memory_stats":{"usage":1024}}`))
		case "/containers/b/stats":
			w.Write([]byte(`{"cpu_stats":{"cpu_usage":{"total_usage":9},"system_cpu_usage":20,"online_cpus":1},"precpu_stats":{"cpu_usage":{"total_usage":1},"system_cpu_usage":10},"memory_stats":{"usage":2048}}`))
		}
	})
	stats, err := (&Client{Runner: &FakeRunner{}, Bin: "docker", API: api}).Stats(context.Background())
	if err != nil || len(stats) != 2 || stats[0].Name != "busy" || stats[0].CPU != 80 || stats[1].Mem != "1KiB" {
		t.Errorf("busiest first: %+v %v", stats, err)
	}
}

func TestAPIOff(t *testing.T) {
	if !APIOff(map[string]string{"DOCKER_API": "off"}) || APIOff(map[string]string{"DOCKER_API": "auto"}) {
		t.Error("DOCKER_API")
	}
	t.Setenv("DOCKER_API", "off")
	if !APIOff(nil) {
		t.Error("the environment's DOCKER_API")
	}
	if c := WithAPI(&Client{}); c.API != nil || c.Reads() != "the docker command" {
		t.Errorf("off, yet %q", c.Reads())
	}
}

// Events come through the API when it answers; one that cannot start goes
// back to the CLI, which follows them instead.
func TestEventsFromTheAPI(t *testing.T) {
	api := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) {
		w.Write([]byte(`{"Type":"container","Action":"exec_start: sh","Actor":{"ID":"a","Attributes":{"name":"x"}}}` + "\n"))
		w.Write([]byte(`{"Type":"container","Action":"die","Actor":{"ID":"a","Attributes":{"com.docker.compose.service":"ntfy"}}}` + "\n"))
		w.(http.Flusher).Flush()
		<-r.Context().Done()
	})
	ctx, cancel := context.WithCancel(context.Background())
	var got []string
	err := (&Client{Runner: &FakeRunner{}, Bin: "docker", API: api}).Events(ctx, func(e Event) {
		got = append(got, e.Action+" "+e.Service())
		cancel()
	})
	if err != context.Canceled || len(got) != 1 || got[0] != "die ntfy" {
		t.Errorf("%v %v (an exec's event is left out)", err, got)
	}

	broken := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusNotImplemented) })
	fake := &FakeRunner{}
	_ = (&Client{Runner: fake, Bin: "docker", API: broken}).Events(context.Background(), func(Event) {})
	if f := LastFallback(); f.Read != "events" {
		t.Errorf("fallback %+v", f)
	}
}

// WithAPI finds the engine's socket where the CLI would (DOCKER_HOST here).
func TestWithAPIFindsTheSocket(t *testing.T) {
	api := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`{"ServerVersion":"28.0.0"}`)) })
	t.Setenv("DOCKER_API", "")
	t.Setenv("DOCKER_HOST", engineHosts[api.Socket])
	c := WithAPI(&Client{Runner: &FakeRunner{}, Bin: "docker"})
	if c.API == nil || c.API.Socket != api.Socket {
		t.Fatalf("%q", c.Reads())
	}
	if info, err := c.Info(context.Background()); err != nil || info.ServerVersion != "28.0.0" {
		t.Errorf("%+v %v", info, err)
	}
}

// An answer that is not the engine's JSON goes back to the CLI too.
func TestBadAnswerFallsBack(t *testing.T) {
	api := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) { w.Write([]byte(`<html>`)) })
	fake := &FakeRunner{InfoJSON: `{"ServerVersion":"27.0.0"}`}
	if info, err := (&Client{Runner: fake, Bin: "docker", API: api}).Info(context.Background()); err != nil || info.ServerVersion != "27.0.0" {
		t.Errorf("%+v %v", info, err)
	}
	if f := LastFallback(); f.Read != "info" || !strings.Contains(f.Err, "engine API info") {
		t.Errorf("fallback %+v", f)
	}
}

// A command in a container through the API: its stdout, and failing in
// the words the CLI would; one the engine could not start goes to the CLI.
func TestExecThroughTheAPI(t *testing.T) {
	var env []any
	api := fakeEngine(t, func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/containers/ntfy/exec":
			var body map[string]any
			json.NewDecoder(r.Body).Decode(&body)
			env, _ = body["Env"].([]any)
			id := "ok"
			if body["Cmd"].([]any)[0] == "false" {
				id = "bad"
			}
			w.WriteHeader(http.StatusCreated)
			fmt.Fprintf(w, `{"Id":%q}`, id)
		case "/exec/ok/start":
			w.Write(append([]byte{1, 0, 0, 0, 0, 0, 0, 3}, "hi\n"...))
		case "/exec/bad/start":
			w.Write(append([]byte{2, 0, 0, 0, 0, 0, 0, 5}, "nope\n"...))
		case "/exec/ok/json":
			w.Write([]byte(`{"ExitCode":0}`))
		case "/exec/bad/json":
			w.Write([]byte(`{"ExitCode":1}`))
		case "/containers/gone/exec":
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"message":"No such container: gone"}`))
		default:
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"something new"}`))
		}
	})
	fake := &FakeRunner{}
	c := &Client{Runner: fake, Bin: "/usr/local/bin/docker", API: api}
	ctx := context.Background()
	if out, err := c.Exec(ctx, "ntfy", "echo", "hi"); err != nil || string(out) != "hi\n" {
		t.Errorf("%q %v", out, err)
	}
	var w strings.Builder
	if err := c.ExecTo(ctx, &w, "ntfy", "echo", "hi"); err != nil || w.String() != "hi\n" {
		t.Errorf("ExecTo %q %v", w.String(), err)
	}
	t.Setenv("HOMELAB_TEST_PW", "secret")
	if _, err := c.ExecEnv(ctx, "ntfy", []string{"HOMELAB_TEST_PW", "HOMELAB_TEST_UNSET"}, "echo"); err != nil || len(env) != 1 || env[0] != "HOMELAB_TEST_PW=secret" {
		t.Errorf("ExecEnv: %v %v", env, err)
	}
	if _, err := c.Exec(ctx, "ntfy", "false"); err == nil || err.Error() != "docker exec ntfy false: nope" {
		t.Errorf("a failing command: %v", err)
	}
	if _, err := c.Exec(ctx, "gone", "true"); err == nil || err.Error() != "docker exec gone true: Error response from daemon: No such container: gone" {
		t.Errorf("no such container: %v", err)
	}
	if len(fake.Calls) != 0 {
		t.Fatalf("the CLI was asked: %v", fake.Calls)
	}
	// The engine could not start it: the CLI runs it, once.
	if _, err := c.Exec(ctx, "broken", "true"); err != nil || len(fake.Calls) != 1 {
		t.Errorf("%v %v", err, fake.Calls)
	}
	if f := LastFallback(); f.Read != "exec" || !strings.Contains(f.Err, "something new") {
		t.Errorf("fallback %+v", f)
	}
}
