package main

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/companion"
	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/history"
	"github.com/Snooper42/homelab-wizard/internal/people"
)

// A member's private Finances (private-finances.md 3.3): her phone seals
// them, the computer keeps the envelope it can't open, and only her own
// phone reaches it. Made-up figures only.

var anna = people.Person{Username: "anna", Name: "Anna", Apps: []string{"immich-server"}, Shares: []string{"bills"}}

func phoneOf(p people.Person) context.Context {
	return companion.WithCaller(context.Background(), companion.Device{ID: "phone-" + p.Username, Person: p.Username, PersonName: p.Name, CanChange: true, Finances: companion.FinancesEdit})
}

// sealedByPhone is an envelope as her phone would seal it (the test has
// the key; the computer never does).
func sealedByPhone(t *testing.T, plain string) json.RawMessage {
	t.Helper()
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	seal := func(msg []byte) string {
		block, _ := aes.NewCipher(key)
		gcm, _ := cipher.NewGCM(block)
		nonce := make([]byte, 12)
		_, _ = rand.Read(nonce)
		return base64.StdEncoding.EncodeToString(append(nonce, gcm.Seal(nil, nonce, msg, []byte("v1 anna"))...))
	}
	salt := base64.StdEncoding.EncodeToString(make([]byte, 16))
	b, _ := json.Marshal(map[string]any{
		"version":          1,
		"kdf":              map[string]any{"name": "scrypt", "salt": salt, "n": 1 << 17, "r": 8, "p": 1},
		"wrappedByPasskey": seal(make([]byte, 32)),
		"wrappedByCode":    seal(make([]byte, 32)),
		"sealed":           seal([]byte(plain)),
	})
	return b
}

func str(s string) json.RawMessage { b, _ := json.Marshal(s); return b }

// turnOn is her phone turning privacy on: her plain plan first, as today.
func turnOn(t *testing.T, h *homelab, plain string) (rev string) {
	t.Helper()
	m := h.phoneMethods()
	ctx := phoneOf(anna)
	plan, _ := json.Marshal(finance.Plan{Rev: "new", Currency: "USD", Accounts: []finance.Account{{Name: "Example Checking", Kind: finance.Checking, Balance: 812.34}}})
	if _, _, err := m["SaveFinances"].Call(ctx, []json.RawMessage{plan}); err != nil {
		t.Fatal(err)
	}
	got, _, err := m["SaveFinancesSealed"].Call(ctx, []json.RawMessage{str("new"), sealedByPhone(t, plain)})
	if err != nil {
		t.Fatalf("turning privacy on: %v", err)
	}
	return got.(sealedSaved).Rev
}

// Her envelope comes back only to her own phone; it is kept 0600 in her
// 0700 folder and holds nothing her phone sealed.
func TestHerPrivateFinancesAreKeptSealed(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna, sam})
	m := h.phoneMethods()
	none, _, err := m["FinancesSealed"].Call(phoneOf(anna), nil)
	if err != nil || none != nil {
		t.Fatalf("none yet: %v %v", none, err)
	}
	rev := turnOn(t, h, `{"accounts":[{"name":"Example Checking","balance":812.34}]}`)
	got, _, err := m["FinancesSealed"].Call(phoneOf(anna), nil)
	if err != nil {
		t.Fatal(err)
	}
	if e, ok := got.(finance.Envelope); !ok || e.Rev != rev || e.Sealed == "" {
		t.Errorf("her envelope: %+v", got)
	}
	path := finance.SealedPath(memberRoot(h.root, "anna"))
	data, _ := os.ReadFile(path)
	for _, plain := range []string{"Example Checking", "812.34"} {
		if bytes.Contains(data, []byte(plain)) {
			t.Errorf("%q readable on the computer", plain)
		}
	}
	if runtime.GOOS != "windows" {
		if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
			t.Errorf("file %v", info.Mode().Perm())
		}
		if info, _ := os.Stat(filepath.Dir(path)); info.Mode().Perm() != 0o700 {
			t.Errorf("folder %v", info.Mode().Perm())
		}
	}
	// Sam's phone sees none of hers: its own, none yet.
	if got, _, err := m["FinancesSealed"].Call(phoneOf(sam), nil); err != nil || got != nil {
		t.Errorf("Sam's phone: %v %v", got, err)
	}
}

