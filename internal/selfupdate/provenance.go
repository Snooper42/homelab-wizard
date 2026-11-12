package selfupdate

// Build provenance (N29): a Windows or Linux update is taken only when
// GitHub's attestation says this repository's release workflow, on main,
// built that very file. GitHub's checksum comes from the same release as the
// download, so it says the file arrived whole, not who made it; the
// attestation is signed with a short-lived certificate Sigstore's Fulcio
// gives only to that workflow's run, logged in Rekor, and checked here
// against Sigstore's public roots, which the app carries (no key of the
// owner's, nothing new fetched beyond GitHub's API).
//
// What is checked, all of it, or the update is refused:
//   - the certificate chains to Fulcio's root, at the time Rekor logged it;
//   - it names this repository's release.yml on refs/heads/main, issued for
//     GitHub Actions;
//   - the signature over the statement is that certificate's;
//   - Rekor's signed timestamp covers this very entry (its signature, its
//     certificate, the statement's hash), signed by Rekor's key;
//   - the statement is SLSA provenance naming the file and its SHA-256.

import (
	"bytes"
	"context"
	"crypto/ecdsa"
	"crypto/sha256"
	"crypto/x509"
	"encoding/asn1"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"fmt"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
)

// sigstoreFulcio is Sigstore's public-good Fulcio intermediate and root
// (valid to 2031), from its trusted root.
const sigstoreFulcio = `-----BEGIN CERTIFICATE-----
MIICGjCCAaGgAwIBAgIUALnViVfnU0brJasmRkHrn/UnfaQwCgYIKoZIzj0EAwMw
KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y
MjA0MTMyMDA2MTVaFw0zMTEwMDUxMzU2NThaMDcxFTATBgNVBAoTDHNpZ3N0b3Jl
LmRldjEeMBwGA1UEAxMVc2lnc3RvcmUtaW50ZXJtZWRpYXRlMHYwEAYHKoZIzj0C
AQYFK4EEACIDYgAE8RVS/ysH+NOvuDZyPIZtilgUF9NlarYpAd9HP1vBBH1U5CV7
7LSS7s0ZiH4nE7Hv7ptS6LvvR/STk798LVgMzLlJ4HeIfF3tHSaexLcYpSASr1kS
0N/RgBJz/9jWCiXno3sweTAOBgNVHQ8BAf8EBAMCAQYwEwYDVR0lBAwwCgYIKwYB
BQUHAwMwEgYDVR0TAQH/BAgwBgEB/wIBADAdBgNVHQ4EFgQU39Ppz1YkEZb5qNjp
KFWixi4YZD8wHwYDVR0jBBgwFoAUWMAeX5FFpWapesyQoZMi0CrFxfowCgYIKoZI
zj0EAwMDZwAwZAIwPCsQK4DYiZYDPIaDi5HFKnfxXx6ASSVmERfsynYBiX2X6SJR
nZU84/9DZdnFvvxmAjBOt6QpBlc4J/0DxvkTCqpclvziL6BCCPnjdlIB3Pu3BxsP
mygUY7Ii2zbdCdliiow=
-----END CERTIFICATE-----
-----BEGIN CERTIFICATE-----
MIIB9zCCAXygAwIBAgIUALZNAPFdxHPwjeDloDwyYChAO/4wCgYIKoZIzj0EAwMw
KjEVMBMGA1UEChMMc2lnc3RvcmUuZGV2MREwDwYDVQQDEwhzaWdzdG9yZTAeFw0y
MTEwMDcxMzU2NTlaFw0zMTEwMDUxMzU2NThaMCoxFTATBgNVBAoTDHNpZ3N0b3Jl
LmRldjERMA8GA1UEAxMIc2lnc3RvcmUwdjAQBgcqhkjOPQIBBgUrgQQAIgNiAAT7
XeFT4rb3PQGwS4IajtLk3/OlnpgangaBclYpsYBr5i+4ynB07ceb3LP0OIOZdxex
X69c5iVuyJRQ+Hz05yi+UF3uBWAlHpiS5sh0+H2GHE7SXrk1EC5m1Tr19L9gg92j
YzBhMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBRY
wB5fkUWlZql6zJChkyLQKsXF+jAfBgNVHSMEGDAWgBRYwB5fkUWlZql6zJChkyLQ
KsXF+jAKBggqhkjOPQQDAwNpADBmAjEAj1nHeXZp+13NWBNa+EDsDP8G1WWg1tCM
WP/WHPqpaVo0jhsweNFZgSs0eE7wYI4qAjEA2WB9ot98sIkoF3vZYdd3/VtWB5b9
TNMea7Ix/stJ5TfcLLeABLE4BNJOsQ4vnBHJ
-----END CERTIFICATE-----
`

