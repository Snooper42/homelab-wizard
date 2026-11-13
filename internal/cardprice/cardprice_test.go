package cardprice

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// A made-up TCGdex: two printings of one name and number in different
// sets, a card with only a Cardmarket price, and a picture.
func fakeTCGdex(t *testing.T) (*httptest.Server, *[]string) {
	t.Helper()
	var mu sync.Mutex
	var asked []string
	card := func(id, name, local, set string, usd float64) map[string]any {
		c := map[string]any{"id": id, "name": name, "localId": local, "set": map[string]any{"name": set}, "image": "%s/en/x/" + id}
		if usd > 0 {
			c["pricing"] = map[string]any{"tcgplayer": map[string]any{"unit": "USD", "normal": map[string]any{"marketPrice": usd / 4}, "holofoil": map[string]any{"marketPrice": usd}}}
		} else {
			c["pricing"] = map[string]any{"cardmarket": map[string]any{"unit": "EUR", "trend": 12.5}}
		}
		return c
	}
	cards := map[string]map[string]any{
		"seta-4":  card("seta-4", "Ember Fox", "4", "Set A", 182.4),
		"setb-4":  card("setb-4", "Ember Fox", "4", "Set B", 20),
		"setc-25": card("setc-25", "Volt Mouse", "25", "Promo", 0),
	}
	var srv *httptest.Server
	srv = httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		asked = append(asked, r.URL.RequestURI())
		mu.Unlock()
		switch {
		case r.URL.Path == "/v2/en/cards":
			want := strings.TrimPrefix(r.URL.Query().Get("name"), "eq:")
			var out []map[string]any
			for _, c := range cards {
				if c["name"] == want {
					out = append(out, map[string]any{"id": c["id"], "localId": c["localId"], "name": c["name"]})
				}
			}
			_ = json.NewEncoder(w).Encode(out)
		case strings.HasPrefix(r.URL.Path, "/v2/en/cards/"):
			c, ok := cards[strings.TrimPrefix(r.URL.Path, "/v2/en/cards/")]
			if !ok {
				http.NotFound(w, r)
				return
			}
			c = map[string]any{"id": c["id"], "name": c["name"], "localId": c["localId"], "set": c["set"], "pricing": c["pricing"], "image": strings.Replace(c["image"].(string), "%s", srv.URL, 1)}
			_ = json.NewEncoder(w).Encode(c)
		case strings.HasPrefix(r.URL.Path, "/en/x/") && strings.HasSuffix(r.URL.Path, "/high.webp"):
			w.Header().Set("Content-Type", "image/webp")
			_, _ = w.Write(tinyWebP)
		default:
			http.NotFound(w, r)
		}
	}))
	t.Cleanup(srv.Close)
	return srv, &asked
}

// A 1×1 lossless WebP.
var tinyWebP = []byte{0x52, 0x49, 0x46, 0x46, 0x1a, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x4c, 0x0d, 0x00, 0x00, 0x00, 0x2f, 0x00, 0x00, 0x00, 0x10, 0x07, 0x10, 0x11, 0x11, 0x88, 0x88, 0xfe, 0x07, 0x00}

