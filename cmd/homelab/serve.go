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
	"sort"
	"strconv"
	"strings"
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
	"github.com/Snooper42/homelab-wizard/internal/ghostfolio"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/host"
	"github.com/Snooper42/homelab-wizard/internal/notify"
	"github.com/Snooper42/homelab-wizard/internal/people"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
	"github.com/Snooper42/homelab-wizard/internal/savings"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/statusfolds"
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
	s := &companion.Server{Store: companion.NewStore(companion.StorePath(h.root)), Methods: h.phoneMethods(), Version: version, Files: web.Files(), Changes: changes, Calendar: h.financeCalendar,
		ProxyKey: func() string { return h.envMap()["COMPANION_PROXY_KEY"] }, ForMember: h.forMember,
		// Away from home through the tunnel (ADR-0023): Setup's "Reach
		// Finances away from home" writes these; without them it's refused.
		Access: func() companion.Access {
			env := h.envMap()
			return companion.Access{Team: env["COMPANION_ACCESS_TEAM"], Audience: env["COMPANION_ACCESS_AUD"], ClientID: env["COMPANION_ACCESS_CLIENT_ID"],
				Secret: env["COMPANION_ACCESS_CLIENT_SECRET"], Host: env["COMPANION_AWAY_HOST"]}
		}}
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

// phoneSettings is the Settings form a phone gets: the .env settings as
// the computer lists them (a secret only says whether it is set), and the
// keys a phone may not change.
type phoneSettings struct {
	Settings     []settings.Setting `json:"settings"`
	ComputerOnly []string           `json:"computerOnly"`
}

// phoneConnects are the settings a phone reaches the homelab through: the
// companion itself, where it and the proxy listen, the domain and its key,
// the address the proxy reaches the companion at, the DNS the phone asks,
// and Tailscale. A phone could cut itself off, or every phone, with one of
// these, so they are changed on the computer, as every secret is.
var phoneConnects = map[string]bool{
	"PHONE_COMPANION": true, "LAN_BIND_IP": true, "BIND_IP": true, "HOST_GATEWAY": true,
	"HOMELAB_DOMAIN": true, "COMPANION_PROXY_KEY": true, "NPM_HTTP_PORT": true, "NPM_HTTPS_PORT": true,
	"ADGUARD_DNS_BIND_IP": true, "TAILSCALE_HOST": true, "TAILSCALE_ROUTES": true, "TAILSCALE_EXTRA_ARGS": true,
}

// phoneMayChange reports whether a phone allowed to make changes may change
// a setting: an everyday one, not a secret nor one it connects through.
func phoneMayChange(s settings.Setting) bool {
	return !s.Secret && !phoneConnects[s.Key] && !strings.HasPrefix(s.Key, "TAILSCALE_")
}

// listPhoneSettings is the Settings form as a phone gets it.
func listPhoneSettings(root string) (phoneSettings, error) {
	list, err := settings.List(root)
	if err != nil {
		return phoneSettings{}, err
	}
	out := phoneSettings{Settings: list, ComputerOnly: []string{}}
	for _, s := range list {
		if !phoneMayChange(s) {
			out.ComputerOnly = append(out.ComputerOnly, s.Key)
		}
	}
	return out, nil
}

// maxPhoneSetting is the longest value a phone may save for a setting: a
// path or an address, never a file's worth.
const maxPhoneSetting = 1024