// sigstoreRekor is Sigstore's public-good Rekor log key.
const sigstoreRekor = `-----BEGIN PUBLIC KEY-----
MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAE2G2Y+2tabdTV5BcGiBIx0a9fAFwr
kBbmLSGtks4L3qX6yYY0zufBnhC8Ur/iy55GhWP/9A/bY2LhC30M9+RYtw==
-----END PUBLIC KEY-----
`

const (
	githubIssuer   = "https://token.actions.githubusercontent.com"
	slsaProvenance = "https://slsa.dev/provenance/v1"
	inTotoPayload  = "application/vnd.in-toto+json"
)

// Fulcio's certificate extensions: who issued the workflow's token (raw,
// and the newer DER string).
var (
	oidIssuerV1 = asn1.ObjectIdentifier{1, 3, 6, 1, 4, 1, 57264, 1, 1}
	oidIssuerV2 = asn1.ObjectIdentifier{1, 3, 6, 1, 4, 1, 57264, 1, 8}
	// The source the workflow ran on: the repository, the commit it was
	// at, and the branch (item 79).
	oidSourceRepo   = asn1.ObjectIdentifier{1, 3, 6, 1, 4, 1, 57264, 1, 12}
	oidSourceDigest = asn1.ObjectIdentifier{1, 3, 6, 1, 4, 1, 57264, 1, 13}
	oidSourceRef    = asn1.ObjectIdentifier{1, 3, 6, 1, 4, 1, 57264, 1, 14}
)

// attestedSince is when the first release was published with build
// provenance (v0.28.10; only the tag-only job had attested before, and it
// never ran). A release published before it has none to check, and keeps
// the checksum alone, as before; one published since must have it. GitHub
// sets published_at when a release is published, so a new one can't be
// given an older time.
var attestedSince = time.Date(2026, 11, 10, 6, 18, 0, 0, time.UTC)

// needsProvenance is whether a release published at when must carry build
// provenance: any release since attestedSince, and one whose time can't
// be read.
func needsProvenance(when string) bool {
	t, err := time.Parse(time.RFC3339, when)
	return err != nil || !t.Before(attestedSince)
}

// Provenance checks a downloaded release file (any system's) against its
// attestation (repository, file name, SHA-256); tests replace it, as they
// do API and StartHelper.
var Provenance = checkProvenance

// checkProvenance reads GitHub's attestations for the file's digest and
// takes the update only when one of them verifies.
func checkProvenance(ctx context.Context, repo, name, sha string) error {
	refuse := func(why string) error {
		return fmt.Errorf("the download could not be shown to come from this app's own build (%s), so it was not installed; download the newest build from the release page instead", why)
	}
	if repo == "" || sha == "" {
		return refuse("no repository or checksum to check it against")
	}
	var answer struct {
		Attestations []struct {
			Bundle json.RawMessage `json:"bundle"`
		} `json:"attestations"`
	}
	if err := get(ctx, "/repos/"+repo+"/attestations/sha256:"+strings.ToLower(sha), "", &answer); err == errNotFound {
		return refuse("GitHub has no build provenance for it")
	} else if err != nil {
		return refuse("its build provenance could not be read: " + err.Error())
	}
	last := errors.New("GitHub has no build provenance for it")
	for _, a := range answer.Attestations {
		if _, last = verifyBundle(a.Bundle, repo, name, sha); last == nil {
			return nil
		}
	}
	return refuse(last.Error())
}

