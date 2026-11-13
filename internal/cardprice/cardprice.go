// Package cardprice reads the Collection's prices and pictures from TCGdex
// (api.tcgdex.net), on a click only: the owner's yes, Nov 13, the one
// outside source Finances asks (finances-loop.md rule 1 otherwise holds).
// Only a card's name is sent, to find it, and then the id TCGdex gives it;
// never what was paid, how many, its grade or anything else of the plan.
// A price is TCGplayer's market price in US dollars; a picture is saved on
// the computer (finance.SaveCardPicture) and shown from there.
package cardprice

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
	"github.com/Snooper42/homelab-wizard/internal/lockedfile"
)

// Client is where prices and pictures are read: TCGdex, or a test's.
type Client struct {
	// Base is the API's address (https://api.tcgdex.net).
	Base string
	// Assets are the hosts a picture may come from (assets.tcgdex.net).
	Assets []string
	HTTP   *http.Client
	// Insecure lets a test's server answer over plain http.
	Insecure bool
}

// Default is TCGdex itself.
func Default() Client {
	return Client{Base: "https://api.tcgdex.net", Assets: []string{"assets.tcgdex.net"}, HTTP: &http.Client{Timeout: 20 * time.Second}}
}

// Result is what a read did, for the screen to say.
type Result struct {
	// Updated is how many cards got a price; Kept, how many keep their own.
	Updated int `json:"updated"`
	Kept    int `json:"kept"`
	// NotFound: no card of that name and number; Unclear: more than one
	// printing, and no set to tell them apart; Unpriced: found, with no
	// TCGplayer price in dollars.
	NotFound []string `json:"notFound,omitempty"`
	Unclear  []string `json:"unclear,omitempty"`
	Unpriced []string `json:"unpriced,omitempty"`
}

// card is what TCGdex says of one card (its brief form has no set or pricing).
type card struct {
	ID      string `json:"id"`
	Name    string `json:"name"`
	LocalID string `json:"localId"`
	Image   string `json:"image"`
	Set     struct {
		Name string `json:"name"`
	} `json:"set"`
	Pricing struct {
		TCGplayer map[string]json.RawMessage `json:"tcgplayer"`
	} `json:"pricing"`
}

// maxAnswer is the most an answer from TCGdex may be (a name search lists
// a few hundred cards at most).
const maxAnswer = 4 << 20

// get reads a JSON answer from TCGdex's API.
func (c Client) get(ctx context.Context, path string, q url.Values, into any) (int, error) {
	u := strings.TrimRight(c.Base, "/") + path
	if len(q) > 0 {
		u += "?" + q.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := c.web().Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return resp.StatusCode, fmt.Errorf("TCGdex answered %s", resp.Status)
	}
	return resp.StatusCode, json.NewDecoder(io.LimitReader(resp.Body, maxAnswer)).Decode(into)
}

// number is a card's number as TCGdex keeps it: the part before a slash, no leading zeros ("004/102" → "4").
func number(s string) string {
	s, _, _ = strings.Cut(strings.TrimSpace(s), "/")
	if t := strings.TrimLeft(s, "0"); t != "" {
		return strings.ToLower(t)
	}
	return strings.ToLower(s)
}

// find is the card c names: by the id found before, else by its name (the
// one thing sent), narrowed here by its number and then its set. ok false
// with unclear: more than one printing fits.
func (c Client) find(ctx context.Context, x finance.Collected) (found card, ok, unclear bool, err error) {
	if x.Ref != "" {
		var one card
		code, err := c.get(ctx, "/v2/en/cards/"+url.PathEscape(x.Ref), nil, &one)
		if err == nil && one.ID != "" {
			return one, true, false, nil
		}
		if code != http.StatusNotFound {
			return card{}, false, false, err
		}
	}
	var brief []card
	if _, err := c.get(ctx, "/v2/en/cards", url.Values{"name": {"eq:" + x.Name}}, &brief); err != nil {
		return card{}, false, false, err
	}
	var ids []string
	for _, b := range brief {
		if x.Number == "" || number(b.LocalID) == number(x.Number) {
			ids = append(ids, b.ID)
		}
	}
	if len(ids) == 0 {
		return card{}, false, false, nil
	}
	if len(ids) > 8 && x.Set == "" {
		return card{}, false, true, nil
	}
	var fits []card
	for _, id := range ids[:min(len(ids), 8)] {
		var one card
		if _, err := c.get(ctx, "/v2/en/cards/"+url.PathEscape(id), nil, &one); err != nil {
			return card{}, false, false, err
		}
		if x.Set == "" || strings.EqualFold(strings.TrimSpace(one.Set.Name), strings.TrimSpace(x.Set)) {
			fits = append(fits, one)
		}
	}
	if len(fits) != 1 {
		return card{}, false, len(fits) > 1 || x.Set == "", nil
	}
	return fits[0], true, false, nil
}

// variants are TCGplayer's printings, the one a card most likely is first.
var variants = []string{"holofoil", "normal", "reverse-holofoil", "1st-edition-holofoil", "1st-edition", "unlimited-holofoil", "unlimited"}

// price is the card's TCGplayer market price in dollars, or 0.
func price(c card) float64 {
	tp := c.Pricing.TCGplayer
	var unit string
	if json.Unmarshal(tp["unit"], &unit) != nil || unit != "USD" {
		return 0
	}
	keys := slices.Sorted(func(yield func(string) bool) {
		for k := range tp {
			if !yield(k) {
				return
			}
		}
	})
	for _, k := range append(slices.Clone(variants), keys...) {
		var v struct {
			MarketPrice float64 `json:"marketPrice"`
		}
		if raw, ok := tp[k]; ok && json.Unmarshal(raw, &v) == nil && v.MarketPrice > 0 && v.MarketPrice < 1e7 {
			return v.MarketPrice
		}
	}
	return 0
}

