package finance

import (
	"bytes"
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
)

// fakePhone seals what a member's phone would (private-finances.md 3.1):
// a random data key, AES-256-GCM, wrapped by the code. The computer never
// has the key; the test does, to show the file holds nothing readable.
func fakePhone(t *testing.T, plain string) Envelope {
	t.Helper()
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	seal := func(k, msg []byte) string {
		block, err := aes.NewCipher(k)
		if err != nil {
			t.Fatal(err)
		}
		gcm, _ := cipher.NewGCM(block)
		nonce := make([]byte, gcm.NonceSize())
		_, _ = rand.Read(nonce)
		return base64.StdEncoding.EncodeToString(append(nonce, gcm.Seal(nil, nonce, msg, []byte("v1 sam"))...))
	}
	wrap := make([]byte, 32)
	_, _ = rand.Read(wrap)
	salt := make([]byte, 16)
	_, _ = rand.Read(salt)
	return Envelope{
		Version:          1,
		KDF:              SealKDF{Name: "scrypt", Salt: base64.StdEncoding.EncodeToString(salt), N: 1 << 17, R: 8, P: 1},
		WrappedByPasskey: seal(wrap, key),
		WrappedByCode:    seal(wrap, key),
		Sealed:           seal(key, []byte(plain)),
	}
}

func TestASealedEnvelopeIsKeptWhole(t *testing.T) {
	root := t.TempDir()
	path := SealedPath(root)
	if _, ok, err := LoadSealed(path); ok || err != nil {
		t.Fatalf("none yet: %v %v", ok, err)
	}
	plan := `{"accounts":[{"name":"Example Checking","balance":1234.56}]}`
	e := fakePhone(t, plan)
	saved, err := SaveSealed(path, "new", e)
	if err != nil {
		t.Fatal(err)
	}
	if saved.Rev == "" || saved.Rev == "new" {
		t.Errorf("rev %q", saved.Rev)
	}
	got, ok, err := LoadSealed(path)
	if err != nil || !ok || got.Rev != saved.Rev || got.Sealed != e.Sealed || got.WrappedByCode != e.WrappedByCode || got.KDF != e.KDF {
		t.Fatalf("read back: %+v %v %v", got, ok, err)
	}
	data, _ := os.ReadFile(path)
	for _, plain := range []string{"Example Checking", "1234.56", "accounts"} {
		if bytes.Contains(data, []byte(plain)) {
			t.Errorf("%q readable in the file", plain)
		}
	}
	var fields map[string]json.RawMessage
	if err := json.Unmarshal(data, &fields); err != nil {
		t.Fatal(err)
	}
	for k := range fields {
		switch k {
		case "version", "kdf", "wrappedByPasskey", "wrappedByCode", "sealed":
		default:
			t.Errorf("the file holds %q", k)
		}
	}
	if runtime.GOOS != "windows" {
		if info, _ := os.Stat(path); info.Mode().Perm() != 0o600 {
			t.Errorf("mode %v", info.Mode().Perm())
		}
	}
}