// ReleaseCommit is the commit repo's release workflow built the release
// tagged tag from, read from the certificate of a verified attestation of
// one of its files (item 79): a git checkout moves to a release tag only
// when the tag points at that very commit, so a commit the workflow never
// built, or a tag moved since, is not taken.
func ReleaseCommit(ctx context.Context, repo, tag string) (string, error) {
	if repo == "" || tag == "" {
		return "", errors.New("no repository or release to check")
	}
	var b release
	if err := get(ctx, "/repos/"+repo+"/releases/tags/"+url.PathEscape(tag), "", &b); err == errNotFound {
		return "", fmt.Errorf("GitHub has no release %s", tag)
	} else if err != nil {
		return "", fmt.Errorf("release %s could not be read: %w", tag, err)
	}
	last, tried := fmt.Errorf("release %s has no files whose build provenance could be checked", tag), 0
	for _, a := range b.Assets {
		sha, ok := strings.CutPrefix(a.Digest, "sha256:")
		if !ok || len(sha) != 64 {
			continue
		}
		if tried++; tried > 3 { // every file is attested together; a few tries is plenty
			break
		}
		var answer struct {
			Attestations []struct {
				Bundle json.RawMessage `json:"bundle"`
			} `json:"attestations"`
		}
		if err := get(ctx, "/repos/"+repo+"/attestations/sha256:"+strings.ToLower(sha), "", &answer); err == errNotFound {
			last = errors.New("GitHub has no build provenance for its files")
			continue
		} else if err != nil {
			last = fmt.Errorf("its build provenance could not be read: %w", err)
			continue
		}
		for _, at := range answer.Attestations {
			leaf, err := verifyBundle(at.Bundle, repo, a.Name, sha)
			if err == nil {
				var commit string
				if commit, err = sourceCommit(leaf, repo); err == nil {
					return commit, nil
				}
			}
			last = err
		}
	}
	return "", last
}

var fullCommit = regexp.MustCompile(`^[0-9a-f]{40}$`)

// sourceCommit is the commit a verified certificate says the workflow ran
// on, in repo, on main.
func sourceCommit(c *x509.Certificate, repo string) (string, error) {
	if !strings.EqualFold(extString(c, oidSourceRepo), "https://github.com/"+repo) || extString(c, oidSourceRef) != "refs/heads/main" {
		return "", errors.New("it was built from another repository or branch")
	}
	commit := extString(c, oidSourceDigest)
	if !fullCommit.MatchString(commit) {
		return "", errors.New("its certificate names no commit")
	}
	return commit, nil
}

// extString reads one of Fulcio's DER string extensions, "" when absent.
func extString(c *x509.Certificate, oid asn1.ObjectIdentifier) string {
	for _, e := range c.Extensions {
		if e.Id.Equal(oid) {
			var s string
			if _, err := asn1.Unmarshal(e.Value, &s); err == nil {
				return s
			}
		}
	}
	return ""
}

// sigstoreBundle is the part of a Sigstore bundle (v0.3) read here.
type sigstoreBundle struct {
	MediaType            string `json:"mediaType"`
	VerificationMaterial struct {
		Certificate struct {
			RawBytes []byte `json:"rawBytes"`
		} `json:"certificate"`
		TlogEntries []struct {
			LogIndex json.Number `json:"logIndex"`
			LogID    struct {
				KeyID []byte `json:"keyId"`
			} `json:"logId"`
			KindVersion struct {
				Kind    string `json:"kind"`
				Version string `json:"version"`
			} `json:"kindVersion"`
			IntegratedTime   json.Number `json:"integratedTime"`
			InclusionPromise struct {
				SignedEntryTimestamp []byte `json:"signedEntryTimestamp"`
			} `json:"inclusionPromise"`
			CanonicalizedBody []byte `json:"canonicalizedBody"`
		} `json:"tlogEntries"`
	} `json:"verificationMaterial"`
	DSSEEnvelope struct {
		Payload     []byte `json:"payload"`
		PayloadType string `json:"payloadType"`
		Signatures  []struct {
			Sig []byte `json:"sig"`
		} `json:"signatures"`
	} `json:"dsseEnvelope"`
}