// Update prices (the owner, Nov 13: TCGdex): each card not kept at its own
// price gets TCGplayer's market price, a printing matched by its number and
// set, the price service's id for it and its picture, saved on the
// computer; only a card's name, then its id, is ever sent.
func TestUpdatePrices(t *testing.T) {
	srv, asked := fakeTCGdex(t)
	root := t.TempDir()
	plan := finance.Plan{Rev: "new", Accounts: []finance.Account{{ID: "pokemon", Name: "Pokémon cards", Kind: finance.Collectible}},
		Collection: []finance.Collected{
			{Account: "pokemon", Name: "Ember Fox", Set: "set a", Number: "4/102", Paid: 45, Price: 100, PriceOn: "2026-10-01"},
			{Account: "pokemon", Name: "Ember Fox", Number: "004"},
			{Account: "pokemon", Name: "Moon Moth", Grade: "Graded 9", Price: 150, Typed: true},
			{Account: "pokemon", Name: "Volt Mouse", Number: "25"},
			{Account: "pokemon", Name: "Nobody Knows", Number: "1"},
		}}
	if _, err := finance.Save(finance.Path(root), plan); err != nil {
		t.Fatal(err)
	}
	c := Client{Base: srv.URL, Assets: []string{strings.TrimPrefix(srv.URL, "http://")}, HTTP: srv.Client(), Insecure: true}
	day := time.Date(2026, 11, 13, 9, 0, 0, 0, time.Local)
	res, err := Update(context.Background(), root, c, day)
	if err != nil {
		t.Fatal(err)
	}
	got, _ := finance.Load(finance.Path(root))
	ember := got.Collection[0]
	if ember.Price != 182.4 || ember.PriceOn != "2026-11-13" || ember.Ref != "seta-4" || ember.Picture == "" {
		t.Errorf("Ember Fox, Set A: %+v", ember)
	}
	if _, err := os.Stat(finance.CardPicturesDir(root) + "/" + ember.Picture); err != nil {
		t.Errorf("its picture isn't kept: %v", err)
	}
	if got.Collection[1].Price != 0 || got.Collection[1].Ref != "" {
		t.Errorf("two printings and no set to tell them apart: %+v", got.Collection[1])
	}
	if got.Collection[2].Price != 150 || got.Collection[2].PriceOn != "" {
		t.Errorf("a price of its own changed: %+v", got.Collection[2])
	}
	if got.Collection[3].Price != 0 || got.Collection[3].Ref != "setc-25" {
		t.Errorf("no TCGplayer price: found, not priced: %+v", got.Collection[3])
	}
	if res.Updated != 1 || len(res.Unclear) != 1 || len(res.Unpriced) != 1 || len(res.NotFound) != 1 || res.Kept != 1 {
		t.Errorf("said: %+v", res)
	}
	if got.Accounts[0].Balance != 182.4+150 {
		t.Errorf("the account is worth %v", got.Accounts[0].Balance)
	}
	hist, _ := LoadHistory(root)
	if pts := hist[ember.ID]; len(pts) != 1 || pts[0].Date != "2026-11-13" || pts[0].Amount != 182.4 {
		t.Errorf("Ember Fox's price history: %+v", hist)
	}
	// Only names and the service's ids went out: nothing paid, no count, no grade, no account.
	for _, a := range *asked {
		for _, leak := range []string{"45", "Graded", "Moon", "pokemon", "102"} {
			if strings.Contains(a, leak) {
				t.Errorf("sent %q in %s", leak, a)
			}
		}
	}
	// Again, the next day: the id found is asked for at once, no name search; one point a day.
	*asked = nil
	if _, err := Update(context.Background(), root, c, day.AddDate(0, 0, 1)); err != nil {
		t.Fatal(err)
	}
	if strings.Join(*asked, " ") == "" || bytes.Contains([]byte(strings.Join(*asked, " ")), []byte("/v2/en/cards/seta-4")) == false {
		t.Errorf("asked %v", *asked)
	}
	hist, _ = LoadHistory(root)
	if len(hist[ember.ID]) != 2 {
		t.Errorf("two days, two points: %+v", hist[ember.ID])
	}
}

// A picture from anywhere but the price service's own pictures, or not a
// picture at all, is never kept.
func TestPicturesOnlyFromTheService(t *testing.T) {
	srv, _ := fakeTCGdex(t)
	c := Client{Base: srv.URL, Assets: []string{"assets.tcgdex.net"}, HTTP: srv.Client(), Insecure: true}
	if _, err := c.picture(context.Background(), srv.URL+"/en/x/seta-4"); err == nil {
		t.Error("a picture from another host was fetched")
	}
	if _, err := (Client{Assets: []string{"assets.tcgdex.net"}}).picture(context.Background(), "http://assets.tcgdex.net/en/x"); err == nil {
		t.Error("a picture over plain http was fetched")
	}
}
