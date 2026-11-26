package main

// The web page's parity with the computer, part 3: Settings. The household
// (People: add someone, a new welcome page or password, their sign-in off;
// their welcome page and fridge sheet opened here; who keeps Finances
// private), each setting's Test, the tailnet's devices, Phones (pairing one,
// and giving one more or less), and taking the homelab off the machine. The
// owner, Nov 26: the same powers as the computer, because the web page
// answers only at home (companion.Server.AtHome), so a stolen device away
// gets nothing.

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/setup"
)

// personPage reads a person's welcome page or sheet (path from people), for
// this browser to open, print or send: only a username's own file.
func personPage(path, username, suffix, missing string) (string, error) {
	if !people.Valid(username) || filepath.Base(path) != username+suffix {
		return "", fmt.Errorf("unknown person %q", username)
	}
	page, err := os.ReadFile(path)
	if err != nil {
		return "", errors.New(missing)
	}
	return string(page), nil
}

// webSettingsMethods are part 3's methods.
func (h *homelab) webSettingsMethods() map[string]companion.Method {
	root := h.root
	return map[string]companion.Method{
		"PersonAction": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var action, name, email string
			var apps []string
			if len(args) < 2 || json.Unmarshal(args[0], &action) != nil || json.Unmarshal(args[1], &name) != nil {
				return nil, nil, errors.New("PersonAction takes what to do and whom")
			}
			if len(args) > 2 {
				_ = json.Unmarshal(args[2], &email)
			}
			if len(args) > 3 {
				_ = json.Unmarshal(args[3], &apps)
			}
			if strings.HasPrefix(name, "-") || strings.HasPrefix(email, "-") {
				return nil, nil, errors.New("a name or an address, not a flag")
			}
			cmd := []string{"person", action, name}
			switch action {
			case "add":
				if email != "" {
					cmd = append(cmd, "--email", email)
				}
				if len(apps) > 0 {
					cmd = append(cmd, "--apps", strings.Join(apps, ","))
				}
			case "welcome", "remove", "password":
			default:
				return nil, nil, fmt.Errorf("unknown action %q", action)
			}
			if action != "welcome" {
				cmd = append(cmd, "--apply")
			}
			lines, err := h.runSelf(ctx, cmd...)
			return nil, append([]string{"$ homelab " + strings.Join(cmd, " ")}, lines...), err
		}},
		// Who keeps their Finances private, and when they last saved them: nothing more, as nothing here can read them.
		"PrivateFinances": {Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			list, err := people.Load(people.Path(root))
			out := map[string]string{}
			for _, p := range list {
				if !people.Valid(p.Username) {
					continue
				}
				if at, ok := finance.PrivateSince(people.MemberRoot(root, p.Username)); ok {
					out[p.Username] = at.UTC().Format(time.RFC3339)
				}
			}
			return out, nil, err
		}},
		// A person's welcome page (their sign-in link in it) and their sheet for the fridge: sent to open here.
		"OpenWelcome": {Change: true, Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			a, err := strArgs(args, 1)
			if err != nil {
				return nil, nil, errors.New("OpenWelcome takes a person")
			}
			page, err := personPage(people.WelcomePath(root, a[0]), a[0], ".html", "no welcome page yet: make a new one")
			return page, nil, err
		}},
		"OpenSheet": {Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			a, err := strArgs(args, 1)
			if err != nil {
				return nil, nil, errors.New("OpenSheet takes a person")
			}
			page, err := personPage(people.SheetPath(root, a[0]), a[0], "-sheet.html", "no sheet yet: make a new welcome page")
			return page, nil, err
		}},
		"SettingTests": {Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			return setup.TestableKeys(), nil, nil
		}},
		"TestSetting": {Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			a, err := strArgs(args, 1)
			if err != nil {
				return nil, nil, errors.New("TestSetting takes a setting")
			}
			ctx, cancel := context.WithTimeout(ctx, time.Minute)
			defer cancel()
			return setup.Tester{Env: core.Env(root), Root: root}.Test(ctx, a[0]), nil, nil
		}},
		"TailnetDevices": {Private: true, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			v, err := core.TailnetDevices(ctx, root)
			return v, nil, err
		}},
	}
}

// webPairing is a one-time code for a phone, as the computer's PairPhone
// gives it: the links that carry it, and the first link as QR codes.
type webPairing struct {
	Code   string   `json:"code"`
	Links  []string `json:"links"`
	QR     string   `json:"qr"`
	WallQR string   `json:"wallQR"`
	Off    bool     `json:"off"`
}