// verifyBundle checks one attestation for the file name with SHA-256 sha,
// built by repo's release workflow on main, and returns its certificate.
func verifyBundle(raw []byte, repo, name, sha string) (*x509.Certificate, error) {
	var b sigstoreBundle
	if err := json.Unmarshal(raw, &b); err != nil {
		return nil, errors.New("its build provenance is not a Sigstore bundle")
	}
	if b.MediaType != "application/vnd.dev.sigstore.bundle.v0.3+json" {
		return nil, fmt.Errorf("its build provenance is in a form this app doesn't know (%s)", b.MediaType)
	}
	env := b.DSSEEnvelope
	if env.PayloadType != inTotoPayload || len(env.Signatures) != 1 || len(b.VerificationMaterial.TlogEntries) != 1 {
		return nil, errors.New("its build provenance is not one signed statement")
	}
	sig := env.Signatures[0].Sig
	tlog := b.VerificationMaterial.TlogEntries[0]
	logged, err := strconv.ParseInt(tlog.IntegratedTime.String(), 10, 64)
	if err != nil {
		return nil, errors.New("its build provenance has no time")
	}
	at := time.Unix(logged, 0)

	// The certificate: Fulcio's, at the time it was logged, for this
	// repository's release workflow on main, issued for GitHub Actions.
	leaf, err := x509.ParseCertificate(b.VerificationMaterial.Certificate.RawBytes)
	if err != nil {
		return nil, errors.New("its build provenance has no certificate")
	}
	roots, inter := x509.NewCertPool(), x509.NewCertPool()
	for rest := []byte(sigstoreFulcio); ; {
		var block *pem.Block
		if block, rest = pem.Decode(rest); block == nil {
			break
		}
		c, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil, err
		}
		if bytes.Equal(c.RawIssuer, c.RawSubject) {
			roots.AddCert(c)
		} else {
			inter.AddCert(c)
		}
	}
	if _, err := leaf.Verify(x509.VerifyOptions{Roots: roots, Intermediates: inter, CurrentTime: at, KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageCodeSigning}}); err != nil {
		return nil, errors.New("its certificate is not Sigstore's")
	}
	// GitHub's owner and repository names are the same in any case; the
	// workflow's path and branch are not.
	const workflow = "/.github/workflows/release.yml@refs/heads/main"
	uri := ""
	if len(leaf.URIs) == 1 {
		uri = leaf.URIs[0].String()
	}
	if prefix, ok := strings.CutSuffix(uri, workflow); !ok || !strings.EqualFold(prefix, "https://github.com/"+repo) {
		return nil, errors.New("it was not built by this app's release workflow on main")
	}
	if issuer(leaf) != githubIssuer {
		return nil, errors.New("it was not built on GitHub Actions")
	}
	pub, ok := leaf.PublicKey.(*ecdsa.PublicKey)
	if !ok {
		return nil, errors.New("its certificate's key is not one Sigstore gives")
	}

	// The statement's signature, over DSSE's pre-authentication encoding.
	pae := fmt.Sprintf("DSSEv1 %d %s %d ", len(env.PayloadType), env.PayloadType, len(env.Payload))
	digest := sha256.Sum256(append([]byte(pae), env.Payload...))
	if !ecdsa.VerifyASN1(pub, digest[:], sig) {
		return nil, errors.New("its statement's signature is not its certificate's")
	}

	// Rekor's signed timestamp, for this very entry.
	if err := verifyRekor(tlog.KindVersion.Kind, tlog.KindVersion.Version, tlog.CanonicalizedBody, tlog.LogID.KeyID, tlog.LogIndex.String(), logged, tlog.InclusionPromise.SignedEntryTimestamp); err != nil {
		return nil, err
	}
	var body struct {
		Spec struct {
			PayloadHash struct {
				Algorithm string `json:"algorithm"`
				Value     string `json:"value"`
			} `json:"payloadHash"`
			Signatures []struct {
				Signature []byte `json:"signature"`
				Verifier  []byte `json:"verifier"`
			} `json:"signatures"`
		} `json:"spec"`
	}
	if json.Unmarshal(tlog.CanonicalizedBody, &body) != nil || len(body.Spec.Signatures) != 1 {
		return nil, errors.New("its log entry can't be read")
	}
	payloadSum := sha256.Sum256(env.Payload)
	logCert, _ := pem.Decode(body.Spec.Signatures[0].Verifier)
	if body.Spec.PayloadHash.Algorithm != "sha256" || body.Spec.PayloadHash.Value != hex.EncodeToString(payloadSum[:]) ||
		!bytes.Equal(body.Spec.Signatures[0].Signature, sig) || logCert == nil || !bytes.Equal(logCert.Bytes, leaf.Raw) {
		return nil, errors.New("its log entry is for something else")
	}

	// The statement: SLSA provenance for this file.
	var st struct {
		Type          string `json:"_type"`
		PredicateType string `json:"predicateType"`
		Subject       []struct {
			Name   string            `json:"name"`
			Digest map[string]string `json:"digest"`
		} `json:"subject"`
	}
	if json.Unmarshal(env.Payload, &st) != nil || st.PredicateType != slsaProvenance {
		return nil, errors.New("its statement is not build provenance")
	}
	for _, s := range st.Subject {
		if s.Name == name && strings.EqualFold(s.Digest["sha256"], sha) {
			return leaf, nil
		}
	}
	return nil, errors.New("its build provenance is for other files")
}

