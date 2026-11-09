package companion

// Lock 2 of away from home (docs/Decisions.md, ADR-0023): a request that came
// through the Cloudflare tunnel is served only with Cloudflare Access's
// signed pass, Cf-Access-Jwt-Assertion. Cloudflare stops a request without
// the household's service token before it reaches the house (lock 1); this
// checks the pass Cloudflare adds to one it let through, so a request that
// reached the tunnel some other way (a hostname set up by mistake, Access
// turned off) is still refused here.

import (
	"context"
	"crypto"
	"crypto/rsa"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"math/big"
	"net/http"
	"regexp"
	"slices"
	"strings"
	"sync"
	"time"
)

// Access is the companion's Cloudflare Access application, from .env
// (COMPANION_ACCESS_TEAM, COMPANION_ACCESS_AUD, COMPANION_ACCESS_CLIENT_ID).
// Empty, the tunnel is refused, as before.
type Access struct {
	// Team is the team's name: <team>.cloudflareaccess.com.
	Team string
	// Audience is the Access application's AUD tag.
	Audience string
	// ClientID is the service token's client ID, which Cloudflare puts in the
	// pass as common_name: only that token's passes are taken.
	ClientID string
<<<<<<< HEAD
	// Secret is the service token's secret and Host the companion's
	// hostname through the tunnel (COMPANION_ACCESS_CLIENT_SECRET,
	// COMPANION_AWAY_HOST): given to a phone only when it pairs at home,
	// with its key, so it can go out.
	Secret, Host string
=======
>>>>>>> origin/main
}

// On is whether the tunnel may be used at all.
func (a Access) On() bool {
	return teamName.MatchString(a.Team) && a.Audience != "" && a.ClientID != ""
}

// teamName is a team's name as one DNS label: nothing else can be put
// before .cloudflareaccess.com, so the keys are only ever fetched from
// Cloudflare.
var teamName = regexp.MustCompile(`^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$`)

func (a Access) issuer() string { return "https://" + a.Team + ".cloudflareaccess.com" }

// accessClient fetches the team's keys; tests replace it.
var accessClient = &http.Client{Timeout: 10 * time.Second}

// accessCerts is where a team's keys are; tests point it elsewhere.
var accessCerts = func(a Access) string { return a.issuer() + "/cdn-cgi/access/certs" }

// accessLeeway is how far a pass's times may be off this machine's clock.
const accessLeeway = 30 * time.Second

// accessKeys are a team's signing keys, by key ID, fetched when first
// needed, again after an hour, and again (at most once a minute) for a key
// ID they don't have, as Cloudflare rotates its keys.
type accessKeys struct {
	mu      sync.Mutex
	team    string
	keys    map[string]*rsa.PublicKey
	fetched time.Time
}

const (
	accessKeysFor   = time.Hour
	accessKeysRetry = time.Minute
)

func (k *accessKeys) key(ctx context.Context, a Access, kid string, now time.Time) (*rsa.PublicKey, error) {
	k.mu.Lock()
	defer k.mu.Unlock()
	if k.team != a.Team {
		k.team, k.keys, k.fetched = a.Team, nil, time.Time{}
	}
	stale := now.Sub(k.fetched) > accessKeysFor
	if pub, ok := k.keys[kid]; ok && !stale {
		return pub, nil
	}
	if !stale && now.Sub(k.fetched) < accessKeysRetry {
		return nil, errors.New("not one of the team's keys")
	}
	keys, err := fetchAccessKeys(ctx, a)
	k.fetched = now
	if err != nil {
		return nil, err
	}
	k.keys = keys
	if pub, ok := keys[kid]; ok {
		return pub, nil
	}
	return nil, errors.New("not one of the team's keys")
}

