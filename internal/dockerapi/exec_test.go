package dockerapi

import (
	"bytes"
	"context"
	"encoding/binary"
	"encoding/json"
	"errors"
	"net/http"
	"strings"
	"testing"
)

// frame is one frame of the engine's stream for stream 1 (stdout) or 2.
func frame(stream byte, s string) []byte {
	head := make([]byte, 8)
	head[0] = stream
	binary.BigEndian.PutUint32(head[4:], uint32(len(s)))
	return append(head, s...)
}

func TestExec(t *testing.T) {
	var asked map[string]any
	sock := engine(t, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.Path {
		case "/containers/homelab_security-ntfy-1/exec":
			json.NewDecoder(r.Body).Decode(&asked)
			w.WriteHeader(http.StatusCreated)
			w.Write([]byte(`{"Id":"e1"}`))
		case "/exec/e1/start":
			w.Write(frame(1, "hello "))
			w.Write(frame(2, "a warning\n"))
			w.Write(frame(1, "world\n"))
		case "/exec/e1/json":
			w.Write([]byte(`{"ExitCode":3,"Running":false}`))
		case "/containers/gone/exec":
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"message":"No such container: gone"}`))
		case "/containers/broken/exec":
			w.WriteHeader(http.StatusInternalServerError)
			w.Write([]byte(`{"message":"something new"}`))
		}
	}))
	c := New(sock)
	var out, errs bytes.Buffer
	code, err := c.Exec(context.Background(), "homelab_security-ntfy-1", []string{"sh", "-c", "x"}, []string{"PW=secret"}, &out, &errs)
	if err != nil || code != 3 || out.String() != "hello world\n" || errs.String() != "a warning\n" {
		t.Fatalf("%d %v %q %q", code, err, out.String(), errs.String())
	}
	if asked["AttachStdout"] != true || asked["Cmd"].([]any)[2] != "x" || asked["Env"].([]any)[0] != "PW=secret" {
		t.Errorf("asked %v", asked)
	}
	// The engine's own answer is the answer; one that is not, the command
	// did not start, so it may run another way.
	_, err = c.Exec(context.Background(), "gone", []string{"true"}, nil, nil, nil)
	var e *Error
	if !errors.As(err, &e) || e.Status != 404 || errors.Is(err, ErrNotStarted) {
		t.Errorf("gone: %v", err)
	}
	if _, err = c.Exec(context.Background(), "broken", []string{"true"}, nil, nil, nil); !errors.Is(err, ErrNotStarted) || !strings.Contains(err.Error(), "something new") {
		t.Errorf("broken: %v", err)
	}
}

func TestDemux(t *testing.T) {
	var out bytes.Buffer
	if err := demux(bytes.NewReader(append(frame(1, "a"), 9, 0, 0, 0, 0, 0, 0, 1, 'x')), &out, nil); err == nil || out.String() != "a" {
		t.Errorf("an unknown stream: %v %q", err, out.String())
	}
	if err := demux(bytes.NewReader(frame(1, "abc")[:9]), &out, nil); err == nil {
		t.Error("a frame cut short")
	}
	if err := demux(bytes.NewReader(frame(2, "dropped")), &out, nil); err != nil {
		t.Errorf("stderr with nowhere to go: %v", err)
	}
}