// issuer is the OIDC issuer Fulcio wrote in a certificate.
func issuer(c *x509.Certificate) string {
	if s := extString(c, oidIssuerV2); s != "" {
		return s
	}
	for _, e := range c.Extensions {
		if e.Id.Equal(oidIssuerV1) {
			return string(e.Value)
		}
	}
	return ""
}

// verifyRekor checks Rekor's signed entry timestamp: its key's signature
// over the entry's canonical form, from the log Sigstore runs.
func verifyRekor(kind, version string, body, logID []byte, index string, logged int64, set []byte) error {
	if kind != "dsse" || version != "0.0.1" {
		return fmt.Errorf("its log entry is of a kind this app doesn't know (%s %s)", kind, version)
	}
	block, _ := pem.Decode([]byte(sigstoreRekor))
	key, err := x509.ParsePKIXPublicKey(block.Bytes)
	if err != nil {
		return err
	}
	keyID := sha256.Sum256(block.Bytes)
	if !bytes.Equal(logID, keyID[:]) {
		return errors.New("it was logged somewhere other than Sigstore's log")
	}
	n, err := strconv.ParseInt(index, 10, 64)
	if err != nil {
		return errors.New("its log entry has no place in the log")
	}
	// Rekor signs this exact form: keys in order, no spaces.
	canon, err := json.Marshal(struct {
		Body           string `json:"body"`
		IntegratedTime int64  `json:"integratedTime"`
		LogID          string `json:"logID"`
		LogIndex       int64  `json:"logIndex"`
	}{base64.StdEncoding.EncodeToString(body), logged, hex.EncodeToString(logID), n})
	if err != nil {
		return err
	}
	sum := sha256.Sum256(canon)
	if !ecdsa.VerifyASN1(key.(*ecdsa.PublicKey), sum[:], set) {
		return errors.New("its log entry's timestamp is not Sigstore's log's")
	}
	return nil
}