// savePhoneSettings saves what a phone changed: only everyday settings
// .env.example knows, each checked before any is written, so a refused one
// saves none. The error names the key, never the value.
func savePhoneSettings(root string, values map[string]string) (phoneSettings, error) {
	if len(values) == 0 {
		return phoneSettings{}, errors.New("SaveSettings takes the settings to change")
	}
	list, err := settings.List(root)
	if err != nil {
		return phoneSettings{}, err
	}
	known := map[string]settings.Setting{}
	for _, s := range list {
		known[s.Key] = s
	}
	keys := make([]string, 0, len(values))
	for k := range values {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		s, ok := known[k]
		switch {
		case !ok:
			return phoneSettings{}, fmt.Errorf("%s is not a homelab setting", k)
		case !phoneMayChange(s):
			return phoneSettings{}, fmt.Errorf("%s is changed on the computer, not from a phone", k)
		case len(values[k]) > maxPhoneSetting:
			return phoneSettings{}, fmt.Errorf("%s is longer than a setting can be", k)
		}
	}
	if err := settings.Save(root, values); err != nil {
		return phoneSettings{}, err
	}
	return listPhoneSettings(root)
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
	// A household member's phone may call it too (member.go).
	member := func(m companion.Method) companion.Method {
		m.Member = true
		return m
	}
	// A change from a phone waits its turn (turn.go) behind any other,
	// from a phone, the app, or the nightly jobs, as the command it runs.
	run := func(ctx context.Context, args ...string) ([]string, error) {
		lines, err := h.runSelf(ctx, args...)
		return append([]string{"$ homelab " + strings.Join(args, " ")}, lines...), err
	}
	return map[string]companion.Method{
		"Host": read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			p := host.Current()
			_, _, err := core.Containers(ctx)
			return phoneHost{OS: p.Name, Machine: p.Machine, Runtime: p.Runtime, Scheduler: p.Scheduler, Supported: p.Supported, RootOK: true, RuntimeOK: err == nil, Version: version}, nil
		}),
		"Screen": member(read(func(context.Context, []json.RawMessage) (any, error) { return "status", nil })),
		// The agent's last reading, drawn at once while Status reads a fresh one.
		"LastStatus": member(read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			if r, ok := core.LastStatus(ctx, root); ok {
				st, err := h.forCaller(ctx, r.Status)
				r.Status = st
				return &r, err
			}
			return nil, nil
		})),
		"Catalog": member(read(func(context.Context, []json.RawMessage) (any, error) {
			c, err := core.Catalog(root)
			if err != nil {
				return nil, err
			}
			return api.CatalogOf(c), nil
		})),
		// A household member's phone gets only the apps they use (member.go).
		"Status": member(read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			st, err := core.Status(ctx, root)
			if err != nil {
				return st, err
			}
			return h.forCaller(ctx, st)
		})),
		// Status with the cards beside it in one request, each sent as it
		// is read; the cards the phone does not show say so.
		"StatusBoard": {Member: true, Stream: func(ctx context.Context, args []json.RawMessage, result func(any, error), event func(string, any)) {
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			var n int
			var want []string
			if len(args) == 2 {
				_ = json.Unmarshal(args[0], &n)
				_ = json.Unmarshal(args[1], &want)
			}
			st, err := core.Status(ctx, root)
			if err == nil {
				st, err = h.forCaller(ctx, st)
			}
			result(st, err)
			if err != nil {
				return
			}
			// A member's phone: their apps, and none of the homelab's cards.
			if _, isMember, _ := h.member(ctx); isMember {
				for _, name := range want {
					event("status:card", board.Card{Board: n, Name: name, Error: board.NotHere})
				}
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
		// Every alert the computer kept (internal/history), with when each cleared and who snoozed it, every
		// line through phoneLog's redaction; a wall screen, which anyone walking past can read, isn't shown
		// which phone snoozed one.
		"AlertLog": read(func(ctx context.Context, _ []json.RawMessage) (any, error) {
			list, err := history.AlertsIn(root, 0)
			kiosk := false
			if d, ok := companion.Caller(ctx); ok && d.Kiosk {
				kiosk = true
			}
			for i := range list {
				list[i].Title, list[i].Body, list[i].SnoozedBy = h.phoneLog(list[i].Title), h.phoneLog(list[i].Body), h.phoneLog(list[i].SnoozedBy)
				if kiosk {
					list[i].SnoozedBy = ""
				}
			}
			return list, err
		}),
		"Protection":    read(func(ctx context.Context, _ []json.RawMessage) (any, error) { return core.Protection(ctx, root) }),
		"Watchdog": read(func(context.Context, []json.RawMessage) (any, error) {
			return health.LoadState(health.StatePath(root)).Summary(), nil
		}),
		// An app's icon for its page, as the app on this machine kept it; a
		// phone never makes it ask the app.
		"AppIcon": member(read(func(ctx context.Context, args []json.RawMessage) (any, error) {
			var id string
			if len(args) > 0 {
				_ = json.Unmarshal(args[0], &id)
			}
			if p, isMember, err := h.member(ctx); err != nil || (isMember && !p.Uses(id)) {
				return nil, err
			}
			return appicon.Kept(root, id), nil
		})),
		"SavingsHistory": read(func(context.Context, []json.RawMessage) (any, error) {
			return savings.LoadHistory(savings.HistoryPath(root)), nil
		}),
		// What was done (internal/history), to look at: [app, search, before],
		// each optional. The owner's phones only (a member's isn't one of
		// them), every line through phoneLog's redaction.
		"History": read(func(ctx context.Context, args []json.RawMessage) (any, error) {
			// It names the household's phones and what each did: not for a
			// wall screen, which anyone walking past can read.
			if d, ok := companion.Caller(ctx); ok && d.Kiosk {
				return nil, errors.New("a wall screen does not show what was done: use a phone, or Homelab Wizard on the computer")
			}
			var f history.Filter
			if len(args) > 0 {
				_ = json.Unmarshal(args[0], &f.App)
			}
			if len(args) > 1 {
				_ = json.Unmarshal(args[1], &f.Search)
			}
			if len(args) > 2 {
				_ = json.Unmarshal(args[2], &f.Before)
			}
			entries, err := history.List(root, f)
			for i := range entries {
				entries[i].Text = h.phoneLog(entries[i].Text)
				entries[i].Who = h.phoneLog(entries[i].Who)
			}
			return entries, err
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
		"Finances": {Member: true, Finances: companion.FinancesView, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			froot, err := h.financeRoot(ctx)
			if err != nil {
				return nil, nil, err
			}
			p, err := finance.Load(finance.Path(froot))
			l, lerr := finance.LoadLedger(finance.LedgerPath(froot))
			if lerr != nil {
				l = finance.Ledger{} // Transactions says why
			}
			v := finance.ProjectWith(p, l, time.Now(), finance.Ahead)
			d, _ := companion.Caller(ctx)
			v.ReadOnly = !companion.FinancesAllow(d.Finances, companion.FinancesEdit)
			return v, nil, err
		}},
		// The money card, for a wall screen allowed it (or any phone that
		// sees Finances): a few facts, never the plan, and no amount at all
		// while Hide amounts is on.
		"FinancesWall": {Member: true, Finances: companion.FinancesCard, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			froot, err := h.financeRoot(ctx)
			if err != nil {
				return nil, nil, err
			}
			p, err := finance.Load(finance.Path(froot))
			if err != nil {
				return nil, nil, err
			}
			l, lerr := finance.LoadLedger(finance.LedgerPath(froot))
			if lerr != nil {
				l = finance.Ledger{}
			}
			return finance.WallCard(finance.ProjectWith(p, l, time.Now(), finance.Ahead), 3), nil, nil
		}},
		// A save from a phone is refused, as on the computer, when the
		// plan changed after the phone read it (finance.ErrChanged).
		"SaveFinances": {Member: true, Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			froot, err := h.financeRoot(ctx)
			if err != nil {
				return nil, nil, err
			}
			var p finance.Plan
			if len(args) < 1 || json.Unmarshal(args[0], &p) != nil {
				return nil, nil, errors.New("SaveFinances takes the plan")
			}
			saved, err := finance.Save(finance.Path(froot), p)
			if err != nil {
				return nil, nil, err
			}
			h.recordFinances(froot, whoAsked(ctx), "Changed the Finances plan")
			l, lerr := finance.LoadLedger(finance.LedgerPath(froot))
			if lerr != nil {
				l = finance.Ledger{}
			}
			return finance.ProjectWith(saved, l, time.Now(), finance.Ahead), nil, nil
		}},
		// The household's money a member's phone may see, to look at: only
		// what the owner shares (homelab person share), names, amounts and
		// days, never an account or the ledger (member.go).
		"FinancesShared": {Member: true, Finances: companion.FinancesView, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			p, isMember, err := h.member(ctx)
			if err != nil {
				return nil, nil, err
			}
			if !isMember {
				return nil, nil, errors.New("the household's own Finances are on this phone already")
			}
			if len(p.Shares) == 0 {
				return memberShared{Shares: []string{}}, nil, nil
			}
			plan, err := finance.Load(finance.Path(root))
			if err != nil {
				return nil, nil, err
			}
			l, lerr := finance.LoadLedger(finance.LedgerPath(root))
			if lerr != nil {
				l = finance.Ledger{}
			}
			now := time.Now()
			return sharedFor(finance.ProjectWith(plan, l, now, finance.Ahead), p, now), nil, nil
		}},
		// The ledger, what actually happened, goes to the same phones the
		// plan does, at the same levels, and is refused when stale as it is.
		"FinancesLedger": {Member: true, Finances: companion.FinancesView, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			froot, err := h.financeRoot(ctx)
			if err != nil {
				return nil, nil, err
			}
			l, err := finance.LoadLedger(finance.LedgerPath(froot))
			return l, nil, err
		}},
		"SaveFinancesLedger": {Member: true, Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			froot, err := h.financeRoot(ctx)
			if err != nil {
				return nil, nil, err
			}
			var l finance.Ledger
			if len(args) < 1 || json.Unmarshal(args[0], &l) != nil {
				return nil, nil, errors.New("SaveFinancesLedger takes the ledger")
			}
			p, err := finance.Load(finance.Path(froot))
			if err != nil {
				return nil, nil, err
			}
			saved, err := finance.SaveLedger(finance.LedgerPath(froot), l, p)
			if err != nil {
				return nil, nil, err
			}
			h.recordFinances(froot, whoAsked(ctx), "Changed Finances' transactions")
			return saved, nil, nil
		}},
		// Investments, as the card on the computer has them (internal/ghostfolio):
		// Read now, a ticker looked up, and a buy or a sale put into Ghostfolio.
		// Each writes the plan (or Ghostfolio), so a phone needs Finances' edit
		// level, over the https link, as for any save. Read now answers as the
		// app's does: the plan read forward, the Ghostfolio accounts nothing
		// matched, and how many accounts and holdings Ghostfolio has.
		"FinancesReadInvestments": {Finances: companion.FinancesEdit, Call: func(ctx context.Context, _ []json.RawMessage) (any, []string, error) {
			ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
			defer cancel()
			r, err := ghostfolio.ReadInto(ctx, root)
			if err != nil {
				return nil, nil, err
			}
			return investmentsRead(root, r), nil, nil
		}},
		"FinancesFindSymbol": {Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var query string
			if len(args) < 1 || json.Unmarshal(args[0], &query) != nil {
				return nil, nil, errors.New("FinancesFindSymbol takes what was typed: a ticker or a name")
			}
			ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
			defer cancel()
			found, err := ghostfolio.FindSymbol(ctx, core.Env(root), query)
			return found, nil, err
		}},
		"FinancesAddInvestment": {Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var add ghostfolio.Add
			if len(args) < 1 || json.Unmarshal(args[0], &add) != nil {
				return nil, nil, errors.New("FinancesAddInvestment takes the buy or sale: account (or newName), symbol, dataSource, currency, shares, total, date, sold")
			}
			ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
			defer cancel()
			if err := ghostfolio.AddInvestment(ctx, root, add); err != nil {
				return nil, nil, err
			}
			r, err := ghostfolio.ReadInto(ctx, root)
			if err != nil {
				return nil, nil, err
			}
			return investmentsRead(root, r), nil, nil
		}},
		// A buy or a sale typed wrong, put right from the card: listed under
		// its holding, changed, or deleted in Ghostfolio, then read again.
		"FinancesInvestmentTrades": {Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var account, symbol string
			if len(args) < 2 || json.Unmarshal(args[0], &account) != nil || json.Unmarshal(args[1], &symbol) != nil {
				return nil, nil, errors.New("FinancesInvestmentTrades takes the account's id and the holding's symbol")
			}
			ctx, cancel := context.WithTimeout(ctx, 20*time.Second)
			defer cancel()
			list, err := ghostfolio.Trades(ctx, root, account, symbol)
			return list, nil, err
		}},
		"FinancesChangeInvestment": {Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var t ghostfolio.Trade
			if len(args) < 1 || json.Unmarshal(args[0], &t) != nil {
				return nil, nil, errors.New("FinancesChangeInvestment takes the buy or sale: id, account, shares, total, date, sold")
			}
			ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
			defer cancel()
			if err := ghostfolio.ChangeTrade(ctx, root, t); err != nil {
				return nil, nil, err
			}
			r, err := ghostfolio.ReadInto(ctx, root)
			if err != nil {
				return nil, nil, err
			}
			return investmentsRead(root, r), nil, nil
		}},
		"FinancesDeleteInvestment": {Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var account, id string
			if len(args) < 2 || json.Unmarshal(args[0], &account) != nil || json.Unmarshal(args[1], &id) != nil {
				return nil, nil, errors.New("FinancesDeleteInvestment takes the account's id and the buy or sale's id")
			}
			ctx, cancel := context.WithTimeout(ctx, 45*time.Second)
			defer cancel()
			if err := ghostfolio.DeleteTrade(ctx, root, account, id); err != nil {
				return nil, nil, err
			}
			r, err := ghostfolio.ReadInto(ctx, root)
			if err != nil {
				return nil, nil, err
			}
			return investmentsRead(root, r), nil, nil
		}},
		// Receipts go with the ledger: a phone that may change it may keep one
		// (from its camera), and one that may only look may see them.
		"FinancesReceipt": {Member: true, Finances: companion.FinancesView, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			froot, err := h.financeRoot(ctx)
			if err != nil {
				return nil, nil, err
			}
			var name string
			if len(args) < 1 || json.Unmarshal(args[0], &name) != nil {
				return nil, nil, errors.New("FinancesReceipt takes the receipt's name")
			}
			r, err := finance.ReadReceipt(finance.ReceiptsDir(froot), name)
			return r, nil, err
		}},
		"SaveFinancesReceipt": {Member: true, Finances: companion.FinancesEdit, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			froot, err := h.financeRoot(ctx)
			if err != nil {
				return nil, nil, err
			}
			var data string
			if len(args) < 1 || json.Unmarshal(args[0], &data) != nil {
				return nil, nil, errors.New("SaveFinancesReceipt takes the receipt")
			}
			name, err := finance.SaveReceipt(finance.ReceiptsDir(froot), data)
			return name, nil, err
		}},
		// The Settings form (.env), for the native app's Settings screen:
		// read by any paired phone but a wall screen, over the https link
		// only; everyday settings changed by one allowed to make changes.
		// Secrets, and the settings a phone connects through, stay on the
		// computer (phoneMayChange).
		"Settings": {Private: true, Call: func(context.Context, []json.RawMessage) (any, []string, error) {
			v, err := listPhoneSettings(root)
			return v, nil, err
		}},
		"SaveSettings": {Change: true, Private: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var values map[string]string
			if len(args) < 1 || json.Unmarshal(args[0], &values) != nil {
				return nil, nil, errors.New("SaveSettings takes the settings to change")
			}
			v, err := savePhoneSettings(root, values)
			if err != nil {
				return nil, nil, err
			}
			if len(values) > 0 {
				h.record("settings", "", whoAsked(ctx), history.SettingsChanged(values))
			}
			return v, nil, nil
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
		// Stop for a while, as the computer's StopUntil.
		"StopUntil": {Change: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var id, until string
			if len(args) < 2 || json.Unmarshal(args[0], &id) != nil || json.Unmarshal(args[1], &until) != nil || until == "" {
				return nil, nil, errors.New("StopUntil takes an app and when it starts again")
			}
			if err := h.containerApp(id); err != nil {
				return nil, nil, err
			}
			log, err := run(ctx, "stop", id, "--until", until)
			return nil, log, err
		}},
		// The groups folded on Status, kept by the computer so every device shows the same (internal/statusfolds).
		// Reading is the owner's phones'; saving is a change, so a phone that only looks keeps its own.
		"StatusFolds": read(func(context.Context, []json.RawMessage) (any, error) { return statusfolds.Load(root), nil }),
		"SetStatusFolds": {Change: true, Call: func(_ context.Context, args []json.RawMessage) (any, []string, error) {
			var open map[string]bool
			if len(args) < 1 || json.Unmarshal(args[0], &open) != nil || open == nil {
				return nil, nil, errors.New("SetStatusFolds takes each group's name and whether it is open")
			}
			return nil, nil, statusfolds.Save(root, open)
		}},
		// Snooze… on a failing check, from a phone allowed to change things (as the computer's SnoozeCheck): no
		// alerts about it for so many hours, up to a week; 0 alerts again now.
		"SnoozeCheck": {Change: true, Call: func(ctx context.Context, args []json.RawMessage) (any, []string, error) {
			var check string
			var hours int
			if len(args) < 2 || json.Unmarshal(args[0], &check) != nil || json.Unmarshal(args[1], &hours) != nil {
				return nil, nil, errors.New("SnoozeCheck takes a check and how many hours")
			}
			return nil, nil, notify.SnoozeHoursBy(root, check, hours, whoAsked(ctx))
		}},
		// An app's own settings, from its page: its nightly update, the
		// watchdog's alerts about it, whether it is pinned to the top, and
		// whether a public one is reached away from home (as the
		// computer's SetAppSetting).
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
			case "sundays":
				if err := h.containerApp(id); err != nil {
					return nil, nil, err
				}
				cmd = []string{"updates", "days", id, map[bool]string{true: "sun", false: "every"}[on]}
			case "alerts":
				cmd = []string{"notify", map[bool]string{true: "on", false: "off"}[on], id}
			case "pinned":
				cmd = []string{map[bool]string{true: "pin", false: "unpin"}[on], id}
			case "away":
				cmd = []string{"away", map[bool]string{true: "on", false: "off"}[on], id}
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
	// The record of what was done says which phone asked (internal/history).
	c.Env = append(os.Environ(), actorEnv+"="+whoAsked(ctx))
	out, err := c.CombinedOutput()
	text := strings.TrimRight(string(out), "\n")
	if text == "" {
		return nil, err
	}
	return strings.Split(text, "\n"), err
}

