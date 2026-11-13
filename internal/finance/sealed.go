package finance

import (
	"bytes"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// A household member's Finances, sealed on her own phone so only she can
// read them, the owner included (.claude/prompts/private-finances.md): her
// phone makes a random data key, seals her plan and ledger with it
// (AES-256-GCM), and wraps the key by her passkey (or a passphrase) and by a
// recovery code. The computer keeps the one envelope it can't open, beside
// where her plain files were, and hands it only to her own phone; it checks
// the envelope's shape and size, never what is inside, and nothing it runs
// (reminders, the calendar feed, the wall card, the history) reads it.

// Envelope is a member's sealed Finances as her phone sends them. Bytes are
// standard base64. Rev is the file's, as a plan's is: never written to it.
type Envelope struct {
	Version int     `json:"version"`
	Rev     string  `json:"rev,omitempty"`
	KDF     SealKDF `json:"kdf"`
	// WrappedByPasskey is the data key wrapped by her passkey's PRF output,
	// or, on a phone without it, by her passphrase stretched as KDF says
	// (PassphraseSalt set); WrappedByCode, by her recovery code.
	WrappedByPasskey string `json:"wrappedByPasskey,omitempty"`
	WrappedByCode    string `json:"wrappedByCode"`
	// Sealed is her plan and ledger: a 96-bit nonce, then the ciphertext and its tag.
	Sealed string `json:"sealed"`
}

// SealKDF is how her recovery code (and a passphrase) is stretched into a
// wrapping key: scrypt (N, R, P) or Argon2id (Time, Memory in KiB, Threads),
// with its salt; Passkey is the passkey's credential id, for her phone to
// ask for it by.
type SealKDF struct {
	Name           string `json:"name"`
	Salt           string `json:"salt"`
	N              int    `json:"n,omitempty"`
	R              int    `json:"r,omitempty"`
	P              int    `json:"p,omitempty"`
	Time           int    `json:"t,omitempty"`
	Memory         int    `json:"m,omitempty"`
	Threads        int    `json:"threads,omitempty"`
	PassphraseSalt string `json:"passphraseSalt,omitempty"`
	Passkey        string `json:"passkey,omitempty"`
}

// MaxSealed is the most her sealed plan and ledger may be, so the envelope,
// in base64, fits in one call from her phone (companion.MaxCall, 4 MB).
const MaxSealed = 2900 << 10

// A wrapped key: a nonce, the 32-byte key, a tag (60 bytes), with room for
// another way of wrapping it.
const (
	minWrapped = 12 + 32 + 16
	maxWrapped = 256
)

// SealedPath is a member's sealed Finances in her folder (memberRoot).
func SealedPath(root string) string { return filepath.Join(root, "data", "finance.sealed") }

// ParseEnvelope reads an envelope as sent, strictly: nothing but its own
// fields, and no larger than one may be.
func ParseEnvelope(data []byte) (Envelope, error) {
	var e Envelope
	if len(data) > MaxSealed*4/3+64<<10 {
		return e, errors.New("the private Finances are too large to keep")
	}
	dec := json.NewDecoder(bytes.NewReader(data))
	dec.DisallowUnknownFields()
	if err := dec.Decode(&e); err != nil {
		return e, errors.New("that isn't private Finances as a phone seals them")
	}
	return e, nil
}

func decoded(s string, min, max int) bool {
	if base64.StdEncoding.DecodedLen(len(s)) > max+3 {
		return false
	}
	b, err := base64.StdEncoding.DecodeString(s)
	return err == nil && len(b) >= min && len(b) <= max
}

// check is whether e has an envelope's shape: never what is in it.
func (e Envelope) check() error {
	bad := func(what string) error {
		return fmt.Errorf("that isn't private Finances as a phone seals them: %s", what)
	}
	if e.Version != 1 {
		return bad("its version")
	}
	if e.Rev != "" {
		return bad("a rev written in")
	}
	if !decoded(e.WrappedByCode, minWrapped, maxWrapped) {
		return bad("the recovery code's key")
	}
	if e.WrappedByPasskey != "" && !decoded(e.WrappedByPasskey, minWrapped, maxWrapped) {
		return bad("the passkey's key")
	}
	if !decoded(e.Sealed, 12+16, MaxSealed) {
		if base64.StdEncoding.DecodedLen(len(e.Sealed)) > MaxSealed {
			return fmt.Errorf("the private Finances are too large to keep: at most %d MB", MaxSealed>>20)
		}
		return bad("what's sealed")
	}
	k := e.KDF
	if !decoded(k.Salt, 16, 64) || (k.PassphraseSalt != "" && !decoded(k.PassphraseSalt, 16, 64)) || (k.Passkey != "" && !decoded(k.Passkey, 1, 1024)) {
		return bad("how the code is stretched")
	}
	switch k.Name {
	case "scrypt":
		// N=2^17, r=8, p=1 asked for; nothing weaker than 2^15 kept.
		if k.N < 1<<15 || k.N > 1<<20 || k.N&(k.N-1) != 0 || k.R < 8 || k.R > 32 || k.P < 1 || k.P > 16 || k.Time != 0 || k.Memory != 0 || k.Threads != 0 {
			return bad("scrypt's settings")
		}
	case "argon2id":
		// At least OWASP's least: 19 MiB and 2 passes.
		if k.Time < 2 || k.Time > 10 || k.Memory < 19<<10 || k.Memory > 1<<21 || k.Threads < 1 || k.Threads > 8 || k.N != 0 || k.R != 0 || k.P != 0 {
			return bad("Argon2id's settings")
		}
	default:
		return bad("how the code is stretched")
	}
	return nil
}

// LoadSealed reads a member's envelope; ok false when there is none.
func LoadSealed(path string) (Envelope, bool, error) {
	data, err := os.ReadFile(path) // #nosec G304 -- the homelab's own file, in a member's folder
	if os.IsNotExist(err) {
		return Envelope{}, false, nil
	}
	if err != nil {
		return Envelope{}, false, err
	}
	e, err := ParseEnvelope(data)
	if err != nil {
		return Envelope{}, false, err
	}
	e.Rev = rev(data)
	return e, true, nil
}

// PrivateSince is when a member last saved her private Finances; ok false
// when they aren't private. It is all the computer can say of them.
func PrivateSince(root string) (time.Time, bool) {
	info, err := os.Stat(SealedPath(root))
	if err != nil {
		return time.Time{}, false
	}
	return info.ModTime(), true
}

// HasSealed is whether a member's Finances are private now.
func HasSealed(root string) bool {
	_, err := os.Stat(SealedPath(root))
	return err == nil
}

// SaveSealed checks the envelope's shape and writes it whole, 0600, under
// the lock beside it. was is the Rev it was read at ("new" for the first);
// one read before another save of hers is refused with ErrChanged, as a
// plan's is. The envelope saved comes back with its new Rev.
func SaveSealed(path, was string, e Envelope) (Envelope, error) {
	if err := e.check(); err != nil {
		return e, err
	}
	data, err := json.Marshal(e)
	if err != nil {
		return e, err
	}
	data = append(data, '\n')
	if err := sealedUpdate(path, was, func() []byte { return data }); err != nil {
		return e, err
	}
	e.Rev = rev(data)
	return e, nil
}

// RemoveSealed removes a member's envelope (privacy turned off, from her
// phone), if it is still the one read at was.
func RemoveSealed(path, was string) error {
	return sealedUpdate(path, was, func() []byte { return nil })
}

func sealedUpdate(path, was string, next func() []byte) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	var refused error
	err := lockedfile.Update(path, 0o600, func(old []byte) ([]byte, bool) {
		now := noFile
		if old != nil {
			now = rev(old)
		}
		if was == "" || now != was {
			refused = ErrChanged
			return nil, false
		}
		return next(), true
	})
	if err == nil {
		err = refused
	}
	return err
}

