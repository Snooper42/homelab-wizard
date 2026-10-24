// Package envfile edits .env files in place, keeping comments and order.
package envfile

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"math/big"
	"os"
	"path/filepath"
	"regexp"
	"runtime"
	"slices"
	"strconv"
	"strings"

	"github.com/Snooper42/homelab-wizard/internal/kit"
)

// File is a .env file held as lines so edits keep its layout.
type File struct {
	Path    string
	lines   []string
	loaded  []string          // the lines as read, to notice another writer
	changed map[string]string // keys set since loading, in their raw form
	order   []string          // changed keys in the order they were set
}

var assign = regexp.MustCompile(`^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$`)

// Load reads path. A missing file loads as empty.
func Load(path string) (*File, error) {
	f := &File{Path: path}
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return f, nil
	}
	if err != nil {
		return nil, err
	}
	text := strings.TrimSuffix(strings.ReplaceAll(string(data), "\r\n", "\n"), "\n")
	if text != "" {
		f.lines = strings.Split(text, "\n")
	}
	f.loaded = append([]string(nil), f.lines...)
	return f, nil
}

// Exists reports whether the file is on disk.
func (f *File) Exists() bool {
	_, err := os.Stat(f.Path)
	return err == nil
}

// Get returns the last assignment of key (Compose semantics).
func (f *File) Get(key string) (string, bool) {
	val, ok := "", false
	for _, l := range f.lines {
		if m := assign.FindStringSubmatch(l); m != nil && m[1] == key {
			val, ok = unquote(m[2]), true
		}
	}
	return val, ok
}

// Map returns all assignments, later lines winning.
func (f *File) Map() map[string]string {
	out := map[string]string{}
	for _, l := range f.lines {
		if m := assign.FindStringSubmatch(l); m != nil {
			out[m[1]] = unquote(m[2])
		}
	}
	return out
}

// Keys returns assigned keys in first-seen order.
func (f *File) Keys() []string {
	var keys []string
	seen := map[string]bool{}
	for _, l := range f.lines {
		if m := assign.FindStringSubmatch(l); m != nil && !seen[m[1]] {
			seen[m[1]] = true
			keys = append(keys, m[1])
		}
	}
	return keys
}

// BareDollars lists keys whose value has a $ outside quotes, which Compose
// reads as the start of a variable (a password like pa$word arrives as pa).
func (f *File) BareDollars() []string {
	var keys []string
	for _, l := range f.lines {
		if m := assign.FindStringSubmatch(l); m != nil {
			v := strings.TrimLeft(m[2], " \t")
			if v != "" && v[0] != '"' && v[0] != '\'' && strings.Contains(v, "$") {
				keys = append(keys, m[1])
			}
		}
	}
	return keys
}

// Set updates every assignment of key, or appends one.
func (f *File) Set(key, value string) {
	if f.changed == nil {
		f.changed = map[string]string{}
	}
	if _, ok := f.changed[key]; !ok {
		f.order = append(f.order, key)
	}
	f.changed[key] = value
	f.set(key, value)
}

func (f *File) set(key, value string) {
	found := false
	for i, l := range f.lines {
		if m := assign.FindStringSubmatch(l); m != nil && m[1] == key {
			f.lines[i] = key + "=" + quote(value)
			found = true
		}
	}
	if !found {
		f.lines = append(f.lines, key+"="+quote(value))
	}
}