// phoneCmd pairs phones with the companion and manages the paired ones.
func (h *homelab) phoneCmd(ctx context.Context, args []string) error {
	u := h.ui
	store := companion.NewStore(companion.StorePath(h.root))
	sub := ""
	if len(args) > 0 {
		sub, args = args[0], args[1:]
	}
	switch sub {
	case "away":
		return h.phoneAway(ctx, args)
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
			if !d.Until.IsZero() {
				can += " until " + d.Until.Local().Format("2 Jan 15:04")
			}
			if d.Person != "" {
				can = d.PersonName + "'s: their apps only"
			}
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
			return fmt.Errorf("usage: homelab phone finances <id or name> off|card|view|edit")
		}
		d, err := store.SetFinances(args[0], args[1])
		switch {
		case err != nil:
		case d.Finances == companion.FinancesEdit:
			u.OK("%s can see Finances and change them", d.Name)
		case d.Finances == companion.FinancesView:
			u.OK("%s can see Finances but not change them", d.Name)
		case d.Finances == companion.FinancesCard:
			u.OK("%s shows only the money card: the next payday, what is left after it, and the next bills", d.Name)
		default:
			u.OK("%s no longer sees Finances", d.Name)
		}
		return err
	case "person":
		// homelab phone person <phone> <name>|none: whose phone it is. A
		// member's phone sees only their apps and their own Finances.
		if len(args) != 2 {
			return fmt.Errorf("usage: homelab phone person <id or name> <person>|none")
		}
		username, name := "", ""
		if who := args[1]; who != "none" && who != "me" {
			list, err := people.Load(people.Path(h.root))
			if err != nil {
				return err
			}
			i, ok := people.Find(list, who)
			if !ok || !list[i].Active() {
				return fmt.Errorf("%s is not in the household (homelab person list)", who)
			}
			if !memberName.MatchString(list[i].Username) {
				return fmt.Errorf("%s's username %q can't name a folder of their own", list[i].Name, list[i].Username)
			}
			username, name = list[i].Username, list[i].Name
		}
		d, err := store.SetPerson(args[0], username, name)
		switch {
		case err != nil:
		case username == "":
			u.OK("%s is yours again: it sees the whole homelab, as allowed", d.Name)
		default:
			u.OK("%s is %s's now: their apps and their own Finances, nothing else", d.Name, name)
			if d.Finances == "" {
				u.Printf("  %s\n", u.Dim("For their Finances: homelab phone finances "+d.ID+" edit. What of the household's they see: homelab person share "+username+"."))
			}
		}
		return err
	case "until":
		// homelab phone until <phone> 7d: its changes and Finances end in a
		// week, and it only looks; never takes the end off.
		if len(args) != 2 {
			return fmt.Errorf("usage: homelab phone until <id or name> 12h|7d|2w|never")
		}
		var until time.Time
		if args[1] != "never" {
			d, err := parseFor(args[1])
			if err != nil {
				return err
			}
			until = time.Now().Add(d)
		}
		d, err := store.SetUntil(args[0], until)
		switch {
		case err != nil:
		case until.IsZero():
			u.OK("%s keeps what it may do until you change it", d.Name)
		default:
			u.OK("%s may do more than look until %s; then it only looks", d.Name, until.Local().Format("Mon 2 Jan 15:04"))
		}
		return err
	}
	return fmt.Errorf("usage: homelab phone pair|list|allow|read-only|finances|person|until|remove|away")
}