// Only a member's own phone: the owner's phones, a wall screen, a phone
// given to someone removed or never added are refused, in the method itself.
func TestOnlyHerPhoneReachesThem(t *testing.T) {
	removed := people.Person{Username: "lee", Name: "Lee", Removed: time.Now()}
	h := memberHomelab(t, []people.Person{anna, removed})
	m := h.phoneMethods()
	for name, ctx := range map[string]context.Context{
		"the owner's phone":      companion.WithCaller(context.Background(), companion.Device{ID: "o", CanChange: true, Finances: companion.FinancesEdit}),
		"no phone at all":        context.Background(),
		"a wall screen":          companion.WithCaller(context.Background(), companion.Device{ID: "w", Person: "anna", Kiosk: true, Finances: companion.FinancesEdit}),
		"a removed member's":     phoneOf(removed),
		"someone never added":    phoneOf(people.Person{Username: "nobody", Name: "Nobody"}),
		"a username into a path": phoneOf(people.Person{Username: "../anna", Name: "Anna"}),
	} {
		for _, method := range []string{"FinancesSealed", "SaveFinancesSealed", "UnsealFinances", "FinancesSealedReceipt", "SaveFinancesSealedReceipt"} {
			args := []json.RawMessage{str("new"), sealedByPhone(t, "x")}
			if _, _, err := m[method].Call(ctx, args); err == nil {
				t.Errorf("%s: %s answered", name, method)
			}
		}
	}
	if _, err := os.Stat(finance.SealedPath(h.root)); !os.IsNotExist(err) {
		t.Error("an envelope was written for the household")
	}
	for _, method := range []string{"FinancesSealed", "SaveFinancesSealed", "UnsealFinances", "FinancesSealedReceipt", "SaveFinancesSealedReceipt"} {
		mm := m[method]
		if !mm.Member || mm.Finances == "" {
			t.Errorf("%s: Member %v, Finances %q", method, mm.Member, mm.Finances)
		}
	}
	if m["FinancesSealed"].Finances != companion.FinancesView || m["FinancesSealedReceipt"].Finances != companion.FinancesView {
		t.Error("reading hers needs the view level")
	}
	for _, method := range []string{"SaveFinancesSealed", "UnsealFinances", "SaveFinancesSealedReceipt"} {
		if m[method].Finances != companion.FinancesEdit {
			t.Errorf("%s needs the edit level", method)
		}
	}
}

// Once sealed, nothing plain is written for her again: every plain
// Finances call from her phone is refused in one plain line, and what the
// owner shares with her still answers.
func TestOnceSealedThePlainCallsAreRefused(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna})
	m := h.phoneMethods()
	ctx := phoneOf(anna)
	turnOn(t, h, "x")
	plan, _ := json.Marshal(finance.Plan{Rev: "new"})
	ledger, _ := json.Marshal(finance.Ledger{Rev: "new"})
	for method, args := range map[string][]json.RawMessage{
		"Finances": nil, "SaveFinances": {plan}, "FinancesLedger": nil, "SaveFinancesLedger": {ledger},
		"FinancesReceipt": {str(strings.Repeat("a", 32) + ".jpg")}, "SaveFinancesReceipt": {str("data:image/png;base64,iVBORw0KGgo=")}, "FinancesWall": nil,
	} {
		_, _, err := m[method].Call(ctx, args)
		if !errors.Is(err, errPrivate) {
			t.Errorf("%s: %v", method, err)
		}
	}
	if !strings.Contains(errPrivate.Error(), "private") || !strings.Contains(errPrivate.Error(), "your own phone") {
		t.Errorf("the words: %q", errPrivate)
	}
	if _, err := os.Stat(finance.Path(memberRoot(h.root, "anna"))); !os.IsNotExist(err) {
		t.Errorf("a plain plan was written for her: %v", err)
	}
	if _, _, err := m["FinancesShared"].Call(ctx, nil); err != nil {
		t.Errorf("what's shared with her: %v", err)
	}
	// The owner's own Finances are untouched by hers.
	owner := companion.WithCaller(context.Background(), companion.Device{ID: "o", CanChange: true, Finances: companion.FinancesEdit})
	if _, _, err := m["Finances"].Call(owner, nil); err != nil {
		t.Errorf("the owner's: %v", err)
	}
}

