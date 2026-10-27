package main

import (
	"archive/tar"
	"compress/gzip"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/backup"
)

// The fake commands the end-to-end tests put on PATH (docker, systemctl,
// loginctl, launchctl) are this test binary under another name, so they
// run the same on macOS, Linux, and Windows, where a shell script would
// not. fakeBinDir is where the fake docker keeps its state (its containers,
// networks, and the calls it was given).
const fakeBinDir = "HOMELAB_FAKE_BIN"

// asFakeCommand runs the fake command this process was started as, and
// reports false when it is the test binary itself.
func asFakeCommand() bool {
	dir := os.Getenv(fakeBinDir)
	if dir == "" {
		return false
	}
	switch strings.TrimSuffix(strings.ToLower(filepath.Base(os.Args[0])), ".exe") {
	case "docker":
		os.Exit(fakeDockerMain(dir, os.Args[1:]))
	case "systemctl", "loginctl", "launchctl":
		os.Exit(0)
	}
	return false
}

// installFake puts this test binary on PATH as each of names, in dir: a
// hard link where the file system allows one (no copy of the binary per
// test), else a copy.
func installFake(t *testing.T, dir string, names ...string) {
	t.Helper()
	self, err := os.Executable()
	if err != nil {
		t.Fatal(err)
	}
	for _, name := range names {
		dst := filepath.Join(dir, name+exeSuffix())
		if os.Link(self, dst) == nil {
			continue
		}
		data, err := os.ReadFile(self)
		if err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(dst, data, 0o755); err != nil {
			t.Fatal(err)
		}
	}
	t.Setenv("PATH", dir+string(os.PathListSeparator)+os.Getenv("PATH"))
}

func exeSuffix() string {
	if filepath.Separator == '\\' {
		return ".exe"
	}
	return ""
}

// fakeDockerMain answers as docker would for the end-to-end tests: the
// containers fakeDocker wrote, networks as files, pg_dumpall and the other
// commands run in containers, and every call appended to calls.log.
func fakeDockerMain(d string, args []string) int {
	all := strings.Join(args, " ")
	if f, err := os.OpenFile(filepath.Join(d, "calls.log"), os.O_CREATE|os.O_APPEND|os.O_WRONLY, 0o644); err == nil {
		fmt.Fprintln(f, all)
		f.Close()
	}
	arg := func(i int) string {
		if i < len(args) {
			return args[i]
		}
		return ""
	}
	cat := func(name string) {
		data, _ := os.ReadFile(filepath.Join(d, name))
		os.Stdout.Write(data)
	}
	has := func(s string) bool { return strings.Contains(all, s) }
	switch arg(0) {
	case "info":
		// A file named down: the runtime is not running yet.
		if _, err := os.Stat(filepath.Join(d, "down")); err == nil {
			fmt.Fprintln(os.Stderr, "Cannot connect to the Docker daemon at unix:///var/run/docker.sock. Is the docker daemon running?")
			return 1
		}
		cat("info.json")
	case "ps":
		cat("ids.txt")
	case "inspect":
		cat("inspect.json")
	case "network":
		net := filepath.Join(d, "net-"+arg(2))
		switch arg(1) {
		case "inspect":
			if _, err := os.Stat(net); err != nil {
				return 1
			}
		case "create":
			_ = os.WriteFile(net, nil, 0o644)
		}
	case "exec":
		switch {
		case has("pg_dumpall"):
			fmt.Print("CREATE ROLE x;\n-- PostgreSQL database cluster dump complete\n")
		case has("from pg_database"):
			n := os.Getenv("FAKE_PG_DATABASES")
			if n == "" {
				n = "1"
			}
			fmt.Println(n)
		case has("from pg_tables"):
			fmt.Println("public|tx|public.tx")
		case has("(select * from"):
			fmt.Print("id,note\n1,coffee\n")
		case has("albumName"):
			fmt.Print("Summer,anna@example.com,IMG_1.HEIC,/data/library/anna/IMG_1.HEIC\n")
		case has("token add"):
			// ntfy writes it on stderr; a shell's 2>&1 brings it to stdout.
			w := os.Stderr
			if has("2>&1") {
				w = os.Stdout
			}
			fmt.Fprintln(w, "token tk_abc123def created for user homelab, never expires")
		case has("tailscale status --json"):
			if p := os.Getenv("FAKE_TS_STATUS"); p != "" {
				if data, err := os.ReadFile(p); err == nil {
					os.Stdout.Write(data)
					_ = os.WriteFile(p+".read", nil, 0o644) // a test may wait for this
					return 0
				}
			}
			fmt.Println(`{"BackendState":"Running","CertDomains":["homelab.tail1.ts.net"],"Self":{"DNSName":"homelab.tail1.ts.net.","TailscaleIPs":["100.101.102.103"]}}`)
		case has("bouncers list"):
			fmt.Println(`[{"name":"nginx_proxy_manager","revoked":false,"last_pull":"2020-01-01T00:00:00Z"}]`)
		}
	case "image":
		// FAKE_IMAGE_ID: the image a reference names after the pull.
		if arg(1) == "inspect" {
			fmt.Println(os.Getenv("FAKE_IMAGE_ID"))
		}
	case "run":
		if has("du -sk") {
			kb := os.Getenv("FAKE_DU_KB")
			if kb == "" {
				kb = "8"
			}
			fmt.Printf("%s\t/data\n", kb)
		}
		if has("tar czf -") {
			// A volume's archive: one file, as tar czf would write it.
			gz := gzip.NewWriter(os.Stdout)
			tw := tar.NewWriter(gz)
			body := "receipt\n"
			_ = tw.WriteHeader(&tar.Header{Name: "./receipt.pdf", Mode: 0o644, Size: int64(len(body))})
			_, _ = io.WriteString(tw, body)
			_ = tw.Close()
			_ = gz.Close()
		}
		if has(backup.SQLiteImage) {
			// A live SQLite database's copy, as sqlite3's .backup writes it.
			fmt.Print("SQLite format 3\x00the rest of the database")
		}
	case "compose":
		if arg(1) == "version" {
			fmt.Println("2.40.3")
		}
		if has("config --hash") {
			// As printf '%b' would: the test writes \n for each line.
			fmt.Print(strings.ReplaceAll(os.Getenv("FAKE_CONFIG_HASHES"), `\n`, "\n"))
		}
		// FAKE_STOPS_FAIL_AFTER=n: every stop after the first n fails.
		if has(" stop ") {
			stops := filepath.Join(d, "stops")
			data, _ := os.ReadFile(stops)
			n, _ := strconv.Atoi(strings.TrimSpace(string(data)))
			n++
			_ = os.WriteFile(stops, []byte(strconv.Itoa(n)), 0o644)
			if limit, err := strconv.Atoi(os.Getenv("FAKE_STOPS_FAIL_AFTER")); err == nil && n > limit {
				return 1
			}
		}
	case "system":
		if arg(1) == "df" {
			fmt.Println(`{"Type":"Images","Size":"24.1GB","Reclaimable":"12.3GB (51%)"}`)
			fmt.Println(`{"Type":"Build Cache","Size":"0B","Reclaimable":"0B"}`)
		}
	}
	return 0
}
