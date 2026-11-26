package main

// The web page's parity with the computer (the owner, Nov 26: "the web page
// portion fully feature parity between the computer and the web app"): the
// desktop app's methods that Status, an app's page, and Backups call, served
// to the web page as the computer answers them. Each change needs a device
// allowed to make changes; passwords and keys only over https (Private), to
// the owner's devices, kept in history as Sign-in details' copies are.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/explain"
	"github.com/Snooper42/homelab-wizard/internal/kept"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/storage"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// webSendTarget is a paired device a page can be sent to (Send to my
// phone), as the computer's SendTargets lists it: never a wall screen.
type webSendTarget struct {
	ID       string   `json:"id"`
	Name     string   `json:"name"`
	Finances bool     `json:"finances,omitempty"`
	Member   bool     `json:"member,omitempty"`
	Apps     []string `json:"apps,omitempty"`
}

// strArgs reads n string arguments.
func strArgs(args []json.RawMessage, n int) ([]string, error) {
	if len(args) < n {
		return nil, fmt.Errorf("takes %d arguments", n)
	}
	out := make([]string, n)
	for i := range out {
		if json.Unmarshal(args[i], &out[i]) != nil {
			return nil, fmt.Errorf("argument %d is not text", i+1)
		}
	}
	return out, nil
}

// webMethods are the computer's methods the web page calls beyond the
// phone's (phoneMethods), with the same answers.
func (h *homelab) webMethods() map[string]companion.Method {
	root := h.root
	read := func(fn func(ctx context.Context, args []json.RawMessage) (any, error)) companion.Method {
		return companion.Method{Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			v, err := fn(ctx, args)
			return v, nil, err
		}}
	}
	run := func(ctx context.Context, args ...string) ([]string, error) {
		lines, err := h.runSelf(ctx, args...)
		return append([]string{"$ homelab " + strings.Join(args, " ")}, lines...), err
	}
	return map[string]companion.Method{
		// Status: why each running app's page doesn't answer ("" when it does).
		"Answers": read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			st, err := core.StatusNow(ctx, root)
			if err != nil {
				return nil, err
			}
			api.Probe(ctx, st.Apps)
			out := map[string]string{}
			now := time.Now()
			for _, s := range st.Apps {
				if api.Askable(s, now) {
					out[s.ID] = s.NotAnswering
				}
			}
			return out, nil
		}),
		"Usage":            read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.Usage(ctx) }),
		"Storage":          read(func(context.Context, []json.RawMessage) (any, error) { return storage.Load(storage.Path(root)), nil }),
		"BackupGaps":       read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.BackupGaps(ctx, root) }),
		"DownloadsPrivate": read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.DownloadsPrivate(ctx, root) }),
		"Explainer": read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
			defer cancel()
			model, _ := explain.Model(ctx, core.Env(root)["OLLAMA_MODEL"])
			return model, nil
		}),
		"QR": read(func(_ context.Context, args []json.RawMessage) (any, error) {
			a, err := strArgs(args, 1)
			if err != nil || !(strings.HasPrefix(a[0], "https://") || strings.HasPrefix(a[0], "http://")) {
				return nil, errors.New("QR takes a web address")
			}
			return companion.QRDataURL(a[0])
		}),
		"People": {Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			list, err := people.Load(people.Path(root))
			if list == nil {
				list = []people.Person{}
			}
			return list, nil, err
		}},
		"CrashSeen": {Change: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			return nil, nil, core.CrashSeen(root)
		}},
		// Passwords and keys: which are ticked Saved, the count not yet per app, and the tick.
		"Kept": {Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			return kept.Load(root), nil, nil
		}},
		"Unkept": {Private: true, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			st, err := core.StatusNow(ctx, root)
			if err != nil {
				return nil, nil, err
			}
			c, err := core.Catalog(root)
			if err != nil {
				return nil, nil, err
			}
			return kept.ByApp(kept.Unsaved(core.Secrets(root, c, &st), kept.Load(root))), nil, nil
		}},
		"MarkKept": {Change: true, Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			var key string
			var saved bool
			if len(args) < 2 || json.Unmarshal(args[0], &key) != nil || json.Unmarshal(args[1], &saved) != nil {
				return nil, nil, errors.New("MarkKept takes a setting and true or false")
			}
			return nil, nil, kept.Mark(root, key, saved)
		}},
		// Copy a saved password or an app's own key: the computer puts it on its clipboard; the web page gets the
		// value and puts it on this device's (companion.js), so only a device allowed to change things, over https.
		"CopySetting": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			a, err := strArgs(args, 1)
			if err != nil {
				return nil, nil, errors.New("CopySetting takes a setting")
			}
			list, err := settings.List(root)
			if err != nil {
				return nil, nil, err
			}
			for _, s := range list {
				if s.Key != a[0] {
					continue
				}
				v := core.Env(root)[s.Key]
				if !s.Secret || v == "" {
					return nil, nil, fmt.Errorf("%s is not a saved secret", s.Key)
				}
				h.record("copy", "", whoAsked(ctx), fmt.Sprintf("%s copied on %s", s.Key, whoAsked(ctx)))
				return v, nil, nil
			}
			return nil, nil, fmt.Errorf("unknown setting %q", a[0])
		}},
		"CopyAppKey": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			a, err := strArgs(args, 1)
			if err != nil {
				return nil, nil, errors.New("CopyAppKey takes an app")
			}
			c, err := core.Catalog(root)
			if err != nil {
				return nil, nil, err
			}
			app, ok := c.Get(a[0])
			if !ok || app.Meta.KeyFile == "" {
				return nil, nil, fmt.Errorf("%s keeps no API key of its own", a[0])
			}
			home, _ := os.UserHomeDir()
			dir := wiring.AppsFrom(c, func(x string) bool { return x == a[0] }, core.Env(root), home)[a[0]].ConfigDir
			key, err := wiring.KeptKey(dir, app.Meta.KeyFile)
			if err != nil {
				return nil, nil, fmt.Errorf("%s: %w", app.Name(), err)
			}
			h.record("copy", a[0], whoAsked(ctx), fmt.Sprintf("%s's API key copied on %s", app.Name(), whoAsked(ctx)))
			return key, nil, nil
		}},
		// Send to my phone, from the web page as from the computer.
		"SendTargets": read(func(context.Context, []json.RawMessage) (any, error) {
			out := []webSendTarget{}
			list, _ := people.Load(people.Path(root))
			for _, d := range companion.NewStore(companion.StorePath(root)).Devices() {
				if d.Kiosk {
					continue
				}
				t := webSendTarget{ID: d.ID, Name: d.Name, Finances: companion.MayOpen(d, "homelab://finances", nil)}
				if d.Person != "" {
					t.Member, t.Finances = true, false
					if i, ok := people.Find(list, d.Person); ok {
						t.Apps = list[i].Apps
					}
				}
				out = append(out, t)
			}
			return out, nil
		}),
		"SendToPhone": {Change: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			a, err := strArgs(args, 3)
			if err != nil {
				return nil, nil, errors.New("SendToPhone takes a phone, a link, and its title")
			}
			for _, d := range companion.NewStore(companion.StorePath(root)).Devices() {
				if d.ID != a[0] {
					continue
				}
				uses := func(string) bool { return false }
				if d.Person != "" {
					list, _ := people.Load(people.Path(root))
					if i, ok := people.Find(list, d.Person); ok && list[i].Active() {
						uses = list[i].Uses
					}
				}
				if !companion.MayOpen(d, a[1], uses) {
					return nil, nil, errors.New(d.Name + " can't open that page")
				}
				return nil, nil, companion.Send(root, companion.Sent{Device: d.ID, Link: a[1], Title: a[2]})
			}
			return nil, nil, errors.New("that phone isn't paired any more")
		}},
		// The printable recovery kit: written as on the computer, its page sent back for this browser to open and print.
		"RecoveryKit": {Change: true, Private: true, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			log, err := run(ctx, "recovery-kit")
			if err != nil {
				return nil, log, err
			}
			page, err := os.ReadFile(filepath.Join(root, "recovery-kit.html"))
			if err != nil {
				return nil, log, err
			}
			return string(page), log, nil
		}},
	}
}

