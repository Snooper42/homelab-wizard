package main

// The web page's parity with the computer, part 3: Settings. The household
// (People: add someone, a new welcome page or password, their sign-in off;
// their welcome page and fridge sheet opened here; who keeps Finances
// private), each setting's Test, and the tailnet's devices. Pairing a phone
// or giving one more stays on the computer (serve.go's LowerPhone: a phone
// can't give itself more), and so does taking the homelab off the machine.

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
