package dockerapi

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

// engine serves handler where the engine listens (listenEngine: a unix
// socket, or a named pipe on Windows), and returns where that is.
func engine(t *testing.T, handler http.Handler) string {
	addr, _ := engineAt(t, handler)
	return addr
}

func engineAt(t *testing.T, handler http.Handler) (addr, host string) {
	t.Helper()
	l, addr, host := listenEngine(t)
	srv := &http.Server{Handler: handler}
	go srv.Serve(l)
	t.Cleanup(func() { srv.Close() })
	return addr, host
}

func TestInspect(t *testing.T) {
	sock := engine(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/containers/json":
			if r.URL.Query().Get("all") != "1" {
				t.Errorf("not every container: %s", r.URL)
			}
			w.Write([]byte(`[{"Id":"aaa"},{"Id":"gone"},{"Id":"bbb"}]`))
		case "/containers/aaa/json":
			w.Write([]byte(`{"Id":"aaa","Name":"/homelab_security-ntfy-1"}` + "\n"))
		case "/containers/bbb/json":
			w.Write([]byte(`{"Id":"bbb","Name":"/homelab_system-dozzle-1"}`))
		default:
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"message":"No such container: gone"}`))
		}
	}))
	data, err := New(sock).Inspect(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var got []struct{ ID, Name string }
	if err := json.Unmarshal(data, &got); err != nil {
		t.Fatalf("not docker inspect's array: %s", data)
	}
	// One removed between the list and its inspect is left out, as docker
	// inspect of a gone id is not an error of the whole read.
	if len(got) != 2 || got[0].ID != "aaa" || got[1].Name != "/homelab_system-dozzle-1" {
		t.Errorf("%s", data)
	}
}

func TestErrorSaysWhy(t *testing.T) {
	sock := engine(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusInternalServerError)
		w.Write([]byte(`{"message":"the engine is starting"}`))
	}))
	_, err := New(sock).Info(context.Background())
	if e, ok := err.(*Error); !ok || e.Status != 500 || e.Message != "the engine is starting" {
		t.Errorf("%v", err)
	}
}

func TestEvents(t *testing.T) {
	sock := engine(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		var f map[string][]string
		if err := json.Unmarshal([]byte(r.URL.Query().Get("filters")), &f); err != nil || f["type"][0] != "container" || len(f["event"]) != 2 {
			t.Errorf("filters %q", r.URL.Query().Get("filters"))
		}
		fl := w.(http.Flusher)
		for _, a := range []string{"start", "die"} {
			fmt.Fprintf(w, `{"Type":"container","Action":%q,"Actor":{"ID":"aaa","Attributes":{"name":"ntfy"}}}`+"\n", a)
			fl.Flush()
		}
		<-r.Context().Done()
	}))
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	var got []string
	err := New(sock).Events(ctx, []string{"start", "die"}, func(line []byte) {
		var e struct{ Action string }
		json.Unmarshal(line, &e)
		got = append(got, e.Action)
		if len(got) == 2 {
			cancel()
		}
	})
	if err != context.Canceled || strings.Join(got, " ") != "start die" {
		t.Errorf("%v %v", err, got)
	}
}

// The numbers docker stats shows for the same answer: 2 of 4 processors'
// time over the interval is 50% of the machine, so 200% of one; memory
// without the page cache.
func TestParseStat(t *testing.T) {
	body := []byte(`{"name":"/homelab_media-navidrome-1",
		"cpu_stats":{"cpu_usage":{"total_usage":3000000000},"system_cpu_usage":14000000000,"online_cpus":4},
		"precpu_stats":{"cpu_usage":{"total_usage":1000000000},"system_cpu_usage":10000000000},
		"memory_stats":{"usage":157286400,"stats":{"inactive_file":52428800}}}`)
	s, err := ParseStat(body)
	if err != nil {
		t.Fatal(err)
	}
	if s.Name != "homelab_media-navidrome-1" || s.CPU != 200 || s.Mem != "100MiB" {
		t.Errorf("%+v", s)
	}
	// cgroup v1 names the cache total_inactive_file.
	v1, _ := ParseStat([]byte(`{"memory_stats":{"usage":2048,"stats":{"total_inactive_file":1024}}}`))
	if v1.Mem != "1KiB" || v1.CPU != 0 {
		t.Errorf("v1: %+v", v1)
	}
	if got := BytesSize(1.5 * 1024 * 1024 * 1024); got != "1.5GiB" {
		t.Errorf("BytesSize %q", got)
	}
}

func TestStats(t *testing.T) {
	sock := engine(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/containers/json":
			w.Write([]byte(`[{"Id":"aaa","Names":["/homelab_security-ntfy-1"]}]`))
		case "/containers/aaa/stats":
			if r.URL.Query().Get("stream") != "false" {
				t.Errorf("a stream asked for: %s", r.URL)
			}
			w.Write([]byte(`{"cpu_stats":{"cpu_usage":{"total_usage":2},"system_cpu_usage":4,"online_cpus":1},"precpu_stats":{"cpu_usage":{"total_usage":1},"system_cpu_usage":2},"memory_stats":{"usage":1048576}}`))
		}
	}))
	stats, err := New(sock).Stats(context.Background())
	if err != nil || len(stats) != 1 || stats[0].Name != "homelab_security-ntfy-1" || stats[0].CPU != 50 || stats[0].Mem != "1MiB" {
		t.Errorf("%+v %v", stats, err)
	}
}

// Find looks where the CLI would: DOCKER_HOST, the current context, then
// the usual sockets.
func TestFind(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("USERPROFILE", home) // the home folder on Windows
	t.Setenv("DOCKER_CONFIG", "")
	t.Setenv("DOCKER_CONTEXT", "")
	t.Setenv("XDG_RUNTIME_DIR", "")
	sock, host := engineAt(t, http.NotFoundHandler())

	t.Setenv("DOCKER_HOST", host)
	if got, err := Find(); err != nil || got != sock {
		t.Errorf("DOCKER_HOST: %q %v", got, err)
	}
	t.Setenv("DOCKER_HOST", "tcp://10.0.0.2:2375")
	if _, err := Find(); err == nil {
		t.Error("a TCP DOCKER_HOST taken for a socket")
	}
	t.Setenv("DOCKER_HOST", "")

	// The current context, as docker context use leaves it.
	name := "orbstack"
	sum := sha256.Sum256([]byte(name))
	meta := filepath.Join(home, ".docker", "contexts", "meta", hex.EncodeToString(sum[:]))
	os.MkdirAll(meta, 0o755)
	data, _ := json.Marshal(map[string]any{"Name": "orbstack", "Endpoints": map[string]any{"docker": map[string]string{"Host": host}}})
	os.WriteFile(filepath.Join(meta, "meta.json"), data, 0o644)
	os.WriteFile(filepath.Join(home, ".docker", "config.json"), []byte(`{"currentContext":"orbstack"}`), 0o644)
	if got, err := Find(); err != nil || got != sock {
		t.Errorf("the current context: %q %v", got, err)
	}
	if c := contextHost(home); c != host {
		t.Errorf("contextHost %q", c)
	}
}
