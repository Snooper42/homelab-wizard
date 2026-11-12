package selfupdate

import (
	"context"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"slices"
	"strings"
	"testing"
)

// The attestation GitHub keeps for v0.28.10's files, the first release the
// publish job attested (public: file names and their SHA-256 only).
const (
	attestedRepo = "Snooper42/homelab-wizard"
	attestedName = "homelab-wizard-linux-amd64.tar.gz"
	attestedSHA  = "58f2df06a9c068eb14f5e33722a3bbb8aa018363961f4fdef0b2dc1f626736a3"
)

func attestedBundle(t *testing.T) map[string]any {
	t.Helper()
	data, err := os.ReadFile("testdata/attestation-v0.28.10.json")
	if err != nil {
		t.Fatal(err)
	}
	var a struct {
		Attestations []struct {
			Bundle map[string]any `json:"bundle"`
		} `json:"attestations"`
	}
	if err := json.Unmarshal(data, &a); err != nil || len(a.Attestations) != 1 {
		t.Fatalf("fixture: %v", err)
	}
	return a.Attestations[0].Bundle
}

func bundleJSON(t *testing.T, b map[string]any) []byte {
	t.Helper()
	raw, err := json.Marshal(b)
	if err != nil {
		t.Fatal(err)
	}
	return raw
}

// A real release's build provenance verifies against Sigstore's roots the
// app carries, for that file; anything changed, or asked of another file,
// another repository or another workflow, is refused (N29).
func TestBuildProvenance(t *testing.T) {
	if _, err := verifyBundle(bundleJSON(t, attestedBundle(t)), attestedRepo, attestedName, attestedSHA); err != nil {
		t.Fatalf("v0.28.10's own provenance: %v", err)
	}
	flip := func(s string) string {
		b, _ := base64.StdEncoding.DecodeString(s)
		b[len(b)/2] ^= 1
		return base64.StdEncoding.EncodeToString(b)
	}
	cases := map[string]struct {
		repo, name, sha string
		change          func(b map[string]any)
	}{
		"another file's checksum": {attestedRepo, attestedName, strings.Repeat("0", 64), nil},
		"another file's name":     {attestedRepo, "homelab-evil.exe", attestedSHA, nil},
		"another repository":      {"someone/homelab-wizard", attestedName, attestedSHA, nil},
		"a changed statement": {attestedRepo, attestedName, attestedSHA, func(b map[string]any) {
			env := b["dsseEnvelope"].(map[string]any)
			env["payload"] = flip(env["payload"].(string))
		}},
		"a changed signature": {attestedRepo, attestedName, attestedSHA, func(b map[string]any) {
			sig := b["dsseEnvelope"].(map[string]any)["signatures"].([]any)[0].(map[string]any)
			sig["sig"] = flip(sig["sig"].(string))
		}},
		"a changed certificate": {attestedRepo, attestedName, attestedSHA, func(b map[string]any) {
			c := b["verificationMaterial"].(map[string]any)["certificate"].(map[string]any)
			c["rawBytes"] = flip(c["rawBytes"].(string))
		}},
		"a changed log timestamp": {attestedRepo, attestedName, attestedSHA, func(b map[string]any) {
			e := b["verificationMaterial"].(map[string]any)["tlogEntries"].([]any)[0].(map[string]any)
			p := e["inclusionPromise"].(map[string]any)
			p["signedEntryTimestamp"] = flip(p["signedEntryTimestamp"].(string))
		}},
		"a changed log time": {attestedRepo, attestedName, attestedSHA, func(b map[string]any) {
			e := b["verificationMaterial"].(map[string]any)["tlogEntries"].([]any)[0].(map[string]any)
			e["integratedTime"] = "1794291716"
		}},
		"another bundle form": {attestedRepo, attestedName, attestedSHA, func(b map[string]any) {
			b["mediaType"] = "application/vnd.dev.sigstore.bundle+json;version=0.1"
		}},
	}
	for name, c := range cases {
		b := attestedBundle(t)
		if c.change != nil {
			c.change(b)
		}
		if _, err := verifyBundle(bundleJSON(t, b), c.repo, c.name, c.sha); err == nil {
			t.Errorf("%s: verified", name)
		}
	}
}

// The update reads the attestations from GitHub for the file's digest, and
// refuses one GitHub has none for.
func TestBuildProvenanceFromGitHub(t *testing.T) {
	fixture, _ := os.ReadFile("testdata/attestation-v0.28.10.json")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/repos/"+attestedRepo+"/attestations/sha256:"+attestedSHA {
			_, _ = w.Write(fixture)
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()
	saved := API
	API = srv.URL
	defer func() { API = saved }()
	ctx := context.Background()
	if err := checkProvenance(ctx, attestedRepo, attestedName, strings.ToUpper(attestedSHA)); err != nil {
		t.Fatalf("attested: %v", err)
	}
	if err := checkProvenance(ctx, attestedRepo, "x", strings.Repeat("a", 64)); err == nil || !strings.Contains(err.Error(), "no build provenance") {
		t.Errorf("unattested: %v", err)
	}
	if err := checkProvenance(ctx, "", attestedName, attestedSHA); err == nil {
		t.Error("no repository: taken")
	}
}