// One saved after this was read is refused, as a plan's is; so is a
// first save when there is one already.
func TestAStaleSealedSaveIsRefused(t *testing.T) {
	path := SealedPath(t.TempDir())
	first, err := SaveSealed(path, "new", fakePhone(t, "one"))
	if err != nil {
		t.Fatal(err)
	}
	second, err := SaveSealed(path, first.Rev, fakePhone(t, "two"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := SaveSealed(path, first.Rev, fakePhone(t, "three")); !errors.Is(err, ErrChanged) {
		t.Errorf("a stale rev: %v", err)
	}
	if _, err := SaveSealed(path, "new", fakePhone(t, "four")); !errors.Is(err, ErrChanged) {
		t.Errorf("a first save over one: %v", err)
	}
	if _, err := SaveSealed(path, "", fakePhone(t, "five")); !errors.Is(err, ErrChanged) {
		t.Errorf("no rev at all: %v", err)
	}
	got, _, _ := LoadSealed(path)
	if got.Rev != second.Rev {
		t.Error("a refused save changed the file")
	}
	if err := RemoveSealed(path, first.Rev); !errors.Is(err, ErrChanged) {
		t.Errorf("a stale remove: %v", err)
	}
	if err := RemoveSealed(path, second.Rev); err != nil {
		t.Fatal(err)
	}
	if _, ok, _ := LoadSealed(path); ok {
		t.Error("still there")
	}
}

// The computer checks the envelope's shape and size, never what is inside.
func TestOnlyAnEnvelopeOfTheRightShapeIsKept(t *testing.T) {
	good := fakePhone(t, "x")
	for name, change := range map[string]func(e *Envelope){
		"another version":    func(e *Envelope) { e.Version = 2 },
		"no code wrap":       func(e *Envelope) { e.WrappedByCode = "" },
		"not base64":         func(e *Envelope) { e.Sealed = "not base64!" },
		"a wrap too short":   func(e *Envelope) { e.WrappedByCode = base64.StdEncoding.EncodeToString([]byte("short")) },
		"nothing sealed":     func(e *Envelope) { e.Sealed = "" },
		"too large":          func(e *Envelope) { e.Sealed = base64.StdEncoding.EncodeToString(make([]byte, MaxSealed+1)) },
		"an unknown stretch": func(e *Envelope) { e.KDF.Name = "md5" },
		"a weak scrypt":      func(e *Envelope) { e.KDF.N = 1 << 10 },
		"scrypt not 2^n":     func(e *Envelope) { e.KDF.N = 100000 },
		"a short salt":       func(e *Envelope) { e.KDF.Salt = base64.StdEncoding.EncodeToString([]byte("salt")) },
		"a weak argon2id": func(e *Envelope) {
			e.KDF = SealKDF{Name: "argon2id", Salt: e.KDF.Salt, Time: 1, Memory: 1024, Threads: 1}
		},
		"a rev written in":    func(e *Envelope) { e.Rev = "abc" },
		"a bad passkey id":    func(e *Envelope) { e.KDF.Passkey = "%%" },
		"a short phrase salt": func(e *Envelope) { e.KDF.PassphraseSalt = base64.StdEncoding.EncodeToString([]byte("s")) },
	} {
		e := good
		change(&e)
		if _, err := SaveSealed(SealedPath(t.TempDir()), "new", e); err == nil {
			t.Errorf("%s: kept", name)
		}
	}
	argon := good
	argon.KDF = SealKDF{Name: "argon2id", Salt: good.KDF.Salt, Time: 3, Memory: 64 << 10, Threads: 1, PassphraseSalt: good.KDF.Salt, Passkey: base64.StdEncoding.EncodeToString([]byte("credential-id"))}
	argon.WrappedByPasskey = ""
	if _, err := SaveSealed(SealedPath(t.TempDir()), "new", argon); err != nil {
		t.Errorf("argon2id, a passphrase, no passkey wrap: %v", err)
	}
}

// What's sent is read strictly: a field the envelope doesn't have is refused.
func TestParseEnvelopeRefusesMore(t *testing.T) {
	b, _ := json.Marshal(fakePhone(t, "x"))
	if _, err := ParseEnvelope(b); err != nil {
		t.Fatal(err)
	}
	more := strings.Replace(string(b), `"version":1`, `"version":1,"plan":{"accounts":[]}`, 1)
	if _, err := ParseEnvelope([]byte(more)); err == nil {
		t.Error("an envelope with the plan beside it was kept")
	}
	if _, err := ParseEnvelope(make([]byte, MaxSealed*2)); err == nil {
		t.Error("too large to read")
	}
}

// A sealed receipt is named by a hash of its sealed bytes, so its name
// says nothing of what is in it.
func TestASealedReceiptIsNamedForItsBytes(t *testing.T) {
	dir := ReceiptsDir(t.TempDir())
	blob := make([]byte, 100)
	_, _ = rand.Read(blob)
	name, err := SaveSealedReceipt(dir, base64.StdEncoding.EncodeToString(blob))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(name, ".sealed") || len(name) != 32+len(".sealed") {
		t.Errorf("name %q", name)
	}
	again, _ := SaveSealedReceipt(dir, base64.StdEncoding.EncodeToString(blob))
	if again != name {
		t.Error("the same bytes, another name")
	}
	got, err := ReadSealedReceipt(dir, name)
	if err != nil || got != base64.StdEncoding.EncodeToString(blob) {
		t.Errorf("read back: %v", err)
	}
	for _, bad := range []string{"../finance.json", "abc.jpg", strings.Repeat("a", 32) + ".jpg", name + "/x"} {
		if _, err := ReadSealedReceipt(dir, bad); err == nil {
			t.Errorf("%q read", bad)
		}
	}
	if _, err := SaveSealedReceipt(dir, base64.StdEncoding.EncodeToString(make([]byte, MaxReceipt+65))); err == nil {
		t.Error("too large kept")
	}
	if _, err := SaveSealedReceipt(dir, base64.StdEncoding.EncodeToString([]byte("short"))); err == nil {
		t.Error("too short to be sealed kept")
	}
	if runtime.GOOS != "windows" {
		if info, _ := os.Stat(filepath.Join(dir, name)); info.Mode().Perm() != 0o600 {
			t.Errorf("mode %v", info.Mode().Perm())
		}
	}
}

// Turning privacy on leaves nothing plain behind: the plan, the ledger,
// the receipts, the cards' pictures and prices; a sealed receipt stays.
func TestRemovePlainFinances(t *testing.T) {
	root := t.TempDir()
	for _, p := range []string{Path(root), LedgerPath(root), filepath.Join(root, "data", "finance-card-prices.json"),
		filepath.Join(ReceiptsDir(root), strings.Repeat("a", 32)+".jpg"), filepath.Join(CardPicturesDir(root), strings.Repeat("b", 32)+".png")} {
		if err := os.MkdirAll(filepath.Dir(p), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(p, []byte("plain"), 0o600); err != nil {
			t.Fatal(err)
		}
	}
	kept := filepath.Join(ReceiptsDir(root), strings.Repeat("c", 32)+".sealed")
	if err := os.WriteFile(kept, []byte("sealed"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := RemovePlainFinances(root); err != nil {
		t.Fatal(err)
	}
	var left []string
	_ = filepath.WalkDir(filepath.Join(root, "data"), func(p string, d os.DirEntry, err error) error {
		if err == nil && !d.IsDir() {
			left = append(left, filepath.Base(p))
		}
		return nil
	})
	if len(left) != 1 || left[0] != filepath.Base(kept) {
		t.Errorf("left: %v", left)
	}
}