// Turning privacy on removes her plain files only after the sealed save;
// a save that fails leaves them as they were.
func TestTurningOnRemovesThePlainOnlyAfterTheSave(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna})
	m := h.phoneMethods()
	ctx := phoneOf(anna)
	froot := memberRoot(h.root, "anna")
	plan, _ := json.Marshal(finance.Plan{Rev: "new", Currency: "USD"})
	if _, _, err := m["SaveFinances"].Call(ctx, []json.RawMessage{plan}); err != nil {
		t.Fatal(err)
	}
	receipt, _, err := m["SaveFinancesReceipt"].Call(ctx, []json.RawMessage{str("data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==")})
	if err != nil {
		t.Fatal(err)
	}
	bad := []json.RawMessage{str("new"), json.RawMessage(`{"version":1,"sealed":"x"}`)}
	if _, _, err := m["SaveFinancesSealed"].Call(ctx, bad); err == nil {
		t.Fatal("a bad envelope was kept")
	}
	if _, _, err := m["SaveFinancesSealed"].Call(ctx, []json.RawMessage{str("stale"), sealedByPhone(t, "x")}); !errors.Is(err, finance.ErrChanged) {
		t.Fatalf("a stale first save: %v", err)
	}
	if _, err := os.Stat(finance.Path(froot)); err != nil {
		t.Fatalf("a failed save removed her plan: %v", err)
	}
	if _, err := os.Stat(filepath.Join(finance.ReceiptsDir(froot), receipt.(string))); err != nil {
		t.Fatalf("a failed save removed her receipt: %v", err)
	}
	if _, _, err := m["SaveFinancesSealed"].Call(ctx, []json.RawMessage{str("new"), sealedByPhone(t, "x")}); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{finance.Path(froot), filepath.Join(finance.ReceiptsDir(froot), receipt.(string))} {
		if _, err := os.Stat(p); !os.IsNotExist(err) {
			t.Errorf("%s left plain: %v", filepath.Base(p), err)
		}
	}
}

// A stale save is refused as a plan's is; a later one with the rev read goes in.
func TestASealedSaveReadBeforeAnotherIsRefused(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna})
	m := h.phoneMethods()
	ctx := phoneOf(anna)
	first := turnOn(t, h, "one")
	got, _, err := m["SaveFinancesSealed"].Call(ctx, []json.RawMessage{str(first), sealedByPhone(t, "two")})
	if err != nil {
		t.Fatal(err)
	}
	if _, _, err := m["SaveFinancesSealed"].Call(ctx, []json.RawMessage{str(first), sealedByPhone(t, "three")}); !errors.Is(err, finance.ErrChanged) {
		t.Errorf("stale: %v", err)
	}
	if _, _, err := m["SaveFinancesSealed"].Call(ctx, []json.RawMessage{str(got.(sealedSaved).Rev)}); err == nil {
		t.Error("a save with no envelope")
	}
}

// Her sealed receipts: kept and read back by the hash of their sealed bytes.
func TestHerSealedReceipts(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna})
	m := h.phoneMethods()
	ctx := phoneOf(anna)
	turnOn(t, h, "x")
	blob := base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{7}, 200))
	name, _, err := m["SaveFinancesSealedReceipt"].Call(ctx, []json.RawMessage{str(blob)})
	if err != nil {
		t.Fatal(err)
	}
	back, _, err := m["FinancesSealedReceipt"].Call(ctx, []json.RawMessage{str(name.(string))})
	if err != nil || back != blob {
		t.Errorf("read back: %v", err)
	}
	if _, _, err := m["FinancesSealedReceipt"].Call(ctx, []json.RawMessage{str("../../finance.json")}); err == nil {
		t.Error("a path read")
	}
}

