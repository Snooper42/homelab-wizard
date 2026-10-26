package envfile

import (
	"fmt"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func write(t *testing.T, dir, name, body string) string {
	t.Helper()
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte(body), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}

func TestSetPreservesLayout(t *testing.T) {
	dir := t.TempDir()
	p := write(t, dir, ".env", "# comment\nA=1\n\nB=\"two words\"\nA=3\n")
	f, err := Load(p)
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := f.Get("A"); v != "3" {
		t.Fatalf("last assignment should win, got %q", v)
	}
	if v, _ := f.Get("B"); v != "two words" {
		t.Fatalf("quoted value: %q", v)
	}
	f.Set("A", "9")
	f.Set("C", "has space")
	if err := f.Save(); err != nil {
		t.Fatal(err)
	}
	data, _ := os.ReadFile(p)
	want := "# comment\nA=9\n\nB=\"two words\"\nA=9\nC=\"has space\"\n"
	if string(data) != want {
		t.Fatalf("got:\n%s\nwant:\n%s", data, want)
	}
	if info, _ := os.Stat(p); runtime.GOOS != "windows" && info.Mode().Perm() != 0o600 { // Windows has no permission bits; the profile folder's access rules keep it private
		t.Fatalf("permissions = %v", info.Mode().Perm())
	}
}

func TestPrepareNewEnv(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "PUID=501\nPGID=20\nTZ=America/New_York\nDB_PASSWORD=__REPLACE_ME__\nAPP_SECRET_KEY=replace-me-after-first-run\nTOKEN=\n")
	env, changes, err := Prepare(filepath.Join(dir, ".env"), example, Identity{UID: 502, GID: 20, TimeZone: "Europe/Berlin"})
	if err != nil {
		t.Fatal(err)
	}
	m := env.Map()
	if m["PUID"] != "502" || m["TZ"] != "Europe/Berlin" {
		t.Fatalf("identity not applied: %v", m)
	}
	if Placeholder.MatchString(m["DB_PASSWORD"]) || len(m["DB_PASSWORD"]) != 32 {
		t.Fatalf("password not generated: %q", m["DB_PASSWORD"])
	}
	if len(m["APP_SECRET_KEY"]) != 64 {
		t.Fatalf("secret key should be 64 hex chars: %q", m["APP_SECRET_KEY"])
	}
	if m["TOKEN"] != "" {
		t.Fatal("empty user-supplied values must stay empty")
	}
	if len(changes) == 0 || changes[0].Reason != "created from .env.example" {
		t.Fatalf("changes: %+v", changes)
	}
}

func TestPrepareExistingEnvKeepsValues(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "PUID=501\nNEW_KEY=x\nTZ=America/New_York\n")
	envPath := write(t, dir, ".env", "PUID=777\nTZ=Asia/Tokyo\n")
	env, changes, err := Prepare(envPath, example, Identity{UID: 501, GID: 20, TimeZone: "UTC"})
	if err != nil {
		t.Fatal(err)
	}
	m := env.Map()
	if m["PUID"] != "777" || m["TZ"] != "Asia/Tokyo" || m["NEW_KEY"] != "x" {
		t.Fatalf("existing values must be kept: %v", m)
	}
	if len(changes) != 1 || !strings.Contains(changes[0].Reason, "added") {
		t.Fatalf("changes: %+v", changes)
	}
}

func TestPrepareUsesThisMacForNewIdentityKeys(t *testing.T) {
	dir := t.TempDir()
	example := filepath.Join(dir, ".env.example")
	envPath := filepath.Join(dir, ".env")
	_ = os.WriteFile(example, []byte("PUID=501\nPGID=20\nTZ=America/New_York\nPORT=1\n"), 0o644)
	_ = os.WriteFile(envPath, []byte("PORT=2\n"), 0o600)
	env, _, err := Prepare(envPath, example, Identity{UID: 502, GID: 21, TimeZone: "Europe/Lisbon"})
	if err != nil {
		t.Fatal(err)
	}
	m := env.Map()
	if m["PUID"] != "502" || m["PGID"] != "21" || m["TZ"] != "Europe/Lisbon" || m["PORT"] != "2" {
		t.Fatalf("got %v", m)
	}
}