// Save writes the file with 0600 permissions (it holds secrets), never
// in place: a new file is written next to it and renamed over it, so a
// full disk or a crash leaves the old one whole. The previous version is
// kept as .env.bak. If someone else saved it since it was loaded (the app
// and a terminal both open), only the keys set here are written onto
// theirs.
func (f *File) Save() error {
	path := f.Path
	if real, err := filepath.EvalSymlinks(path); err == nil {
		path = real
	}
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	lines := f.lines
	if cur, err := Load(path); err == nil && !slices.Equal(cur.lines, f.loaded) {
		for _, k := range f.order {
			cur.set(k, f.changed[k])
		}
		lines = cur.lines
	}
	tmp, err := os.CreateTemp(dir, ".env-*.tmp")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.WriteString(strings.Join(lines, "\n") + "\n"); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if old, err := os.ReadFile(path); err == nil {
		_ = os.WriteFile(path+".bak", old, 0o600)
		_ = os.Chmod(path+".bak", 0o600)
	}
	if err := os.Rename(tmp.Name(), path); err != nil {
		return err
	}
	f.lines, f.loaded = lines, append([]string(nil), lines...)
	f.changed, f.order = nil, nil
	return nil
}

// unquote reads a value the way Compose does: single quotes are literal
// (\' is a quote), double quotes take \n \r \t \\ \" \$ escapes, and an
// unquoted value ends at " #". Anything after a closing quote is ignored.
func unquote(v string) string {
	v = strings.TrimLeft(v, " \t")
	if v == "" || (v[0] != '"' && v[0] != '\'') {
		if i := strings.Index(v, " #"); i >= 0 {
			v = v[:i]
		}
		return strings.TrimRight(v, " \t")
	}
	q := v[0]
	var b strings.Builder
	for i := 1; i < len(v); i++ {
		c := v[i]
		if c == '\\' && i+1 < len(v) {
			n := v[i+1]
			switch {
			case n == q:
				b.WriteByte(q)
				i++
				continue
			case q == '"' && n == 'n':
				b.WriteByte('\n')
			case q == '"' && n == 'r':
				b.WriteByte('\r')
			case q == '"' && n == 't':
				b.WriteByte('\t')
			case q == '"' && (n == '\\' || n == '$'):
				b.WriteByte(n)
			default: // kept as written, as Compose does
				b.WriteByte(c)
				b.WriteByte(n)
			}
			i++
			continue
		}
		if c == q {
			return b.String()
		}
		b.WriteByte(c)
	}
	return v // no closing quote: keep the line as written
}

// bare are the characters a value may hold without quotes.
var bare = regexp.MustCompile(`^[A-Za-z0-9_./:@%+,=~^-]*$`)

