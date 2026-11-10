package selfupdate

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
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
	if err := verifyBundle(bundleJSON(t, attestedBundle(t)), attestedRepo, attestedName, attestedSHA); err != nil {
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
		if err := verifyBundle(bundleJSON(t, b), c.repo, c.name, c.sha); err == nil {
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
