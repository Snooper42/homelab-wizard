package main

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/settings"
	"github.com/Snooper42/homelab-wizard/internal/ui"
)

func TestPhoneCommands(t *testing.T) {
	root, _ := repoCopy(t, "HOMELAB_DOMAIN=example.com")
	out, code := homelabCmd(t, root, "", "phone", "pair", "--name", "Kitchen iPad")
	m := regexp.MustCompile(`https://homelab\.example\.com/#pair=([A-Z0-9]{8})`).FindStringSubmatch(out)
	if code != 0 || m == nil || !strings.Contains(out, "█") || !strings.Contains(out, "does not see Finances") {
		t.Fatalf("pair (exit %d):\n%s", code, out)
	}
	if out, _ := homelabCmd(t, root, "", "phone", "list"); !strings.Contains(out, "no phones paired yet") {
		t.Errorf("a code alone is not a phone:\n%s", out)
	}
	if out, code := homelabCmd(t, root, "", "phone", "remove", "nobody"); code == 0 || !strings.Contains(out, "no paired phone") {
		t.Errorf("remove an unknown phone (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "phone", "pair", "--finances", "everything"); code == 0 || !strings.Contains(out, "off, card, view, or edit") {
		t.Errorf("pair with an unknown Finances level (exit %d):\n%s", code, out)
	}

	// Finances, phone by phone.
	store := companion.NewStore(companion.StorePath(root))
	pairCode, _ := store.NewPairing("Anna's iPhone", false, "")
	if _, _, err := store.Pair(pairCode, ""); err != nil {
		t.Fatal(err)
	}
	for _, c := range []struct{ level, said, listed string }{
		{"view", "can see Finances but not change them", "sees finances"},
		{"edit", "can see Finances and change them", "edits finances"},
		{"off", "no longer sees Finances", "no finances"},
	} {
		if out, code := homelabCmd(t, root, "", "phone", "finances", "anna's iphone", c.level); code != 0 || !strings.Contains(out, c.said) {
			t.Errorf("finances %s (exit %d):\n%s", c.level, code, out)
		}
		if out, _ := homelabCmd(t, root, "", "phone", "list"); !strings.Contains(out, c.listed) {
			t.Errorf("list after finances %s:\n%s", c.level, out)
		}
	}
	if out, code := homelabCmd(t, root, "", "phone", "finances", "Anna's iPhone"); code == 0 || !strings.Contains(out, "usage") {
		t.Errorf("finances without a level (exit %d):\n%s", code, out)
	}

	// Until a time: listed with it, and taken off with never.
	homelabCmd(t, root, "", "phone", "allow", "Anna's iPhone")
	if out, code := homelabCmd(t, root, "", "phone", "until", "anna's iphone", "7d"); code != 0 || !strings.Contains(out, "may do more than look until") {
		t.Errorf("until 7d (exit %d):\n%s", code, out)
	}
	if out, _ := homelabCmd(t, root, "", "phone", "list"); !strings.Contains(out, "can make changes until") {
		t.Errorf("list does not say until when:\n%s", out)
	}
	if out, code := homelabCmd(t, root, "", "phone", "until", "anna's iphone", "never"); code != 0 || !strings.Contains(out, "until you change it") {
		t.Errorf("until never (exit %d):\n%s", code, out)
	}
	if out, code := homelabCmd(t, root, "", "phone", "until", "anna's iphone", "soon"); code == 0 || !strings.Contains(out, "not a length of time") {
		t.Errorf("until soon (exit %d):\n%s", code, out)
	}
}

// The phone's Finances are the computer's plan: a phone allowed to look
// gets it marked read-only, one allowed to edit saves it, and a save from
// a plan read before another device's is refused.
func TestPhoneFinances(t *testing.T) {
	root, _ := repoCopy(t)
	path := finance.Path(root)
	if _, err := finance.Save(path, finance.Plan{Cushion: 300, Accounts: []finance.Account{{Name: "Checking", Kind: finance.Checking, Balance: 1200}}}); err != nil {
		t.Fatal(err)
	}
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	store := companion.NewStore(companion.StorePath(root))
	srv := httptest.NewServer((&companion.Server{Store: store, Methods: h.phoneMethods()}).Handler())
	defer srv.Close()
	pair := func(name, level string) string {
		code, _ := store.NewPairing(name, false, level)
		_, token, err := store.Pair(code, "")
		if err != nil {
			t.Fatal(err)
		}
		return token
	}
	call := func(token, method, body string) (int, map[string]json.RawMessage) {
		t.Helper()
		req, _ := http.NewRequest(http.MethodPost, srv.URL+"/api/call/"+method, strings.NewReader(body))
		req.Header.Set("Authorization", "Bearer "+token)
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		defer resp.Body.Close()
		var out map[string]json.RawMessage
		_ = json.NewDecoder(resp.Body).Decode(&out)
		return resp.StatusCode, out
	}
	read := func(token string) finance.View {
		t.Helper()
		code, out := call(token, "Finances", "[]")
		var v finance.View
		if code != 200 || json.Unmarshal(out["result"], &v) != nil {
			t.Fatalf("Finances: %d %s", code, out["error"])
		}
		return v
	}

	looker, editor := pair("Kitchen iPad", "view"), pair("Anna's iPhone", "edit")
	if v := read(looker); !v.ReadOnly || v.Plan.Cushion != 300 || len(v.Periods) == 0 {
		t.Errorf("a phone allowed to look: readOnly %v, cushion %v, %d periods", v.ReadOnly, v.Plan.Cushion, len(v.Periods))
	}
	v := read(editor)
	if v.ReadOnly || v.Plan.Rev == "" {
		t.Fatalf("a phone allowed to edit: readOnly %v rev %q", v.ReadOnly, v.Plan.Rev)
	}

	// The computer saves after the phone read the plan.
	computer, _ := finance.Load(path)
	computer.Cushion = 450
	if _, err := finance.Save(path, computer); err != nil {
		t.Fatal(err)
	}
	stale := v.Plan
	stale.Cushion = 800
	body, _ := json.Marshal([]any{stale})
	if code, out := call(editor, "SaveFinances", string(body)); code != 500 || !strings.Contains(string(out["error"]), "changed on another device") {
		t.Errorf("a save over the computer's: %d %s", code, out["error"])
	}
	fresh := read(editor).Plan
	fresh.Cushion = 800
	body, _ = json.Marshal([]any{fresh})
	if code, out := call(editor, "SaveFinances", string(body)); code != 200 {
		t.Errorf("a save after reading again: %d %s", code, out["error"])
	}
	if got, _ := finance.Load(path); got.Cushion != 800 {
		t.Errorf("kept cushion %v, want 800", got.Cushion)
	}
	if code, _ := call(looker, "SaveFinances", string(body)); code != 403 {
		t.Errorf("a save from a phone allowed only to look: %d", code)
	}
	if code, _ := call(editor, "SaveFinances", "[]"); code != 500 {
		t.Errorf("a save without the plan: %d", code)
	}

	// The ledger: both phones read it; the one that may change Finances saves
	// a transaction on the plan's account, the one that may only look cannot.
	code, out := call(looker, "FinancesLedger", "[]")
	var l finance.Ledger
	if code != 200 || json.Unmarshal(out["result"], &l) != nil || l.Rev == "" {
		t.Fatalf("FinancesLedger: %d %s", code, out["error"])
	}
	l.Transactions = append(l.Transactions, finance.Transaction{Date: "2026-10-30", Account: fresh.Accounts[0].ID, Amount: -12, Payee: "Coffee"})
	body, _ = json.Marshal([]any{l})
	if code, _ := call(looker, "SaveFinancesLedger", string(body)); code != 403 {
		t.Errorf("a ledger save from a phone allowed only to look: %d", code)
	}
	if code, out := call(editor, "SaveFinancesLedger", string(body)); code != 200 {
		t.Errorf("a ledger save: %d %s", code, out["error"])
	}
	if got, _ := finance.LoadLedger(finance.LedgerPath(root)); len(got.Transactions) != 1 {
		t.Errorf("kept %d transactions, want 1", len(got.Transactions))
	}
	if code, out := call(editor, "SaveFinancesLedger", string(body)); code != 500 || !strings.Contains(string(out["error"]), "changed on another device") {
		t.Errorf("the same ledger saved twice: %d %s", code, out["error"])
	}
	if code, _ := call(editor, "SaveFinancesLedger", "[]"); code != 500 {
		t.Errorf("a ledger save without the ledger: %d", code)
	}

	// A receipt: the phone that may change Finances keeps one, both read it.
	receipt, _ := json.Marshal([]string{"data:application/pdf;base64," + base64.StdEncoding.EncodeToString([]byte("%PDF-1.4 a receipt"))})
	if code, _ := call(looker, "SaveFinancesReceipt", string(receipt)); code != 403 {
		t.Errorf("a receipt from a phone allowed only to look: %d", code)
	}
	code, out = call(editor, "SaveFinancesReceipt", string(receipt))
	var name string
	if code != 200 || json.Unmarshal(out["result"], &name) != nil || !strings.HasSuffix(name, ".pdf") {
		t.Fatalf("SaveFinancesReceipt: %d %s", code, out["error"])
	}
	asked, _ := json.Marshal([]string{name})
	code, out = call(looker, "FinancesReceipt", string(asked))
	var back string
	if code != 200 || json.Unmarshal(out["result"], &back) != nil || back != "data:application/pdf;base64,"+base64.StdEncoding.EncodeToString([]byte("%PDF-1.4 a receipt")) {
		t.Errorf("FinancesReceipt: %d %s %.40s", code, out["error"], back)
	}
	for _, m := range []string{"SaveFinancesReceipt", "FinancesReceipt"} {
		if code, _ := call(editor, m, "[]"); code != 500 {
			t.Errorf("%s with nothing: %d", m, code)
		}
	}
}

// Settings on a phone: the form as the computer lists it, secrets only set
// or not; everyday settings change; secrets and the settings a phone
// connects through are the computer's, and a refused change saves nothing.
func TestPhoneSettings(t *testing.T) {
	root, _ := repoCopy(t, "TZ=Europe/Lisbon", "HOMELAB_DOMAIN=example.com", "NPM_API_PASSWORD=hunter2hunter2", "PHONE_COMPANION=true")
	h, err := newHomelab(&ui.UI{Out: &strings.Builder{}}, root)
	if err != nil {
		t.Fatal(err)
	}
	methods := h.phoneMethods()
	if !methods["Settings"].Private || !methods["SaveSettings"].Private || !methods["SaveSettings"].Change || methods["Settings"].Change {
		t.Fatal("Settings must go over https only, and only a phone allowed changes may save them")
	}
	call := func(name string, args ...any) (any, error) {
		t.Helper()
		var raw []json.RawMessage
		for _, a := range args {
			b, _ := json.Marshal(a)
			raw = append(raw, b)
		}
		v, _, err := methods[name].Call(context.Background(), raw)
		return v, err
	}
	env := func() string {
		data, _ := os.ReadFile(filepath.Join(root, ".env"))
		return string(data)
	}

	v, err := call("Settings")
	if err != nil {
		t.Fatal(err)
	}
	form := v.(phoneSettings)
	byKey := map[string]settings.Setting{}
	for _, s := range form.Settings {
		byKey[s.Key] = s
	}
	if byKey["TZ"].Value != "Europe/Lisbon" {
		t.Errorf("TZ as the computer lists it: %+v", byKey["TZ"])
	}
	if pw := byKey["NPM_API_PASSWORD"]; !pw.Secret || !pw.Set || pw.Value != "" {
		t.Errorf("a secret says only that it is set: %+v", pw)
	}
	only := strings.Join(form.ComputerOnly, " ")
	for _, k := range []string{"NPM_API_PASSWORD", "COMPANION_PROXY_KEY", "HOMELAB_DOMAIN", "PHONE_COMPANION", "LAN_BIND_IP", "TAILSCALE_HOST", "TAILSCALE_AUTHKEY"} {
		if !strings.Contains(" "+only+" ", " "+k+" ") {
			t.Errorf("%s is not kept for the computer", k)
		}
	}
	if strings.Contains(" "+only+" ", " TZ ") {
		t.Error("TZ, an everyday setting, is kept for the computer")
	}

	if _, err := call("SaveSettings", map[string]string{"TZ": "America/Chicago", "BATTERY_SAVER": "false"}); err != nil {
		t.Fatal(err)
	}
	if e := env(); !strings.Contains(e, "TZ=America/Chicago") || !strings.Contains(e, "BATTERY_SAVER=false") {
		t.Fatalf("saved:\n%s", e)
	}
	before := env()
	for _, c := range []struct {
		values map[string]string
		want   string
	}{
		{map[string]string{"NPM_API_PASSWORD": "mine-now-1234"}, "changed on the computer"},
		{map[string]string{"HOMELAB_DOMAIN": "elsewhere.example"}, "changed on the computer"},
		{map[string]string{"PHONE_COMPANION": "false"}, "changed on the computer"},
		{map[string]string{"TAILSCALE_HOST": "elsewhere"}, "changed on the computer"},
		{map[string]string{"TZ": "Asia/Tokyo", "LAN_BIND_IP": "10.9.9.9"}, "changed on the computer"},
		{map[string]string{"NOT_A_SETTING": "1"}, "not a homelab setting"},
		{map[string]string{"TZ": "Asia/Tokyo\nPHONE_COMPANION=false"}, "cannot span lines"},
		{map[string]string{"TZ": strings.Repeat("a", 2000)}, "longer than"},
		{map[string]string{}, "takes the settings"},
	} {
		_, err := call("SaveSettings", c.values)
		if err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("SaveSettings %v: %v, want %q", c.values, err, c.want)
		}
		for _, value := range c.values {
			if value != "" && err != nil && strings.Contains(err.Error(), value) {
				t.Errorf("the error shows the value: %v", err)
			}
		}
		if after := env(); after != before {
			t.Errorf("a refused save changed .env (%v):\n%s", c.values, after)
		}
	}
	if _, err := call("SaveSettings"); err == nil {
		t.Error("SaveSettings without the settings")
	}
}