// quote writes a value so Compose reads it back exactly: bare when it is
// plain, otherwise in double quotes with \\ \" \$ and line breaks escaped,
// so no $ is ever taken for a variable and no value spans lines.
func quote(v string) string {
	if bare.MatchString(v) {
		return v
	}
	r := strings.NewReplacer(`\`, `\\`, `"`, `\"`, `$`, `\$`, "\n", `\n`, "\r", `\r`)
	return `"` + r.Replace(v) + `"`
}

// Placeholder matches template values that must be replaced with a secret.
var Placeholder = regexp.MustCompile(`^(__REPLACE_ME__|replace-me[\w-]*|change-?me[\w-]*)$`)

// Change records one edit made by Prepare.
type Change struct {
	Key    string
	Reason string
	Secret bool
	Value  string
}

// Identity supplies host facts for a new .env; overridable in tests.
type Identity struct {
	UID, GID int
	TimeZone string
	// Media replaces the template's Mac media drive (/Volumes/Media) in a
	// new .env: a Media folder in the home folder off the Mac, "" on it.
	Media string
	// DNSBind is where AdGuard Home's DNS listens (ADGUARD_DNS_BIND_IP):
	// this machine's address when systemd-resolved holds 127.0.0.53:53,
	// "" otherwise.
	DNSBind string
	// MusicInApp is where Navidrome sees the music folder in its container
	// (NAVIDROME_MUSIC_PATH): /music on Windows, whose C:\ paths cannot be
	// container paths; "" elsewhere, which keeps the machine's own path.
	MusicInApp string
}

// macMedia is the media drive .env.example names, as on a Mac.
const macMedia = "/Volumes/Media"

// value returns the identity's value for PUID, PGID, or TZ.
func (id Identity) value(key string) (string, bool) {
	switch {
	case key == "PUID" && id.UID > 0:
		return strconv.Itoa(id.UID), true
	case key == "PGID" && id.UID > 0:
		return strconv.Itoa(id.GID), true
	case key == "TZ" && id.TimeZone != "":
		return id.TimeZone, true
	case key == "ADGUARD_DNS_BIND_IP" && id.DNSBind != "":
		return id.DNSBind, true
	case key == "NAVIDROME_MUSIC_PATH" && id.MusicInApp != "":
		return id.MusicInApp, true
	}
	return "", false
}

// HostIdentity reads the current user's ids, the timezone, and where
// media goes off the Mac.
func HostIdentity() Identity {
	id := Identity{UID: os.Getuid(), GID: os.Getgid()}
	if home, err := os.UserHomeDir(); err == nil && runtime.GOOS != "darwin" {
		id.Media = filepath.Join(home, "Media")
	}
	if runtime.GOOS == "windows" {
		id.MusicInApp = "/music"
	}
	if target, err := os.Readlink("/etc/localtime"); err == nil {
		if i := strings.Index(target, "zoneinfo/"); i >= 0 {
			id.TimeZone = target[i+len("zoneinfo/"):]
		}
	}
	return id
}

// Prepare makes sure .env exists (copying .env.example) and that every
// placeholder secret has a generated value. New files also get the user's
// PUID/PGID and timezone. Existing values are never overwritten.
func Prepare(envPath, examplePath string, id Identity) (*File, []Change, error) {
	env, err := Load(envPath)
	if err != nil {
		return nil, nil, err
	}
	example, err := Load(examplePath)
	if err != nil {
		return nil, nil, err
	}
	var changes []Change
	isNew := !env.Exists()
	if isNew {
		env.lines = append([]string(nil), example.lines...)
		changes = append(changes, Change{Key: ".env", Reason: "created from .env.example"})
	} else {
		current := env.Map()
		// Left empty, AdGuard Home's DNS cannot start where something
		// holds port 53 already; this machine's address is the fix.
		if v, ok := current["ADGUARD_DNS_BIND_IP"]; ok && v == "" && id.DNSBind != "" {
			env.Set("ADGUARD_DNS_BIND_IP", id.DNSBind)
			changes = append(changes, Change{Key: "ADGUARD_DNS_BIND_IP", Reason: "this machine's address, since something holds port 53 on every address:", Value: id.DNSBind})
		}
		for _, k := range example.Keys() {
			if _, ok := current[k]; ok {
				continue
			}
			v, _ := example.Get(k)
			reason := "added from .env.example"
			if own, ok := id.value(k); ok {
				v, reason = own, "added from this machine"
			}
			env.Set(k, v)
			changes = append(changes, Change{Key: k, Reason: reason, Value: v})
		}
	}
	for _, k := range env.Keys() {
		v, _ := env.Get(k)
		// A new file takes every placeholder shape; an existing one only
		// the template's own marker, so a real password that happens to
		// read "changeme" is never replaced under a running database.
		if isNew && Placeholder.MatchString(v) || v == "__REPLACE_ME__" {
			secret, err := NewSecret(k)
			if err != nil {
				return nil, nil, err
			}
			env.Set(k, secret)
			changes = append(changes, Change{Key: k, Reason: "generated secret", Secret: true})
		}
	}
	if isNew {
		if id.UID > 0 {
			env.Set("PUID", strconv.Itoa(id.UID))
			env.Set("PGID", strconv.Itoa(id.GID))
			changes = append(changes, Change{Key: "PUID/PGID", Reason: "set to your account", Value: strconv.Itoa(id.UID) + ":" + strconv.Itoa(id.GID)})
		}
		if id.TimeZone != "" {
			env.Set("TZ", id.TimeZone)
			changes = append(changes, Change{Key: "TZ", Reason: "set to this machine's timezone", Value: id.TimeZone})
		}
		if id.MusicInApp != "" {
			env.Set("NAVIDROME_MUSIC_PATH", id.MusicInApp)
			changes = append(changes, Change{Key: "NAVIDROME_MUSIC_PATH", Reason: "Navidrome's music folder in its container, since a Windows path cannot be one:", Value: id.MusicInApp})
		}
		if id.DNSBind != "" {
			env.Set("ADGUARD_DNS_BIND_IP", id.DNSBind)
			changes = append(changes, Change{Key: "ADGUARD_DNS_BIND_IP", Reason: "this machine's address, since systemd-resolved holds 127.0.0.53:53", Value: id.DNSBind})
		}
		if id.Media != "" {
			for _, k := range env.Keys() {
				v, _ := env.Get(k)
				if rest, ok := strings.CutPrefix(v, macMedia); ok && (rest == "" || rest[0] == '/') {
					v = filepath.Join(id.Media, filepath.FromSlash(rest))
					env.Set(k, v)
					changes = append(changes, Change{Key: k, Reason: "until you pick a drive in Settings › Storage, a Media folder in your home folder:", Value: v})
				}
			}
		}
		// A folder the app made from its kit starts in Home mode: the
		// template's domain is the author's, and Tailscale needs none.
		// It also starts only the small baseline; the household picks the rest.
		if _, ok := kit.Installed(filepath.Dir(examplePath)); ok {
			if v, _ := env.Get("HOMELAB_DOMAIN"); v != "" {
				env.Set("HOMELAB_DOMAIN", "")
				changes = append(changes, Change{Key: "HOMELAB_DOMAIN", Reason: "left empty: addresses on your tailnet (Home mode)"})
			}
			env.Set("HOMELAB_BASELINE", "small")
			changes = append(changes, Change{Key: "HOMELAB_BASELINE", Reason: "up starts only the platform and you pick the apps, so the baseline is", Value: "small"})
		}
	}
	return env, changes, nil
}

// Rehome sets the values that belong to the machine rather than the
// household, in a .env that came from another one (homelab move in): the
// account ids, where AdGuard Home's DNS listens (the old machine's address
// cannot be bound here), and Navidrome's music folder in its container.
// The folders stay as they were; move in checks those.
func Rehome(envPath string, id Identity) ([]Change, error) {
	env, err := Load(envPath)
	if err != nil {
		return nil, err
	}
	var changes []Change
	set := func(key, value, reason string) {
		if v, _ := env.Get(key); v != value {
			env.Set(key, value)
			changes = append(changes, Change{Key: key, Reason: reason, Value: value})
		}
	}
	if id.UID > 0 {
		set("PUID", strconv.Itoa(id.UID), "set to your account on this machine:")
		set("PGID", strconv.Itoa(id.GID), "set to your account on this machine:")
	}
	set("ADGUARD_DNS_BIND_IP", id.DNSBind, "where AdGuard Home's DNS listens on this machine:")
	if v, _ := env.Get("NAVIDROME_MUSIC_PATH"); v == "" && id.MusicInApp != "" {
		set("NAVIDROME_MUSIC_PATH", id.MusicInApp, "Navidrome's music folder in its container, since a Windows path cannot be one:")
	}
	if len(changes) == 0 {
		return nil, nil
	}
	return changes, env.Save()
}

// NewSecret returns a random value shaped for the variable: 64 hex characters
// for encryption/secret keys, otherwise 32 alphanumeric characters.
func NewSecret(key string) (string, error) {
	upper := strings.ToUpper(key)
	if strings.Contains(upper, "ENCRYPTION_KEY") || strings.Contains(upper, "SECRET_KEY") {
		b := make([]byte, 32)
		if _, err := rand.Read(b); err != nil {
			return "", err
		}
		return hex.EncodeToString(b), nil
	}
	const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"
	out := make([]byte, 32)
	for i := range out {
		n, err := rand.Int(rand.Reader, big.NewInt(int64(len(alphabet))))
		if err != nil {
			return "", err
		}
		out[i] = alphabet[n.Int64()]
	}
	return string(out), nil
}
