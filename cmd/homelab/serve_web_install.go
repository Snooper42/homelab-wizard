package main

// The web page's parity with the computer, part 2: adding apps. Plan and
// Install as Choose apps and an app's page to add call them on the computer,
// your own app (AddCustom), and Connect apps (Wire, WireSeerr, and qBittorrent's
// password). Each runs as the homelab command does (homelab --json install),
// the settings typed in the form going to it on its input, never its command
// line, and its progress coming to the page as the computer's does.

import (
	"bufio"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"os/exec"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/custom"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// jsonLine is one line of homelab --json's output.
type jsonLine struct {
	Type string          `json:"type"`
	Data json.RawMessage `json:"data"`
}

// runSelfJSON runs this homelab with --json, the settings on its input as
// KEY=value lines, handing each JSON line to line and any other to text. It
// returns the error line's message when there is one.
func (h *homelab) runSelfJSON(ctx context.Context, limit time.Duration, set map[string]string, line func(jsonLine), text func(string), args ...string) error {
	exe, err := os.Executable()
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, limit)
	defer cancel()
	var in strings.Builder
	keys := make([]string, 0, len(set))
	for k := range set {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		if strings.ContainsAny(set[k], "\r\n") {
			return fmt.Errorf("%s: a setting is one line", k)
		}
		in.WriteString(k + "=" + set[k] + "\n")
	}
	if len(set) > 0 {
		args = append(args, "--set-stdin")
	}
	c := procattr.Hide(exec.CommandContext(ctx, exe, append([]string{"--root", h.root, "--no-color", "--json"}, args...)...))
	c.Dir = h.root
	c.Env = append(os.Environ(), actorEnv+"="+whoAsked(ctx))
	c.Stdin = strings.NewReader(in.String())
	out, err := c.StdoutPipe()
	if err != nil {
		return err
	}
	c.Stderr = c.Stdout
	if err := c.Start(); err != nil {
		return err
	}
	var failed string
	sc := bufio.NewScanner(out)
	sc.Buffer(make([]byte, 64*1024), 4*1024*1024)
	for sc.Scan() {
		var l jsonLine
		if json.Unmarshal(sc.Bytes(), &l) == nil && l.Type != "" {
			if l.Type == "error" {
				var e struct {
					Message string `json:"message"`
				}
				_ = json.Unmarshal(l.Data, &e)
				failed = e.Message
			}
			line(l)
			continue
		}
		if t := strings.TrimRight(sc.Text(), "\r"); t != "" {
			text(t)
		}
	}
	err = c.Wait()
	if failed != "" {
		return errors.New(failed)
	}
	return err
}

// runSelfInput runs this homelab as runSelf does, with stdin on its input:
// how a password reaches it without going on its command line.
func (h *homelab) runSelfInput(ctx context.Context, limit time.Duration, stdin string, args ...string) ([]string, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, limit)
	defer cancel()
	c := procattr.Hide(exec.CommandContext(ctx, exe, append([]string{"--root", h.root, "--no-color"}, args...)...))
	c.Dir = h.root
	c.Env = append(os.Environ(), actorEnv+"="+whoAsked(ctx))
	c.Stdin = strings.NewReader(stdin)
	out, err := c.CombinedOutput()
	text := strings.TrimRight(string(out), "\n")
	if text == "" {
		return nil, err
	}
	return strings.Split(text, "\n"), err
}

// installArgs reads Plan's and Install's arguments: the selection (app IDs
// or sets) and the settings typed in the form.
func installArgs(args []json.RawMessage) ([]string, map[string]string, error) {
	var tokens []string
	set := map[string]string{}
	if len(args) < 1 || json.Unmarshal(args[0], &tokens) != nil {
		return nil, nil, errors.New("takes the apps to add, and the settings typed")
	}
	if len(args) > 1 && string(args[1]) != "null" && json.Unmarshal(args[1], &set) != nil {
		return nil, nil, errors.New("the settings are names and values")
	}
	for _, t := range tokens {
		if t == "" || strings.HasPrefix(t, "-") {
			return nil, nil, fmt.Errorf("%q is not an app or a set", t)
		}
	}
	return tokens, set, nil
}