// parseFor reads how long, as homelab phone until takes it: 12h, 7d, 2w.
func parseFor(s string) (time.Duration, error) {
	unit := map[byte]time.Duration{'h': time.Hour, 'd': 24 * time.Hour, 'w': 7 * 24 * time.Hour}
	if len(s) >= 2 {
		if u, ok := unit[s[len(s)-1]]; ok {
			if n, err := strconv.Atoi(s[:len(s)-1]); err == nil && n > 0 {
				return time.Duration(n) * u, nil
			}
		}
	}
	return 0, fmt.Errorf("%q is not a length of time: 12h, 7d, or 2w", s)
}

// phoneInvestments is what Read now (or a buy or a sale) answers a phone,
// as the desktop app's InvestmentsRead does: the plan read forward, the
// names of Ghostfolio's accounts no account in it matched, and how many
// accounts and holdings Ghostfolio has, matched or not.
type phoneInvestments struct {
	View      finance.View `json:"view"`
	Unmatched []string     `json:"unmatched"`
	Accounts  int          `json:"accounts"`
	Holdings  int          `json:"holdings"`
}

func investmentsRead(root string, r ghostfolio.Read) phoneInvestments {
	l, err := finance.LoadLedger(finance.LedgerPath(root))
	if err != nil {
		l = finance.Ledger{}
	}
	return phoneInvestments{View: finance.ProjectWith(r.Plan, l, time.Now(), finance.Ahead), Unmatched: r.Unmatched, Accounts: r.Accounts, Holdings: r.Holdings}
}
