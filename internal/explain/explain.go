// Package explain asks the Ollama running on this machine what an app's
// log says, in plain words: what went wrong, the likely cause, and what to
// try. The log never leaves the machine.
package explain

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"
)

// Base is Ollama's address: OLLAMA_HOST as the ollama command reads it,
// else its default on this machine, or Docker's own address here when
// only that answers (on Linux, Ollama listens there so that the
// containers reach it and the home network does not).
func Base() string {
	h := strings.TrimSpace(os.Getenv("OLLAMA_HOST"))
	switch {
	case h == "":
		if b := bridge(); b != "" && !answers("127.0.0.1:11434") && answers(b+":11434") {
			return "http://" + b + ":11434"
		}
		return "http://127.0.0.1:11434"
	case strings.HasPrefix(h, "http://") || strings.HasPrefix(h, "https://"):
		return strings.TrimRight(h, "/")
	case strings.HasPrefix(h, "0.0.0.0"):
		h = "127.0.0.1" + strings.TrimPrefix(h, "0.0.0.0")
	}
	if !strings.Contains(h, ":") {
		h += ":11434"
	}
	return "http://" + h
}

// Up reports whether Ollama answers on this machine (at Base).
func Up(ctx context.Context) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, Base()+"/", nil)
	if err != nil {
		return false
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return false
	}
	resp.Body.Close()
	return true
}

// bridge and answers are dockerBridge and dials; tests replace them.
var bridge, answers = dockerBridge, dials

// dockerBridge is Docker's own address on this machine (docker0,
// 172.17.0.1 unless Docker was told otherwise), "" without one.
func dockerBridge() string {
	ifc, err := net.InterfaceByName("docker0")
	if err != nil {
		return ""
	}
	addrs, _ := ifc.Addrs()
	return firstIPv4(addrs)
}

// firstIPv4 is the first IPv4 address among addrs, "" without one.
func firstIPv4(addrs []net.Addr) string {
	for _, a := range addrs {
		if ipn, ok := a.(*net.IPNet); ok && ipn.IP.To4() != nil {
			return ipn.IP.String()
		}
	}
	return ""
}

// dials reports whether something listens at addr (host:port).
func dials(addr string) bool {
	c, err := net.DialTimeout("tcp", addr, 300*time.Millisecond)
	if err != nil {
		return false
	}
	c.Close()
	return true
}

// ErrNoOllama is Ollama not answering on this machine.
var ErrNoOllama = errors.New("Ollama is not running on this machine (Open WebUI's note says how to install it)")

// ErrNoModel is Ollama without a model to ask.
var ErrNoModel = errors.New("Ollama has no model yet: ollama pull llama3.2")

// preferred are model families that follow instructions well, best first.
var preferred = []string{"llama3", "qwen", "gemma", "mistral", "phi"}

// Model is the model to ask: want when Ollama has it, else the first of
// the preferred families it has, else the first it has.
func Model(ctx context.Context, want string) (string, error) {
	var tags struct {
		Models []struct {
			Name string `json:"name"`
		} `json:"models"`
	}
	if err := call(ctx, http.MethodGet, "/api/tags", nil, &tags, 3*time.Second); err != nil {
		return "", ErrNoOllama
	}
	if len(tags.Models) == 0 {
		return "", ErrNoModel
	}
	for _, m := range tags.Models {
		if want != "" && (m.Name == want || strings.TrimSuffix(m.Name, ":latest") == want) {
			return m.Name, nil
		}
	}
	for _, family := range preferred {
		for _, m := range tags.Models {
			if strings.HasPrefix(m.Name, family) && !strings.Contains(m.Name, "embed") {
				return m.Name, nil
			}
		}
	}
	return tags.Models[0].Name, nil
}

// MaxLog is how much of a log's end is sent: what a small model reads well.
const MaxLog = 12000

const instructions = `You help someone who runs a home server with Docker apps, set up by a tool called the homelab. They are not a developer.
Read the app's log and answer in plain English, in at most six short lines:
- whether something is wrong, or the log looks normal;
- if something is wrong: what, and the likely cause, quoting the one log line that shows it;
- one or two things to try, most likely first.
Only say what the log supports; when it does not say why, say so. Do not invent commands or settings. Restarting the app, checking its settings in the homelab's Settings screen, and "homelab fix" are safe suggestions.`

// Explain asks model what app's log says.
func Explain(ctx context.Context, model, app, log string) (string, error) {
	log = Tail(Redact(log), MaxLog)
	if strings.TrimSpace(log) == "" {
		return "The log is empty, so there is nothing to explain.", nil
	}
	req := map[string]any{
		"model":  model,
		"stream": false,
		"messages": []map[string]string{
			{"role": "system", "content": instructions},
			{"role": "user", "content": fmt.Sprintf("The app is %s. The end of its log:\n\n%s", app, log)},
		},
		"options": map[string]any{"temperature": 0.2, "num_ctx": 8192},
	}
	var resp struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
		Error string `json:"error"`
	}
	if err := call(ctx, http.MethodPost, "/api/chat", req, &resp, 3*time.Minute); err != nil {
		return "", err
	}
	if resp.Error != "" {
		return "", errors.New("Ollama: " + resp.Error)
	}
	return strings.TrimSpace(resp.Message.Content), nil
}

// Tail is the end of log, at most max bytes, from a line's start.
func Tail(log string, max int) string {
	if len(log) <= max {
		return log
	}
	log = log[len(log)-max:]
	if i := strings.IndexByte(log, '\n'); i >= 0 {
		log = log[i+1:]
	}
	return log
}

var secrets = []*regexp.Regexp{
	regexp.MustCompile(`(?i)((?:bearer|basic)\s+)[a-z0-9._~+/=-]{8,}`),
	regexp.MustCompile(`(?i)((?:password|passwd|secret|token|api[_-]?key)["']?\s*[:=]\s*["']?)[^\s"',;&]+`),
	regexp.MustCompile(`(://[^:/@\s]+:)[^@\s]+(@)`),
}

// Redact hides what looks like a password or token in a log, so it is
// not in a model's context.
func Redact(log string) string {
	for _, re := range secrets {
		log = re.ReplaceAllString(log, "${1}…${2}")
	}
	return log
}

func call(ctx context.Context, method, path string, body, v any, timeout time.Duration) error {
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	var r io.Reader
	if body != nil {
		data, err := json.Marshal(body)
		if err != nil {
			return err
		}
		r = bytes.NewReader(data)
	}
	req, err := http.NewRequestWithContext(ctx, method, Base()+path, r)
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		if errors.Is(err, context.DeadlineExceeded) {
			return errors.New("the model took too long; a smaller one answers faster (ollama pull llama3.2)")
		}
		return err
	}
	defer resp.Body.Close()
	data, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	if resp.StatusCode != http.StatusOK {
		var e struct{ Error string }
		if json.Unmarshal(data, &e) == nil && e.Error != "" {
			return errors.New("Ollama: " + e.Error)
		}
		return fmt.Errorf("Ollama answered %s", resp.Status)
	}
	return json.Unmarshal(data, v)
}