// servedMethods are the phone's methods and the web page's, the phone's
// own answer kept where both have one.
func (h *homelab) servedMethods() map[string]companion.Method {
	all := h.webMethods()
	for _, more := range []map[string]companion.Method{h.webInstallMethods(), h.webSettingsMethods(), h.webPhoneMethods()} {
		for k, m := range more {
			all[k] = m
		}
	}
	for k, m := range h.phoneMethods() {
		all[k] = m
	}
	all["Homelab"] = h.webHomelab(all["Homelab"])
	return all
}

// webHomelab is the phone's Homelab with the computer's other actions the
// web page offers: adopt an app's old container, clean up old containers,
// remove an app (backed up first), create the off-site backup jobs, test a
// restore from Kopia, and close sign-ups. Every other action is the phone's.
func (h *homelab) webHomelab(phone companion.Method) companion.Method {
	return companion.Method{Change: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
		var action, target string
		var apply bool
		if len(args) > 0 {
			_ = json.Unmarshal(args[0], &action)
		}
		if len(args) > 1 {
			_ = json.Unmarshal(args[1], &target)
		}
		if len(args) > 2 {
			_ = json.Unmarshal(args[2], &apply)
		}
		var cmd []string
		known := func(id string) bool {
			c, err := core.Catalog(h.root)
			if err != nil {
				return false
			}
			_, ok := c.Get(id)
			return ok
		}
		switch action {
		case "adopt":
			if !known(target) {
				return nil, nil, fmt.Errorf("unknown app %q", target)
			}
			cmd = []string{"adopt", target}
		case "cleanup":
			cmd = []string{"cleanup"}
			if target == "volumes" {
				cmd = append(cmd, "--volumes")
			}
		case "signups-close":
			cmd, apply = []string{"signups", "close"}, false
		case "duplicati-setup":
			cmd, apply = []string{"duplicati", "setup"}, true
		case "restore-test-kopia":
			cmd, apply = []string{"restore-test", "--auto", "--engine", "kopia"}, false
		case "remove":
			if !known(target) {
				return nil, nil, fmt.Errorf("unknown app %q", target)
			}
			cmd = []string{"remove", target}
			if apply {
				// Its data backed up first, as on the computer: no backup, no removal.
				log, err := h.runSelf(ctx, "backup", "--apps", target, "--apply")
				log = append([]string{"$ homelab backup --apps " + target + " --apply"}, log...)
				if err != nil {
					return nil, log, fmt.Errorf("the backup before removing it failed, so it was not removed: %w", err)
				}
				more, err := h.runSelf(ctx, "remove", target, "--apply")
				return nil, append(append(log, "", "$ homelab remove "+target+" --apply"), more...), err
			}
		default:
			return phone.Call(ctx, args)
		}
		if apply {
			cmd = append(cmd, "--apply")
		}
		lines, err := h.runSelf(ctx, cmd...)
		return nil, append([]string{"$ homelab " + strings.Join(cmd, " ")}, lines...), err
	}}
}
