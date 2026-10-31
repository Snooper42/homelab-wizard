package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/appicon"
	"github.com/Snooper42/homelab-wizard/internal/board"
	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/core"
	"github.com/Snooper42/homelab-wizard/internal/domain"
	"github.com/Snooper42/homelab-wizard/internal/engine"
	"github.com/Snooper42/homelab-wizard/internal/explain"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/web"
)

// serve is the phone companion: Status and Backups for paired phones, and
// Finances for the ones allowed them, on the home network and the tailnet only (the serve job runs it all the
// time). With PHONE_COMPANION=false it returns at once, and the job stays
// stopped until the next login.
func (h *homelab) serve(ctx context.Context, args []string) error {
	fs := newFlags("serve")
	port := fs.Int("port", companion.Port, "")
	if _, err := parseFlags(fs, args); err != nil {
		return err
	}
	env := h.envMap()
	if strings.EqualFold(env["PHONE_COMPANION"], "false") {
		h.ui.Info("PHONE_COMPANION=false: the phone companion is off")
		return nil
	}
	bind := env["LAN_BIND_IP"]
	if bind == "" {
		bind = "0.0.0.0"
	}
	// One follower of the engine (the agent's, else the runtime's) for every phone.
	changes := &engine.Hub{}
	go engine.Follow(ctx, h.root, changes.Publish)
	s := &companion.Server{Store: companion.NewStore(companion.StorePath(h.root)), Methods: h.phoneMethods(), Files: web.Files(), Changes: changes}
	srv := &http.Server{Addr: net.JoinHostPort(bind, strconv.Itoa(*port)), Handler: s.Handler(), ReadHeaderTimeout: 10 * time.Second}
	go func() { // #nosec G118 -- shuts down after ctx is done, so it needs a fresh context
		<-ctx.Done()
		shut, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(shut)
	}()
	h.ui.Info("phone companion on port %d (home network and tailnet only)", *port)
	if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
		return err
	}
	return nil
}

// phoneHost is what the phone's Setup code reads about this machine.
type phoneHost struct {
	OS        string `json:"os"`
	Machine   string `json:"machine"`
	Runtime   string `json:"runtime"`
	Scheduler string `json:"scheduler"`
	Supported bool   `json:"supported"`
	RootOK    bool   `json:"rootOK"`
	RuntimeOK bool   `json:"runtimeOK"`
	Version   string `json:"version"`
}