// picture reads a card's picture from the price service's own picture host
// only, over https, as a data URL.
func (c Client) picture(ctx context.Context, raw string) (string, error) {
	u, err := url.Parse(raw)
	if err != nil || (u.Scheme != "https" && !(c.Insecure && u.Scheme == "http")) || !slices.Contains(c.Assets, u.Host) || u.User != nil {
		return "", fmt.Errorf("a picture is only read from %s", strings.Join(c.Assets, ", "))
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	resp, err := c.web().Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("the picture: %s", resp.Status)
	}
	b, err := io.ReadAll(io.LimitReader(resp.Body, finance.MaxCardPicture+1))
	if err != nil {
		return "", err
	}
	kind := http.DetectContentType(b)
	if len(b) > finance.MaxCardPicture || (kind != "image/jpeg" && kind != "image/png" && kind != "image/webp") {
		return "", errors.New("the picture isn't one")
	}
	return "data:" + kind + ";base64," + base64.StdEncoding.EncodeToString(b), nil
}

// HistoryPath is each card's price over time, beside the plan (so the plan
// the phones load stays small).
func HistoryPath(root string) string { return filepath.Join(root, "data", "finance-card-prices.json") }

// maxHistory is as many days of a card's price as are kept.
const maxHistory = 400

// LoadHistory reads each card's prices by its id; none yet is empty.
func LoadHistory(root string) (map[string][]finance.Point, error) {
	out := map[string][]finance.Point{}
	data, err := os.ReadFile(HistoryPath(root)) // #nosec G304 -- the homelab's own file
	if os.IsNotExist(err) {
		return out, nil
	}
	if err != nil {
		return out, err
	}
	if err := json.Unmarshal(data, &out); err != nil {
		return map[string][]finance.Point{}, err
	}
	return out, nil
}

// note keeps a card's price on day: one point a day, the oldest let go.
func note(pts []finance.Point, day string, amount float64) []finance.Point {
	if n := len(pts); n > 0 && pts[n-1].Date == day {
		pts[n-1].Amount = amount
		return pts
	}
	pts = append(pts, finance.Point{Date: day, Amount: amount})
	if len(pts) > maxHistory {
		pts = pts[len(pts)-maxHistory:]
	}
	return pts
}

// Update reads a price (and, for a card with none, a picture) for each card
// not kept at its own price, and saves the plan and each card's history.
// A failure to reach TCGdex stops it before anything is saved.
func Update(ctx context.Context, root string, c Client, now time.Time) (Result, error) {
	var res Result
	path := finance.Path(root)
	p, err := finance.Load(path)
	if err != nil {
		return res, err
	}
	hist, _ := LoadHistory(root)
	day := now.Format(time.DateOnly)
	for i := range p.Collection {
		x := &p.Collection[i]
		if x.Typed {
			res.Kept++
			continue
		}
		found, ok, unclear, err := c.find(ctx, *x)
		if err != nil {
			return Result{}, fmt.Errorf("TCGdex didn't answer, so no price changed: %w", err)
		}
		switch {
		case unclear:
			res.Unclear = append(res.Unclear, x.Name)
			continue
		case !ok:
			res.NotFound = append(res.NotFound, x.Name)
			continue
		}
		x.Ref = found.ID
		if pr := price(found); pr > 0 {
			x.Price, x.PriceOn = pr, day
			hist[x.ID] = note(hist[x.ID], day, pr)
			res.Updated++
		} else {
			res.Unpriced = append(res.Unpriced, x.Name)
		}
		if x.Picture == "" && found.Image != "" {
			if data, err := c.picture(ctx, found.Image+"/high.webp"); err == nil {
				if name, err := finance.SaveCardPicture(finance.CardPicturesDir(root), data); err == nil {
					x.Picture = name
				}
			}
		}
	}
	if _, err := finance.Save(path, p); err != nil {
		if errors.Is(err, finance.ErrChanged) {
			return Result{}, errors.New("Finances changed on another device meanwhile: press Update prices again")
		}
		return Result{}, err
	}
	// The history of cards no longer kept goes with them.
	for id := range hist {
		if !slices.ContainsFunc(p.Collection, func(x finance.Collected) bool { return x.ID == id }) {
			delete(hist, id)
		}
	}
	data, err := json.Marshal(hist)
	if err != nil {
		return res, err
	}
	return res, lockedfile.Write(HistoryPath(root), data, 0o600)
}

// web is c.HTTP, following a redirect only within the service (sameService).
func (c Client) web() *http.Client {
	h := http.Client{}
	if c.HTTP != nil {
		h = *c.HTTP
	}
	h.CheckRedirect = func(req *http.Request, via []*http.Request) error { return sameService(c, req, via) }
	return &h
}

// sameService refuses a redirect anywhere but TCGdex's own hosts (the API's
// and the pictures'), over https: a question carries a card's name, and a
// picture is read only from the service's own host.
func sameService(c Client, req *http.Request, via []*http.Request) error {
	if len(via) >= 5 {
		return errors.New("TCGdex sent the question round too many times")
	}
	base, _ := url.Parse(c.Base)
	host := req.URL.Host
	secure := req.URL.Scheme == "https" || (c.Insecure && req.URL.Scheme == "http")
	if !secure || ((base == nil || host != base.Host) && !slices.Contains(c.Assets, host)) {
		return fmt.Errorf("TCGdex sent the question on to %s, which isn't its own", req.URL.Redacted())
	}
	return nil
}
