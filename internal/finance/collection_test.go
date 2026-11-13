package finance

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// The Collection (the owner, Nov 12: "a mini Collectr"; mocked and yes,
// Nov 13): cards kept in a collectible account, whose balance is what they
// are worth now, so Net worth and its history count them as any account.
func TestCollectionCountsInItsAccount(t *testing.T) {
	p := Plan{Accounts: []Account{{ID: "pokemon", Name: "Pokémon cards", Kind: Collectible}},
		Collection: []Collected{
			{Account: "pokemon", Name: "  Ember Fox ", Set: " Set A ", Number: " 4/102 ", Count: 2, Paid: 45, Price: 10, PriceOn: "2026-11-10"},
			{Account: "pokemon", Name: "Volt Mouse", Price: 5.5, PriceOn: "2026-11-12", Typed: true},
		}}
	got, err := Clean(p)
	if err != nil {
		t.Fatal(err)
	}
	a := got.Accounts[0]
	if a.Balance != 25.5 || a.Updated != "2026-11-12" {
		t.Errorf("the account holds %v, updated %s; want 25.5 on 2026-11-12", a.Balance, a.Updated)
	}
	if n := len(a.History); n == 0 || a.History[n-1].Date != "2026-11-12" || a.History[n-1].Amount != 25.5 {
		t.Errorf("its history: %+v", a.History)
	}
	c := got.Collection[0]
	if c.Name != "Ember Fox" || c.Set != "Set A" || c.Number != "4/102" || c.ID == "" || c.ID == got.Collection[1].ID {
		t.Errorf("cleaned: %+v", got.Collection)
	}
	if got.Collection[1].Count != 0 || Worth(got.Collection[1]) != 5.5 {
		t.Errorf("one card, none typed: %+v", got.Collection[1])
	}
	// A card's price is its own typed day; an account with none keeps what was typed for it.
	p.Collection = nil
	p.Accounts[0].Balance, p.Accounts[0].Updated = 300, "2026-10-01"
	if got, _ := Clean(p); got.Accounts[0].Balance != 300 {
		t.Errorf("no cards: the balance typed in, %v", got.Accounts[0].Balance)
	}
}

func TestCollectionIsChecked(t *testing.T) {
	base := func(c Collected) Plan {
		return Plan{Accounts: []Account{{ID: "pokemon", Name: "Pokémon cards", Kind: Collectible}, {ID: "chk", Name: "Checking", Kind: Checking}}, Collection: []Collected{c}}
	}
	for _, c := range []struct {
		card Collected
		want string
	}{
		{Collected{Account: "pokemon"}, "no name"},
		{Collected{Account: "gone", Name: "Ember Fox"}, "isn't"},
		{Collected{Account: "chk", Name: "Ember Fox"}, "collectible"},
		{Collected{Account: "pokemon", Name: "Ember Fox", Price: -1}, "price"},
		{Collected{Account: "pokemon", Name: "Ember Fox", Paid: -1}, "paid"},
		{Collected{Account: "pokemon", Name: "Ember Fox", Count: -2}, "how many"},
		{Collected{Account: "pokemon", Name: "Ember Fox", Count: 100000}, "how many"},
		{Collected{Account: "pokemon", Name: "Ember Fox", Price: 2e12}, "too large"},
		{Collected{Account: "pokemon", Name: "Ember Fox", PriceOn: "yesterday"}, "day"},
		{Collected{Account: "pokemon", Name: "Ember Fox", PaidOn: "2026-13-01"}, "day"},
		{Collected{Account: "pokemon", Name: "Ember Fox", Picture: "../phones.json"}, "picture"},
	} {
		if _, err := Clean(base(c.card)); err == nil || !strings.Contains(err.Error(), c.want) {
			t.Errorf("%+v: %v, want %q", c.card, err, c.want)
		}
	}
	many := base(Collected{Account: "pokemon", Name: "x"})
	for len(many.Collection) <= maxCollected {
		many.Collection = append(many.Collection, Collected{Account: "pokemon", Name: "x"})
	}
	if _, err := Clean(many); err == nil {
		t.Error("more cards than a plan keeps")
	}
}

// An older plan, from before the Collection, loads as it was (rule 2).
func TestAPlanWithoutACollectionLoads(t *testing.T) {
	path := filepath.Join(t.TempDir(), "finance.json")
	if err := os.WriteFile(path, []byte(`{"accounts":[{"id":"art","name":"A painting","kind":"collectible","balance":900,"updated":"2026-01-02"}]}`), 0o600); err != nil {
		t.Fatal(err)
	}
	p, err := Load(path)
	if err != nil {
		t.Fatal(err)
	}
	if p.Collection != nil {
		t.Errorf("a collection from nowhere: %+v", p.Collection)
	}
	if p, err = Clean(p); err != nil || p.Accounts[0].Balance != 900 {
		t.Errorf("cleaned: %+v %v", p.Accounts, err)
	}
}