// phoneMethods are the desktop app's methods a phone may call: reading
// for every paired phone; starting, stopping, restarting, and backing up
// for one allowed to make changes.
func (h *homelab) phoneMethods() map[string]companion.Method {
	root := h.root
	read := func(fn func(ctx context.Context, args []json.RawMessage) (any, error)) companion.Method {
		return companion.Method{Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			v, err := fn(ctx, args)
			return v, nil, err
		}}
	}
	var busy sync.Mutex
	run := func(ctx context.Context, args ...string) ([]string, error) {
		if !busy.TryLock() {
			return nil, errors.New("another change from a phone is running")
		}
		defer busy.Unlock()
		lines, err := h.runSelf(ctx, args...)
		return append([]string{"$ homelab " + strings.Join(args, " ")}, lines...), err
	}
	return map[string]companion.Method{
		"Host": read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			p := host.Current()
			_, _, err := core.Containers(ctx)
			return phoneHost{OS: p.Name, Machine: p.Machine, Runtime: p.Runtime, Scheduler: p.Scheduler, Supported: p.Supported, RootOK: true, RuntimeOK: err == nil, Version: version}, nil
		}),
		"Screen": read(func(context.Context, []json.RawMessage) (any, error) { return "status", nil }),
		// The agent's last reading, drawn at once while Status reads a fresh one.
		"LastStatus": read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			if r, ok := core.LastStatus(ctx, root); ok {
				return &r, nil
			}
			return nil, nil
		}),
		"Catalog": read(func(context.Context, []json.RawMessage) (any, error) {
			c, err := core.Catalog(root)
			if err != nil {
				return nil, err
			}
			return api.CatalogOf(c), nil
		}),
		"Status": read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.Status(ctx, root) }),
		// Status with the cards beside it in one request, each sent as it
		// is read; the cards the phone does not show say so.
		"StatusBoard": {Stream: func(ctx context.Context, args []json.RawMessage, result func(any, error), event func(string, any)) {
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			var n int
			var want []string
			if len(args) == 2 {
				_ = json.Unmarshal(args[0], &n)
				_ = json.Unmarshal(args[1], &want)
			}
			st, err := core.Status(ctx, root)
			result(st, err)
			if err != nil {
				return
			}
			// The phone's cards, from the agent when it serves them; the
			// others say they are not read here.
			all, phone := core.Cards(root), board.Readers{}
			for _, name := range []string{"watchdog", "savings", "protection", "alerts"} {
				phone[name] = all[name]
			}
			send := func(c board.Card) { event("status:card", c) }
			var shown []string
			for _, name := range want {
				if _, ok := phone[name]; ok {
					shown = append(shown, name)
				} else {
					send(board.Card{Board: n, Name: name, Error: board.NotHere})
				}
			}
			core.ReadCards(ctx, root, n, shown, phone, send)
		}},
		"Backups":       read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.Backups(ctx, root) }),
		"DuplicatiJobs": read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.DuplicatiJobs(ctx, root) }),
		"Alerts":        read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.RecentAlerts(ctx, root) }),
		"Protection":    read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.Protection(ctx, root) }),
		"Watchdog": read(func(context.Context, []json.RawMessage) (any, error) {
			return health.LoadState(health.StatePath(root)).Summary(), nil
		}),
		// An app's icon for its page, as the app on this machine kept it; a
		// phone never makes it ask the app.
		"AppIcon": read(func(_ context.Context, args []json.RawMessage) (any, error) {
			var id string
			if len(args) > 0 {
				_ = json.Unmarshal(args[0], &id)
			}
			return appicon.Kept(root, id), nil
		}),
		"SavingsHistory": read(func(context.Context, []json.RawMessage) (any, error) {
			return savings.LoadHistory(savings.HistoryPath(root)), nil
		}),
		"Logs": read(func(ctx context.Context, args []json.RawMessage) (any, error) {
			var id string
			lines := 200
			if len(args) > 0 {
				_ = json.Unmarshal(args[0], &id)
			}
			if len(args) > 1 {
				_ = json.Unmarshal(args[1], &lines)
			}
			if err := h.containerApp(id); err != nil {
				return nil, err
			}
			if lines <= 0 || lines > 5000 {
				lines = 200
			}
			out, err := h.runSelf(ctx, "logs", id, "--tail", strconv.Itoa(lines))
			return h.phoneLog(strings.Join(out, "\n")), err
		}),
		// A diagnostics report with every secret removed, for the phone to
		// share with a helper (as Make a diagnostics report on the Mac).
		"Report": {Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			ctx, cancel := context.WithTimeout(ctx, 3*time.Minute)
			defer cancel()
			lines, err := h.runSelf(ctx, "report", "--stdout")
			if err != nil {
				return nil, nil, fmt.Errorf("making the report: %w", err)
			}
			return map[string]string{"text": strings.Join(lines, "\n") + "\n", "helper": strings.TrimSpace(h.envMap()["HELPER_EMAIL"])}, nil, nil
		}},
		// Finances, for the phones allowed them (Settings › Phones): the
		// same plan the computer keeps, read forward the same way. A phone
		// that may only look gets it marked read-only, so it offers no Edit.
		"Finances": {Finances: companion.FinancesView, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			p, err := finance.Load(finance.Path(root))
			v := finance.Project(p, time.Now(), finance.Ahead)
			d, _ := companion.Caller(ctx)
			v.ReadOnly = !companion.FinancesAllow(d.Finances, companion.FinancesEdit)
			return v, nil, err
		}},
		// A save from a phone is refused, as on the computer, when the
		// plan changed after the phone read it (finance.ErrChanged).
		"SaveFinances": {Finances: companion.FinancesEdit, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			var p finance.Plan
			if len(args) < 1 || json.Unmarshal(args[0], &p) != nil {
				return nil, nil, errors.New("SaveFinances takes the plan")
			}
			saved, err := finance.Save(finance.Path(root), p)
			if err != nil {
				return nil, nil, err
			}
			return finance.Project(saved, time.Now(), finance.Ahead), nil, nil
		}},
		"SetUpdatesPaused": {Change: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var paused bool
			if len(args) < 1 || json.Unmarshal(args[0], &paused) != nil {
				return nil, nil, errors.New("SetUpdatesPaused takes true or false")
			}
			st, err := core.SetUpdatesPaused(ctx, root, paused)
			return st, nil, err
		}},
		"AppAction": {Change: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var id, action string
			if len(args) < 2 || json.Unmarshal(args[0], &id) != nil || json.Unmarshal(args[1], &action) != nil {
				return nil, nil, errors.New("AppAction takes an app and an action")
			}
			cmd := []string{action, id}
			switch action {
			case "start", "stop", "restart", "update":
			case "rollback":
				cmd = append(cmd, "--apply")
			default:
				return nil, nil, fmt.Errorf("unknown action %q", action)
			}
			if err := h.containerApp(id); err != nil {
				return nil, nil, err
			}
			log, err := run(ctx, cmd...)
			return nil, log, err
		}},
		// An app's own settings, from its page: its nightly update and
		// the watchdog's alerts about it (as the computer's SetAppSetting).
		"SetAppSetting": {Change: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var id, setting string
			var on bool
			if len(args) < 3 || json.Unmarshal(args[0], &id) != nil || json.Unmarshal(args[1], &setting) != nil || json.Unmarshal(args[2], &on) != nil {
				return nil, nil, errors.New("SetAppSetting takes an app, a setting, and true or false")
			}
			if _, ok := h.catalog.Get(id); !ok {
				return nil, nil, fmt.Errorf("unknown app %q", id)
			}
			var cmd []string
			switch setting {
			case "updates":
				if err := h.containerApp(id); err != nil {
					return nil, nil, err
				}
				cmd = []string{"updates", map[bool]string{true: "release", false: "hold"}[on], id}
			case "alerts":
				cmd = []string{"notify", map[bool]string{true: "on", false: "off"}[on], id}
			default:
				return nil, nil, fmt.Errorf("unknown setting %q", setting)
			}
			log, err := run(ctx, cmd...)
			return nil, log, err
		}},
		"Homelab": {Change: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
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
			switch action {
			case "backup":
				cmd = []string{"backup", "--apply"}
			case "restore-test":
				cmd = []string{"restore-test", "--auto"}
			case "fix":
				cmd = []string{"fix"}
				if apply {
					cmd = append(cmd, "--apply")
				}
			default:
				return nil, nil, fmt.Errorf("%s is not on the phone: use Homelab Wizard on the computer", action)
			}
			log, err := run(ctx, cmd...)
			return nil, log, err
		}},
	}
}