// Releases published before the first one with build provenance have none
// to check, and keep the checksum alone; any published since, or with no
// readable time, must have it.
func TestWhichReleasesNeedProvenance(t *testing.T) {
	for when, want := range map[string]bool{
		"2026-11-10T03:45:11Z": false, // v0.28.7
		"2026-11-10T06:18:26Z": true,  // v0.28.10, the first attested
		"2027-01-01T00:00:00Z": true,
		"":                     true,
		"yesterday":            true,
	} {
		if got := needsProvenance(when); got != want {
			t.Errorf("published %q: needs provenance %v, want %v", when, got, want)
		}
	}
}

// Item 79: the commit a release was built from is read from a verified
// attestation of one of its files, v0.28.10's own here; a release GitHub
// has no attestation for, an attestation of another file, or no release,
// gives none.
func TestReleaseCommit(t *testing.T) {
	const built = "4369eb1b3baea8cb9cdac45fc82075213efc51d6" // v0.28.10's tag
	fixture, _ := os.ReadFile("testdata/attestation-v0.28.10.json")
	asset := func(name, sha string) string {
		return `{"name":"` + name + `","browser_download_url":"https://example.com/x","digest":"sha256:` + sha + `"}`
	}
	releases := map[string]string{
		"v0.28.10": `{"tag_name":"v0.28.10","assets":[{"name":"notes.txt"},` + asset(attestedName, attestedSHA) + `]}`,
		"v0.28.11": `{"tag_name":"v0.28.11","assets":[` + asset(attestedName, strings.Repeat("b", 64)) + `]}`,
		"v0.28.12": `{"tag_name":"v0.28.12","assets":[` + asset("homelab-other.tar.gz", attestedSHA) + `]}`,
		"v0.28.13": `{"tag_name":"v0.28.13","assets":[]}`,
	}
	// GitHub takes a repository's name in any case.
	repo := "/repos/" + strings.ToLower(attestedRepo)
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		path := strings.ToLower(r.URL.Path)
		if path == repo+"/attestations/sha256:"+attestedSHA {
			_, _ = w.Write(fixture)
			return
		}
		if tag, ok := strings.CutPrefix(path, repo+"/releases/tags/"); ok && releases[tag] != "" {
			_, _ = w.Write([]byte(releases[tag]))
			return
		}
		http.NotFound(w, r)
	}))
	defer srv.Close()
	saved := API
	API = srv.URL
	defer func() { API = saved }()
	ctx := context.Background()

	for _, repo := range []string{attestedRepo, strings.ToLower(attestedRepo)} {
		if got, err := ReleaseCommit(ctx, repo, "v0.28.10"); err != nil || got != built {
			t.Errorf("v0.28.10 of %s: %q, %v; want %s", repo, got, err, built)
		}
	}
	for tag, why := range map[string]string{
		"v0.28.11": "no build provenance",
		"v0.28.12": "other files",
		"v0.28.13": "no files",
		"v0.29.0":  "no release",
	} {
		if got, err := ReleaseCommit(ctx, attestedRepo, tag); err == nil || !strings.Contains(err.Error(), why) {
			t.Errorf("%s: %q, %v; want an error saying %q", tag, got, err, why)
		}
	}
	if _, err := ReleaseCommit(ctx, "someone/homelab-wizard", "v0.28.10"); err == nil {
		t.Error("another repository's release: taken")
	}
	if _, err := ReleaseCommit(ctx, attestedRepo, ""); err == nil {
		t.Error("no tag: taken")
	}

	// The certificate names the source; one from another branch or
	// repository, or with no commit, gives none.
	var b sigstoreBundle
	if err := json.Unmarshal(bundleJSON(t, attestedBundle(t)), &b); err != nil {
		t.Fatal(err)
	}
	leaf, err := x509.ParseCertificate(b.VerificationMaterial.Certificate.RawBytes)
	if err != nil {
		t.Fatal(err)
	}
	if got, err := sourceCommit(leaf, attestedRepo); err != nil || got != built {
		t.Errorf("sourceCommit: %q, %v", got, err)
	}
	for oid, value := range map[string]string{"12": "https://github.com/someone/homelab-wizard", "14": "refs/heads/dev", "13": "not a commit"} {
		c := *leaf
		c.Extensions = slices.Clone(leaf.Extensions)
		for i, e := range c.Extensions {
			if e.Id.String() == "1.3.6.1.4.1.57264.1."+oid {
				der, _ := asn1.Marshal(value)
				c.Extensions[i].Value = der
			}
		}
		if got, err := sourceCommit(&c, attestedRepo); err == nil {
			t.Errorf("extension %s set to %q: %q taken", oid, value, got)
		}
	}
}