// webInstallMethods are part 2's methods.
func (h *homelab) webInstallMethods() map[string]companion.Method {
	root := h.root
	wire := func(ctx context.Context, admin *wiring.JellyfinAdmin, event func(string, any)) ([]wiring.Link, error) {
		c, err := core.Catalog(root)
		if err != nil {
			return nil, err
		}
		_, containers, err := core.Containers(ctx)
		if err != nil {
			return nil, err
		}
		home, _ := os.UserHomeDir()
		w := wiring.New(c, containers, core.Env(root), home)
		w.JellyfinAdmin = admin
		return w.Apply(ctx, func(l wiring.Link) { event("link", l) }), nil
	}
	return map[string]companion.Method{
		// What adding them would do; nothing changes.
		"Plan": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			tokens, set, err := installArgs(args)
			if err != nil {
				return nil, nil, fmt.Errorf("Plan %w", err)
			}
			var plan json.RawMessage
			var log []string
			err = h.runSelfJSON(ctx, 2*time.Minute, set, func(l jsonLine) {
				if l.Type == "plan" {
					plan = l.Data
				}
			}, func(t string) { log = append(log, t) }, append([]string{"plan"}, tokens...)...)
			if plan == nil {
				if err == nil {
					err = errors.New("the plan was empty")
				}
				return nil, log, err
			}
			// A plan with problems says them in itself (its Problems), as on the computer.
			return plan, nil, nil
		}},
		// Adds them: each step's progress as the computer shows it, then what started.
		"Install": {Change: true, Private: true, Stream: func(ctx context.Context, args []json.RawMessage, result func(any, error), event func(string, any)) {
			tokens, set, err := installArgs(args)
			if err != nil {
				result(nil, fmt.Errorf("Install %w", err))
				return
			}
			started := []api.Started{}
			// Once started it runs to the end on the computer, even if this page closes or loses the link.
			err = h.runSelfJSON(context.WithoutCancel(ctx), time.Hour, set, func(l jsonLine) {
				switch l.Type {
				case "progress":
					event("progress", l.Data)
				case "done":
					var d struct {
						Started []api.Started `json:"started"`
					}
					if json.Unmarshal(l.Data, &d) == nil && d.Started != nil {
						started = d.Started
					}
				}
			}, func(t string) { event("install:log", t) }, append([]string{"install", "--apply"}, tokens...)...)
			result(started, err)
		}},
		// Your own app, from its image: added to the catalog, then the catalog as it is now. Its settings may be
		// passwords: over https only, and to the command on its input, never its command line.
		"AddCustom": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var spec custom.Spec
			if len(args) < 1 || json.Unmarshal(args[0], &spec) != nil {
				return nil, nil, errors.New("AddCustom takes your app: its name and image")
			}
			c, err := core.Catalog(root)
			if err != nil {
				return nil, nil, err
			}
			if spec.ID == "" {
				spec.ID = custom.Slug(spec.Name)
			}
			if err := spec.Check(c); err != nil {
				return nil, nil, err
			}
			cmd, stdin, err := spec.AddArgs()
			if err != nil {
				return nil, nil, err
			}
			lines, err := h.runSelfInput(ctx, 30*time.Minute, stdin, cmd...)
			log := append([]string{"$ homelab custom add " + spec.ID}, lines...)
			if err != nil {
				return nil, log, err
			}
			if c, err = core.Catalog(root); err != nil {
				return nil, log, err
			}
			return api.CatalogOf(c), log, nil
		}},
		// Connect apps: each link as it's made, then all of them.
		"Wire": {Change: true, Stream: func(ctx context.Context, _ []json.RawMessage, result func(any, error), event func(string, any)) {
			result(wire(ctx, nil, event))
		}},
		// The same, signing Seerr in with a Jellyfin administrator's name and password: used for this run, kept nowhere.
		"WireSeerr": {Change: true, Private: true, Stream: func(ctx context.Context, args []json.RawMessage, result func(any, error), event func(string, any)) {
			var user, password string
			if len(args) < 2 || json.Unmarshal(args[0], &user) != nil || json.Unmarshal(args[1], &password) != nil {
				result(nil, errors.New("WireSeerr takes a Jellyfin administrator's name and password"))
				return
			}
			var admin *wiring.JellyfinAdmin
			if user = strings.TrimSpace(user); user != "" {
				admin = &wiring.JellyfinAdmin{User: user, Password: password}
			}
			result(wire(ctx, admin, event))
		}},
		"FixQbitPassword": {Change: true, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			lines, err := h.runSelf(ctx, "wire", "--qbit-password")
			return nil, append([]string{"$ homelab wire --qbit-password"}, lines...), err
		}},
	}
}