// sealedName is a sealed receipt's file: a hash of its sealed bytes, so its
// name says nothing of what is in it.
var sealedName = regexp.MustCompile(`^[0-9a-f]{32}\.sealed$`)

// SaveSealedReceipt keeps a receipt sealed on her phone (base64), beside
// her ledger's place, and returns its name. It may be as large as a plain
// receipt, with the nonce and tag.
func SaveSealedReceipt(dir, sealed string) (string, error) {
	if !decoded(sealed, 12+16+1, MaxReceipt+64) {
		if base64.StdEncoding.DecodedLen(len(sealed)) > MaxReceipt+64 {
			return "", fmt.Errorf("a receipt may be at most %d MB", MaxReceipt>>20)
		}
		return "", errors.New("that isn't a receipt as a phone seals it")
	}
	b, _ := base64.StdEncoding.DecodeString(sealed)
	sum := sha256.Sum256(b)
	name := hex.EncodeToString(sum[:16]) + ".sealed"
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	path := filepath.Join(dir, name)
	if _, err := os.Stat(path); err == nil {
		return name, nil
	}
	return name, lockedfile.Write(path, b, 0o600)
}

// ReadSealedReceipt gives a sealed receipt back as her phone sent it.
func ReadSealedReceipt(dir, name string) (string, error) {
	if !sealedName.MatchString(name) {
		return "", errors.New("no such receipt")
	}
	b, err := os.ReadFile(filepath.Join(dir, name)) // #nosec G304 -- a name sealedName allows, in her own folder
	if err != nil {
		return "", errors.New("no such receipt")
	}
	return base64.StdEncoding.EncodeToString(b), nil
}

// RemoveSealedReceipts removes her sealed receipts (privacy turned off:
// her phone read them first, and sends them back plain).
func RemoveSealedReceipts(dir string) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}
	for _, e := range entries {
		if sealedName.MatchString(e.Name()) {
			if err := os.Remove(filepath.Join(dir, e.Name())); err != nil {
				return err
			}
		}
	}
	return nil
}

// RemovePlainFinances removes a member's plain Finances once they are
// sealed: the plan, the ledger, the cards' prices, the plain receipts and
// the cards' pictures. Sealed receipts stay.
func RemovePlainFinances(root string) error {
	var errs []error
	for _, p := range []string{Path(root), LedgerPath(root), filepath.Join(root, "data", "finance-card-prices.json")} {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			errs = append(errs, err)
		}
	}
	if entries, err := os.ReadDir(ReceiptsDir(root)); err == nil {
		for _, e := range entries {
			if !e.IsDir() && !strings.HasSuffix(e.Name(), ".sealed") {
				if err := os.Remove(filepath.Join(ReceiptsDir(root), e.Name())); err != nil {
					errs = append(errs, err)
				}
			}
		}
	}
	if err := os.RemoveAll(CardPicturesDir(root)); err != nil {
		errs = append(errs, err)
	}
	return errors.Join(errs...)
}
