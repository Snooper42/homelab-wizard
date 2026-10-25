package rootless

import (
	"archive/tar"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestInspect(t *testing.T) {
	files := map[string]string{
		"/etc/subuid": "root:1:2\ndeck:100000:65536\n",
		"/etc/subgid": "deck:100000:65536\n",
		"/proc/sys/net/ipv4/ip_unprivileged_port_start": "1024\n",
	}
	sys := System{
		ReadFile: func(p string) ([]byte, error) {
			if v, ok := files[p]; ok {
				return []byte(v), nil
			}
			return nil, os.ErrNotExist
		},
		LookPath: func(string) (string, error) { return "/usr/bin/x", nil },
		Run:      func(string, ...string) error { return nil },
		CanOpen:  func(string) bool { return true },
	}
	c := sys.Inspect("deck", 1000)
	if !c.SubIDs || c.LowPorts || !c.NewUIDMap || !c.IP || !c.Tun || !c.SystemdUser || c.Linger {
		t.Fatalf("%+v", c)
	}
	script := c.RootScript()
	if strings.Contains(script, "subuid") || !strings.Contains(script, "net.ipv4.ip_unprivileged_port_start=53") || !strings.Contains(script, PortsFile) {
		t.Errorf("only the ports are lacking: %s", script)
	}
	delete(files, "/etc/subgid")
	files["/proc/sys/net/ipv4/ip_unprivileged_port_start"] = "53"
	c = sys.Inspect("deck", 1000)
	if c.SubIDs || !c.LowPorts || !strings.Contains(c.RootScript(), "'deck':100000:65536 >> /etc/subgid") {
		t.Errorf("a missing range: %+v %s", c, c.RootScript())
	}
	sys.LookPath = func(string) (string, error) { return "", errors.New("no") }
	sys.CanOpen = func(string) bool { return false }
	if p := sys.Inspect("deck", 1000).Problems(); len(p) != 3 || !strings.Contains(p[0], "newuidmap") || !strings.Contains(p[1], "iproute2") || !strings.Contains(p[2], "/dev/net/tun") {
		t.Errorf("problems: %q", p)
	}
}

func tgz(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var b bytes.Buffer
	zw := gzip.NewWriter(&b)
	tw := tar.NewWriter(zw)
	for name, body := range files {
		_ = tw.WriteHeader(&tar.Header{Name: name, Mode: 0o755, Size: int64(len(body)), Typeflag: tar.TypeReg})
		_, _ = tw.Write([]byte(body))
	}
	tw.Close()
	zw.Close()
	return b.Bytes()
}

func sum(b []byte) string { h := sha256.Sum256(b); return hex.EncodeToString(h[:]) }

func TestDownloadChecksAndUnpacks(t *testing.T) {
	docker := tgz(t, map[string]string{"docker/dockerd": "d", "docker/docker": "c"})
	extras := tgz(t, map[string]string{"docker-rootless-extras/dockerd-rootless.sh": "r", "docker-rootless-extras/../../escape": "x"})
	compose := []byte("compose")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Write(map[string][]byte{"/d.tgz": docker, "/e.tgz": extras, "/c": compose}[r.URL.Path])
	}))
	defer srv.Close()
	home := t.TempDir()
	b := bundle{Docker: file{srv.URL + "/d.tgz", sum(docker)}, Extras: file{srv.URL + "/e.tgz", sum(extras)}, Compose: file{srv.URL + "/c", sum(compose)}}
	var said []string
	if err := download(context.Background(), home, b, nil, func(s string) { said = append(said, s) }); err != nil {
		t.Fatal(err)
	}
	for _, f := range []string{"dockerd", "docker", "dockerd-rootless.sh", "escape"} {
		if _, err := os.Stat(filepath.Join(BinDir(home), f)); err != nil {
			t.Errorf("%s not in the bin folder: %v", f, err)
		}
	}
	if !Installed(home) {
		t.Error("Installed")
	}
	if got, _ := os.ReadFile(ComposePlugin(home)); string(got) != "compose" {
		t.Errorf("compose plugin: %q", got)
	}
	if len(said) != 4 {
		t.Errorf("said %q", said)
	}

	// A file that does not match its checksum stops it, with nothing unpacked.
	other := t.TempDir()
	b.Extras.SHA256 = sum([]byte("something else"))
	if err := download(context.Background(), other, b, nil, func(string) {}); err == nil || !strings.Contains(err.Error(), "checksum") {
		t.Fatalf("a wrong checksum: %v", err)
	}
	if _, err := os.Stat(BinDir(other)); err == nil {
		t.Error("unpacked before every file was checked")
	}
}

func TestBundlesPinned(t *testing.T) {
	for arch, b := range bundles() {
		for _, f := range []file{b.Docker, b.Extras, b.Compose} {
			if len(f.SHA256) != 64 || !strings.HasPrefix(f.URL, "https://") {
				t.Errorf("%s: %+v", arch, f)
			}
		}
	}
}