// webUninstall is what Settings › This machine › Take the homelab off this
// machine removes besides the containers, images, and jobs.
type webUninstall struct {
	Data           bool `json:"data"`
	Folder         bool `json:"folder"`
	Backups        bool `json:"backups"`
	App            bool `json:"app"`
	EverythingElse bool `json:"everythingElse"`
}

func (o webUninstall) args() []string {
	args := []string{"uninstall"}
	for _, f := range []struct {
		on   bool
		flag string
	}{{o.Data, "--data"}, {o.Folder, "--folder"}, {o.Backups, "--backups"}, {o.App, "--app"}, {o.EverythingElse, "--everything-else"}} {
		if f.on {
			args = append(args, f.flag)
		}
	}
	return args
}

// webPhoneMethods are Phones and Take the homelab off this machine, as on the computer.
func (h *homelab) webPhoneMethods() map[string]companion.Method {
	root := h.root
	store := func() *companion.Store { return companion.NewStore(companion.StorePath(root)) }
	phoneArgs := func(args []json.RawMessage, what string, v any) (string, error) {
		var id string
		if len(args) < 2 || json.Unmarshal(args[0], &id) != nil || json.Unmarshal(args[1], v) != nil {
			return "", errors.New("takes a phone and " + what)
		}
		return id, nil
	}
	uninstall := func(args []json.RawMessage) (webUninstall, error) {
		var o webUninstall
		if len(args) < 1 || json.Unmarshal(args[0], &o) != nil {
			return o, errors.New("takes what to remove besides the apps")
		}
		return o, nil
	}
	return map[string]companion.Method{
		"PairPhone": {Change: true, Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			var name, finances string
			var canChange bool
			if len(args) < 3 || json.Unmarshal(args[0], &name) != nil || json.Unmarshal(args[1], &canChange) != nil || json.Unmarshal(args[2], &finances) != nil {
				return nil, nil, errors.New("PairPhone takes a name, whether it may change things, and its Finances")
			}
			code, err := store().NewPairing(name, canChange, finances)
			if err != nil {
				return nil, nil, err
			}
			env := core.Env(root)
			lan, _ := domain.LANAddress()
			p := webPairing{Code: code, Links: companion.Links(env, lan, code), Off: strings.EqualFold(env["PHONE_COMPANION"], "false")}
			if len(p.Links) > 0 {
				if p.QR, err = companion.QRDataURL(p.Links[0]); err == nil {
					p.WallQR, err = companion.QRDataURL(p.Links[0] + "&kiosk")
				}
			}
			return p, nil, err
		}},
		"SetPhoneCanChange": {Change: true, Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			var on bool
			id, err := phoneArgs(args, "true or false", &on)
			if err != nil {
				return nil, nil, err
			}
			st := store()
			_, err = st.SetCanChange(id, on)
			return st.Phones(), nil, err
		}},
		"SetPhoneFinances": {Change: true, Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			var level string
			id, err := phoneArgs(args, "a Finances level", &level)
			if err != nil {
				return nil, nil, err
			}
			st := store()
			_, err = st.SetFinances(id, level)
			return st.Phones(), nil, err
		}},
		"SetPhoneUntil": {Change: true, Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			var hours int
			id, err := phoneArgs(args, "hours", &hours)
			if err != nil {
				return nil, nil, err
			}
			var until time.Time
			if hours > 0 {
				until = time.Now().Add(time.Duration(hours) * time.Hour)
			}
			st := store()
			_, err = st.SetUntil(id, until)
			return st.Phones(), nil, err
		}},
		"RemovePhone": {Change: true, Private: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			a, err := strArgs(args, 1)
			if err != nil {
				return nil, nil, errors.New("RemovePhone takes a phone")
			}
			st := store()
			_, err = st.Remove(a[0])
			return st.Phones(), nil, err
		}},
		"UninstallPlan": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			o, err := uninstall(args)
			if err != nil {
				return nil, nil, fmt.Errorf("UninstallPlan %w", err)
			}
			lines, err := h.runSelfFor(ctx, 30*time.Second, o.args()...)
			plan := strings.TrimSpace(strings.Replace(strings.Join(lines, "\n"), "Preview only: nothing was changed. Run again with --apply to go ahead.", "", 1))
			if err != nil && plan == "" {
				return nil, nil, err
			}
			return plan, nil, nil
		}},
		"Uninstall": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			o, err := uninstall(args)
			if err != nil {
				return nil, nil, fmt.Errorf("Uninstall %w", err)
			}
			cmd := append(o.args(), "--apply")
			// Once started it runs to the end, even if this page closes or loses the link.
			lines, err := h.runSelfFor(context.WithoutCancel(ctx), time.Hour, cmd...)
			return nil, append([]string{"$ homelab " + strings.Join(cmd, " ")}, lines...), err
		}},
	}
}