// Turning privacy off, from her phone: her plain plan and ledger saved
// back, the envelope and her sealed receipts removed; only the envelope
// she read may be turned off.
func TestTurningPrivacyOff(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna})
	m := h.phoneMethods()
	ctx := phoneOf(anna)
	rev := turnOn(t, h, "x")
	froot := memberRoot(h.root, "anna")
	if _, err := finance.SaveSealedReceipt(finance.ReceiptsDir(froot), base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{1}, 64))); err != nil {
		t.Fatal(err)
	}
	plan, _ := json.Marshal(finance.Plan{Currency: "USD", Accounts: []finance.Account{{Name: "Example Checking", Kind: finance.Checking, Balance: 20}}})
	ledger, _ := json.Marshal(finance.Ledger{})
	if _, _, err := m["UnsealFinances"].Call(ctx, []json.RawMessage{str("stale"), plan, ledger}); !errors.Is(err, finance.ErrChanged) {
		t.Fatalf("a stale turn off: %v", err)
	}
	if _, _, err := m["UnsealFinances"].Call(ctx, []json.RawMessage{str(rev), plan, ledger}); err != nil {
		t.Fatal(err)
	}
	if finance.HasSealed(froot) {
		t.Error("still sealed")
	}
	if entries, _ := os.ReadDir(finance.ReceiptsDir(froot)); len(entries) != 0 {
		t.Errorf("sealed receipts left: %d", len(entries))
	}
	v, _, err := m["Finances"].Call(ctx, nil)
	if err != nil {
		t.Fatalf("plain again: %v", err)
	}
	if acc := v.(finance.View).Plan.Accounts; len(acc) != 1 || acc[0].Name != "Example Checking" {
		t.Errorf("her plan back: %+v", acc)
	}
}

// What the computer says of her, to the owner: that she keeps her Finances
// private and when she last saved them, nothing else.
func TestThePeopleRowSaysOnlyThatTheyArePrivate(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna, sam})
	turnOn(t, h, "x")
	got := privateFinances(h.root, []people.Person{anna, sam})
	if len(got) != 1 || got["anna"].IsZero() || time.Since(got["anna"]) > time.Minute {
		t.Errorf("private: %v", got)
	}
	if _, ok := got["sam"]; ok {
		t.Error("Sam's aren't private")
	}
}

// Remove asks whether to keep her private Finances (kept by default), and
// says plainly the owner can delete them but never open them; deleting
// takes the envelope and her sealed receipts, nothing else of hers.
func TestRemovingHerKeepsThemUnlessAsked(t *testing.T) {
	if !strings.Contains(privateOnRemove(false), "keep") || !strings.Contains(privateOnRemove(false), "never open") {
		t.Errorf("keeping: %q", privateOnRemove(false))
	}
	if !strings.Contains(privateOnRemove(true), "delete") || !strings.Contains(privateOnRemove(true), "never open") {
		t.Errorf("deleting: %q", privateOnRemove(true))
	}
	h := memberHomelab(t, []people.Person{anna})
	turnOn(t, h, "x")
	froot := memberRoot(h.root, "anna")
	if _, err := finance.SaveSealedReceipt(finance.ReceiptsDir(froot), base64.StdEncoding.EncodeToString(bytes.Repeat([]byte{2}, 64))); err != nil {
		t.Fatal(err)
	}
	other := filepath.Join(froot, "data", "notes.txt")
	if err := os.WriteFile(other, []byte("hers"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := deletePrivateFinances(froot); err != nil {
		t.Fatal(err)
	}
	if finance.HasSealed(froot) {
		t.Error("still there")
	}
	if entries, _ := os.ReadDir(finance.ReceiptsDir(froot)); len(entries) != 0 {
		t.Errorf("sealed receipts left: %d", len(entries))
	}
	if _, err := os.Stat(other); err != nil {
		t.Errorf("something else of hers went: %v", err)
	}
}

// Nothing the computer keeps of its own says anything of hers: no entry in
// the record of what was done (history), whatever her phone saves.
func TestHerSavesLeaveNoRecord(t *testing.T) {
	h := memberHomelab(t, []people.Person{anna})
	m := h.phoneMethods()
	rev := turnOn(t, h, "x")
	if _, _, err := m["SaveFinancesSealed"].Call(phoneOf(anna), []json.RawMessage{str(rev), sealedByPhone(t, "y")}); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(history.Path(h.root)); !os.IsNotExist(err) {
		db, err := history.Open(h.root)
		if err != nil {
			t.Fatal(err)
		}
		defer db.Close()
		if got, _ := db.List(history.Filter{Limit: 50}); len(got) != 0 {
			t.Errorf("recorded: %+v", got)
		}
	}
}