func TestQuoteRoundTrip(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, ".env")
	values := []string{"plain", "", "pa$word", `pa"ss word`, `C:\dir name`, "it's", "a #b", "tab\there", "x\ny=injected", "$HOME", `ends with \`, "trailing  "}
	f, _ := Load(path)
	for i, v := range values {
		f.Set(fmt.Sprintf("K%d", i), v)
	}
	if err := f.Save(); err != nil {
		t.Fatal(err)
	}
	g, _ := Load(path)
	for i, v := range values {
		if got, _ := g.Get(fmt.Sprintf("K%d", i)); got != v {
			t.Errorf("K%d: wrote %q, read %q", i, v, got)
		}
	}
	if _, ok := g.Get("y"); ok || len(g.Keys()) != len(values) {
		t.Errorf("a value with a newline must not add a key: %v", g.Keys())
	}
	data, _ := os.ReadFile(path)
	if strings.Contains(string(data), "pa$word") {
		t.Errorf("a bare $ would be read as a variable by Compose:\n%s", data)
	}
	// Values as people write them by hand, read the way Compose reads them.
	for in, want := range map[string]string{
		`'single $x \"'`:          `single $x \"`,
		`'it\'s'`:                 `it's`,
		`"a\\b"`:                  `a\b`,
		`"q\"q" # comment`:        `q"q`,
		`plain # comment`:         `plain`,
		`"example.com" # mine`:    `example.com`,
		`'a\\'`:                   `a\\`,
		`"\$HOME and \n newline"`: "$HOME and \n newline",
	} {
		if got := unquote(in); got != want {
			t.Errorf("unquote(%s) = %q, want %q", in, got, want)
		}
	}
}

func TestSaveIsAtomicKeepsBackupAndMergesOtherWriters(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	_ = os.WriteFile(path, []byte("A=1\nTUNNEL_TOKEN=\n"), 0o644)
	mine, _ := Load(path)
	// Someone else saves while this copy is open.
	other, _ := Load(path)
	other.Set("TUNNEL_TOKEN", "pasted")
	if err := other.Save(); err != nil {
		t.Fatal(err)
	}
	mine.Set("A", "2")
	if err := mine.Save(); err != nil {
		t.Fatal(err)
	}
	f, _ := Load(path)
	if a, _ := f.Get("A"); a != "2" {
		t.Errorf("A = %q", a)
	}
	if tok, _ := f.Get("TUNNEL_TOKEN"); tok != "pasted" {
		t.Errorf("the other writer's TUNNEL_TOKEN was lost: %q", tok)
	}
	if fi, _ := os.Stat(path); runtime.GOOS != "windows" && fi.Mode().Perm() != 0o600 { // no permission bits on Windows
		t.Errorf("mode %v", fi.Mode().Perm())
	}
	if bak, err := os.ReadFile(path + ".bak"); err != nil || !strings.Contains(string(bak), "TUNNEL_TOKEN=pasted") {
		t.Errorf(".env.bak should hold the previous version: %q %v", bak, err)
	}
	if left, _ := filepath.Glob(filepath.Join(filepath.Dir(path), ".env-*.tmp")); len(left) != 0 {
		t.Errorf("temporary files left: %v", left)
	}
}

func TestPrepareKeepsRealValuesThatLookLikePlaceholders(t *testing.T) {
	dir := t.TempDir()
	env, example := filepath.Join(dir, ".env"), filepath.Join(dir, ".env.example")
	_ = os.WriteFile(example, []byte("DB_PASSWORD=__REPLACE_ME__\nNEW_SECRET=__REPLACE_ME__\n"), 0o644)
	_ = os.WriteFile(env, []byte("DB_PASSWORD=changeme\nOLD=__REPLACE_ME__\n"), 0o600)
	f, _, err := Prepare(env, example, Identity{})
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := f.Get("DB_PASSWORD"); v != "changeme" {
		t.Errorf("an existing value was replaced: %q", v)
	}
	for _, k := range []string{"NEW_SECRET", "OLD"} {
		if v, _ := f.Get(k); v == "" || v == "__REPLACE_ME__" {
			t.Errorf("%s should get a generated secret: %q", k, v)
		}
	}
}

func TestPrepareKitFolderStartsInHomeMode(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "HOMELAB_DOMAIN=example.com\n")
	env, _, err := Prepare(filepath.Join(dir, ".env"), example, Identity{})
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("HOMELAB_DOMAIN"); v != "example.com" {
		t.Fatalf("a git checkout keeps the domain: %q", v)
	}
	write(t, dir, ".homelab-kit.json", `{"commit":"abc"}`)
	if env, _, err = Prepare(filepath.Join(dir, ".env"), example, Identity{}); err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("HOMELAB_DOMAIN"); v != "" {
		t.Fatalf("a kit folder starts without a domain: %q", v)
	}
	if v, _ := env.Get("HOMELAB_BASELINE"); v != "small" {
		t.Fatalf("a kit folder starts with the small baseline: %q", v)
	}
}