// phoneLog is an app's log as a phone gets it: without .env's secrets or
// anything shaped like a password or token, since every paired device may
// read logs, a read-only one and a kiosk TV included.
func (h *homelab) phoneLog(log string) string {
	return explain.Redact(redact(log, h.secretValues()))
}

// containerApp checks that id is an app the homelab runs in a container.
func (h *homelab) containerApp(id string) error {
	a, ok := h.catalog.Get(id)
	if !ok {
		return fmt.Errorf("unknown app %q", id)
	}
	if a.Native() != nil {
		return fmt.Errorf("%s runs as its own program; manage it on the computer", a.Name())
	}
	return nil
}

// runSelf runs a homelab command with this binary, as a separate process,
// and returns what it printed, line by line.
func (h *homelab) runSelf(ctx context.Context, args ...string) ([]string, error) {
	exe, err := os.Executable()
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithTimeout(ctx, 30*time.Minute)
	defer cancel()
	c := procattr.Hide(exec.CommandContext(ctx, exe, append([]string{"--root", h.root, "--no-color"}, args...)...))
	c.Dir = h.root
	out, err := c.CombinedOutput()
	text := strings.TrimRight(string(out), "\n")
	if text == "" {
		return nil, err
	}
	return strings.Split(text, "\n"), err
}