// fetchAccessKeys reads the team's keys (a JSON Web Key Set) from Cloudflare.
func fetchAccessKeys(ctx context.Context, a Access) (map[string]*rsa.PublicKey, error) {
	if !a.On() {
		return nil, errors.New("Cloudflare Access is not set up for the companion")
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, accessCerts(a), nil)
	if err != nil {
		return nil, err
	}
	resp, err := accessClient.Do(req) // #nosec G107 G704 -- the address is Cloudflare's, made from a team name checked as one DNS label
	if err != nil {
		return nil, fmt.Errorf("Cloudflare's keys: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("Cloudflare's keys: %s", resp.Status)
	}
	var set struct {
		Keys []struct {
			Kid, Kty, Alg, N, E string
		} `json:"keys"`
	}
	if err := json.NewDecoder(io.LimitReader(resp.Body, 1<<20)).Decode(&set); err != nil {
		return nil, fmt.Errorf("Cloudflare's keys: %w", err)
	}
	keys := map[string]*rsa.PublicKey{}
	for _, k := range set.Keys {
		if k.Kty != "RSA" || (k.Alg != "" && k.Alg != "RS256") || k.Kid == "" {
			continue
		}
		n, err1 := base64.RawURLEncoding.DecodeString(k.N)
		e, err2 := base64.RawURLEncoding.DecodeString(k.E)
		if err1 != nil || err2 != nil || len(e) == 0 || len(e) > 4 {
			continue
		}
		pub := &rsa.PublicKey{N: new(big.Int).SetBytes(n), E: int(new(big.Int).SetBytes(e).Int64())}
		if pub.N.BitLen() < 2048 {
			continue
		}
		keys[k.Kid] = pub
	}
	if len(keys) == 0 {
		return nil, errors.New("Cloudflare's keys: none could be read")
	}
	return keys, nil
}

// accessPass is what the companion reads in a pass.
type accessPass struct {
	Issuer     string   `json:"iss"`
	Audience   audience `json:"aud"`
	Expires    int64    `json:"exp"`
	NotBefore  int64    `json:"nbf"`
	CommonName string   `json:"common_name"`
}

// audience is a pass's aud: one string, or a list of them.
type audience []string

func (a *audience) UnmarshalJSON(b []byte) error {
	var one string
	if json.Unmarshal(b, &one) == nil {
		*a = audience{one}
		return nil
	}
	var many []string
	if err := json.Unmarshal(b, &many); err != nil {
		return err
	}
	*a = many
	return nil
}

// checkPass verifies Cloudflare Access's pass: signed RS256 by one of the
// team's keys, for this application's audience, by its issuer, for the
// household's service token, and not expired.
func (k *accessKeys) checkPass(ctx context.Context, a Access, pass string, now time.Time) error {
	if !a.On() {
		return errors.New("Cloudflare Access is not set up for the companion")
	}
	parts := strings.Split(pass, ".")
	if len(parts) != 3 {
		return errors.New("not a pass")
	}
	var head struct{ Alg, Kid string }
	if err := decodePart(parts[0], &head); err != nil {
		return err
	}
	if head.Alg != "RS256" {
		return errors.New("not signed as Cloudflare signs")
	}
	sig, err := base64.RawURLEncoding.DecodeString(parts[2])
	if err != nil {
		return errors.New("not a pass")
	}
	pub, err := k.key(ctx, a, head.Kid, now)
	if err != nil {
		return err
	}
	sum := sha256.Sum256([]byte(parts[0] + "." + parts[1]))
	if err := rsa.VerifyPKCS1v15(pub, crypto.SHA256, sum[:], sig); err != nil {
		return errors.New("its signature is not Cloudflare's")
	}
	var c accessPass
	if err := decodePart(parts[1], &c); err != nil {
		return err
	}
	switch {
	case c.Issuer != a.issuer():
		return errors.New("from another team")
	case !slices.Contains(c.Audience, a.Audience):
		return errors.New("for another application")
	case c.CommonName != a.ClientID:
		return errors.New("not the household's service token")
	case c.Expires == 0 || now.After(time.Unix(c.Expires, 0).Add(accessLeeway)):
		return errors.New("expired")
	case c.NotBefore != 0 && now.Add(accessLeeway).Before(time.Unix(c.NotBefore, 0)):
		return errors.New("not valid yet")
	}
	return nil
}

func decodePart(part string, v any) error {
	b, err := base64.RawURLEncoding.DecodeString(part)
	if err != nil || json.Unmarshal(b, v) != nil {
		return errors.New("not a pass")
	}
	return nil
}