func TestPrepareMovesTheMacMediaDriveHomeOffTheMac(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "MEDIA_ROOT=/Volumes/Media\nIMMICH_UPLOAD_LOCATION=/Volumes/Media/photos\nBACKUP_DESTINATION=./backups\nOTHER=/Volumes/Mediaplayer\n")
	media := filepath.Join(dir, "home", "Media")
	env, _, err := Prepare(filepath.Join(dir, ".env"), example, Identity{Media: media})
	if err != nil {
		t.Fatal(err)
	}
	m := env.Map()
	if m["MEDIA_ROOT"] != media || m["IMMICH_UPLOAD_LOCATION"] != filepath.Join(media, "photos") {
		t.Errorf("media not moved home: %v", m)
	}
	if m["BACKUP_DESTINATION"] != "./backups" || m["OTHER"] != "/Volumes/Mediaplayer" {
		t.Errorf("other values changed: %v", m)
	}
	// On the Mac (no Media), the template's drive stays.
	env, _, _ = Prepare(filepath.Join(t.TempDir(), ".env"), example, Identity{})
	if v, _ := env.Get("MEDIA_ROOT"); v != "/Volumes/Media" {
		t.Errorf("Mac MEDIA_ROOT: %q", v)
	}
}

func TestPrepareBindsDNSBesideResolvedStub(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "LAN_BIND_IP=0.0.0.0\nADGUARD_DNS_BIND_IP=\n")
	id := Identity{DNSBind: "192.168.1.10"}
	// A new .env, and an existing one from before the setting.
	env, _, err := Prepare(filepath.Join(dir, ".env"), example, id)
	if err != nil {
		t.Fatal(err)
	}
	if m := env.Map(); m["ADGUARD_DNS_BIND_IP"] != "192.168.1.10" || m["LAN_BIND_IP"] != "0.0.0.0" {
		t.Errorf("new: %v", m)
	}
	old := write(t, dir, "old.env", "LAN_BIND_IP=0.0.0.0\n")
	if env, _, err = Prepare(old, example, id); err != nil || env.Map()["ADGUARD_DNS_BIND_IP"] != "192.168.1.10" {
		t.Errorf("existing: %v %v", env.Map(), err)
	}
	// Without the stub it stays empty, and the bind follows LAN_BIND_IP.
	if env, _, _ = Prepare(filepath.Join(dir, "plain.env"), example, Identity{}); env.Map()["ADGUARD_DNS_BIND_IP"] != "" {
		t.Errorf("no stub: %v", env.Map())
	}
}

// On Windows, Navidrome's music folder in its container is /music, since a
// C:\ path cannot be one: in a new .env, and added to an existing one that
// lacks it. Elsewhere it stays empty (the machine's own path).
func TestPrepareSetsNavidromeMusicPathOnWindows(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "MEDIA_ROOT=/Volumes/Media\nNAVIDROME_MUSIC_PATH=\n")
	win := Identity{Media: `C:\Users\andre\Media`, MusicInApp: "/music"}
	env, _, err := Prepare(filepath.Join(dir, ".env"), example, win)
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("NAVIDROME_MUSIC_PATH"); v != "/music" {
		t.Errorf("new .env: %q", v)
	}
	// An existing .env from before the setting: it is added.
	old := t.TempDir()
	write(t, old, ".env", "MEDIA_ROOT=C:\\Users\\andre\\Media\n")
	env, _, err = Prepare(filepath.Join(old, ".env"), example, win)
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("NAVIDROME_MUSIC_PATH"); v != "/music" {
		t.Errorf("existing .env: %q", v)
	}
	// A Mac keeps its own path, so Navidrome's library and playlists stay put.
	mac := t.TempDir()
	env, _, err = Prepare(filepath.Join(mac, ".env"), example, Identity{})
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("NAVIDROME_MUSIC_PATH"); v != "" {
		t.Errorf("Mac: %q", v)
	}
}

// Where something holds port 53 (systemd-resolved, or Windows' Internet
// Connection Sharing), an existing .env that left ADGUARD_DNS_BIND_IP empty
// takes this machine's address; one set by hand is kept.
func TestPrepareFillsAnEmptyDNSBind(t *testing.T) {
	example := write(t, t.TempDir(), ".env.example", "ADGUARD_DNS_BIND_IP=\n")
	for _, c := range []struct{ have, want string }{{"", "10.0.0.195"}, {"192.168.1.5", "192.168.1.5"}} {
		dir := t.TempDir()
		write(t, dir, ".env", "ADGUARD_DNS_BIND_IP="+c.have+"\n")
		env, _, err := Prepare(filepath.Join(dir, ".env"), example, Identity{DNSBind: "10.0.0.195"})
		if err != nil {
			t.Fatal(err)
		}
		if v, _ := env.Get("ADGUARD_DNS_BIND_IP"); v != c.want {
			t.Errorf("had %q: %q", c.have, v)
		}
	}
	// Nothing holds port 53: an empty value stays empty (0.0.0.0).
	dir := t.TempDir()
	write(t, dir, ".env", "ADGUARD_DNS_BIND_IP=\n")
	env, _, _ := Prepare(filepath.Join(dir, ".env"), example, Identity{})
	if v, _ := env.Get("ADGUARD_DNS_BIND_IP"); v != "" {
		t.Errorf("free port 53: %q", v)
	}
}