// phoneCmd pairs phones with the companion and manages the paired ones.
func (h *homelab) phoneCmd(_ context.Context, args []string) error {
	u := h.ui
	store := companion.NewStore(companion.StorePath(h.root))
	sub := ""
	if len(args) > 0 {
		sub, args = args[0], args[1:]
	}
	switch sub {
	case "pair":
		fs := newFlags("phone pair")
		name := fs.String("name", "", "")
		change := fs.Bool("can-change", false, "")
		money := fs.String("finances", "", "")
		if _, err := parseFlags(fs, args); err != nil {
			return err
		}
		code, err := store.NewPairing(*name, *change, *money)
		if err != nil {
			return err
		}
		u.Title("Pair a phone")
		u.Printf("  On the phone, open the companion and enter %s (it works once, for 10 minutes):\n\n", u.Bold(code))
		lan, _ := domain.LANAddress()
		links := companion.Links(h.envMap(), lan, code)
		for _, link := range links {
			u.Printf("    %s\n", u.Cyan(link))
		}
		if len(links) > 0 && !u.JSON {
			if q, err := companion.QRText(links[0]); err == nil {
				u.Printf("\n  Or scan this with the phone's camera:\n\n%s", q)
			}
		}
		u.Printf("\n  %s\n", u.Dim("Then, in Safari: Share › Add to Home Screen."))
		if !*change {
			u.Printf("  %s\n", u.Dim("It can look but not change anything; homelab phone allow <phone> lets it start, stop, and back up."))
		}
		if *money == "" {
			u.Printf("  %s\n", u.Dim("It does not see Finances; homelab phone finances <phone> view (or edit) shows them."))
		}
		return nil
	case "", "list":
		devices := store.Devices()
		if len(devices) == 0 {
			u.Info("no phones paired yet: homelab phone pair")
			return nil
		}
		var rows [][]string
		for _, d := range devices {
			can := "looks only"
			if d.CanChange {
				can = "can make changes"
			}
			seen := "never"
			if !d.LastSeen.IsZero() {
				seen = d.LastSeen.Local().Format("2 Jan 15:04")
			}
			money := map[string]string{"": "no finances", companion.FinancesView: "sees finances", companion.FinancesEdit: "edits finances"}[d.Finances]
			rows = append(rows, []string{d.ID, d.Name, can, money, "paired " + d.Paired.Local().Format("2 Jan 2006"), "last seen " + seen})
		}
		u.Table(nil, rows)
		return nil
	case "remove", "allow", "read-only":
		if len(args) != 1 {
			return fmt.Errorf("usage: homelab phone %s <id or name>", sub)
		}
		if sub == "remove" {
			d, err := store.Remove(args[0])
			if err == nil {
				u.OK("%s is unpaired: its token stopped working", d.Name)
			}
			return err
		}
		d, err := store.SetCanChange(args[0], sub == "allow")
		if err == nil && d.CanChange {
			u.OK("%s can now start, stop, restart, and back up", d.Name)
		} else if err == nil {
			u.OK("%s can look but not change anything", d.Name)
		}
		return err
	case "finances":
		if len(args) != 2 {
			return fmt.Errorf("usage: homelab phone finances <id or name> off|view|edit")
		}
		d, err := store.SetFinances(args[0], args[1])
		switch {
		case err != nil:
		case d.Finances == companion.FinancesEdit:
			u.OK("%s can see Finances and change them", d.Name)
		case d.Finances == companion.FinancesView:
			u.OK("%s can see Finances but not change them", d.Name)
		default:
			u.OK("%s no longer sees Finances", d.Name)
		}
		return err
	}
	return fmt.Errorf("usage: homelab phone pair|list|allow|read-only|finances|remove")
}