func TestRehome(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	if err := os.WriteFile(path, []byte("PUID=501\nPGID=20\nADGUARD_DNS_BIND_IP=10.0.0.5\nNAVIDROME_MUSIC_PATH=\nMEDIA_ROOT=/Volumes/Hobbies\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	changes, err := Rehome(path, Identity{UID: 1000, GID: 1000, MusicInApp: "/music"})
	if err != nil {
		t.Fatal(err)
	}
	env, _ := Load(path)
	want := map[string]string{"PUID": "1000", "PGID": "1000", "ADGUARD_DNS_BIND_IP": "", "NAVIDROME_MUSIC_PATH": "/music", "MEDIA_ROOT": "/Volumes/Hobbies"}
	for k, v := range want {
		if got, _ := env.Get(k); got != v {
			t.Errorf("%s = %q, want %q", k, got, v)
		}
	}
	if len(changes) != 4 {
		t.Errorf("changes: %+v", changes)
	}
	if again, _ := Rehome(path, Identity{UID: 1000, GID: 1000, MusicInApp: "/music"}); len(again) != 0 {
		t.Errorf("a second time changed %+v", again)
	}
}

func TestPrepareSetsTheHomeNetwork(t *testing.T) {
	dir := t.TempDir()
	example := filepath.Join(dir, ".env.example")
	envPath := filepath.Join(dir, ".env")
	_ = os.WriteFile(example, []byte("TAILSCALE_ROUTES=192.168.1.0/24\n"), 0o644)
	id := Identity{Routes: "10.0.0.0/24"}
	env, _, err := Prepare(envPath, example, id)
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("TAILSCALE_ROUTES"); v != "10.0.0.0/24" {
		t.Errorf("a new .env: %q", v)
	}
	// An older .env with the template's network gets this one; a network
	// someone set stays.
	for before, want := range map[string]string{"192.168.1.0/24": "10.0.0.0/24", "10.0.0.0/16": "10.0.0.0/16"} {
		_ = os.WriteFile(envPath, []byte("TAILSCALE_ROUTES="+before+"\n"), 0o600)
		env, _, err := Prepare(envPath, example, id)
		if err != nil {
			t.Fatal(err)
		}
		if v, _ := env.Get("TAILSCALE_ROUTES"); v != want {
			t.Errorf("%s: got %q, want %q", before, v, want)
		}
	}
}

func TestPrepareRootlessRunsAppsAsRoot(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "PUID=501\nPGID=20\n")
	env, _, err := Prepare(filepath.Join(dir, ".env"), example, Identity{UID: 1000, GID: 1000, Rootless: true})
	if err != nil {
		t.Fatal(err)
	}
	if m := env.Map(); m["PUID"] != "0" || m["PGID"] != "0" {
		t.Errorf("with Docker run as you, a container's root is you: %v", m)
	}
}

func TestPrepareRootlessSocket(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "PUID=501\nDOCKER_SOCKET=\n")
	env, _, err := Prepare(filepath.Join(dir, ".env"), example, Identity{UID: 1000, GID: 1000, Rootless: true, Socket: "/run/user/1000/docker.sock"})
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("DOCKER_SOCKET"); v != "/run/user/1000/docker.sock" {
		t.Errorf("DOCKER_SOCKET = %q", v)
	}
}

func TestPrepareRootlessHostGateway(t *testing.T) {
	dir := t.TempDir()
	example := write(t, dir, ".env.example", "HOST_GATEWAY=\n")
	env, _, err := Prepare(filepath.Join(dir, ".env"), example, Identity{UID: 1000, Rootless: true, HostGateway: "192.168.1.10"})
	if err != nil {
		t.Fatal(err)
	}
	if v, _ := env.Get("HOST_GATEWAY"); v != "192.168.1.10" {
		t.Errorf("HOST_GATEWAY = %q", v)
	}
}

func TestIANAZone(t *testing.T) {
	for windows, iana := range map[string]string{"Pacific Standard Time": "America/Los_Angeles", "W. Europe Standard Time": "Europe/Berlin", "UTC": "Etc/UTC", " GMT Standard Time\r\n": "Europe/London", "Not A Zone": ""} {
		if got := IANAZone(windows); got != iana {
			t.Errorf("%q: %q, want %q", windows, got, iana)
		}
	}
	// On Windows, this PC's own zone (the runner's) is read and known.
	if runtime.GOOS == "windows" {
		if w := WindowsZone(); w == "" || IANAZone(w) == "" {
			t.Errorf("this PC's time zone %q has no IANA name", w)
		}
		if HostIdentity().TimeZone == "" {
			t.Error("a new .env gets no TZ on Windows")
		}
	}
}
