package finance

import "testing"

// Amounts as Finances' screen writes them, and as its reminders do: hidden
// while Hide amounts is on, the currency's sign kept.
func TestMoneyInAndAlertMoney(t *testing.T) {
	for _, c := range []struct {
		code string
		n    float64
		want string
	}{
		{"", 1234.5, "$1,234.50"},
		{"usd", -12, "−$12.00"},
		{"EUR", 0.004, "€0.00"},
		{"CHF", 1000000, "CHF 1,000,000.00"},
	} {
		if got := MoneyIn(c.code)(c.n); got != c.want {
			t.Errorf("MoneyIn(%q)(%v) = %q, want %q", c.code, c.n, got, c.want)
		}
	}
	if got := AlertMoney(Plan{Currency: "GBP"})(15.49); got != "£15.49" {
		t.Errorf("shown: %q", got)
	}
	if got := AlertMoney(Plan{Currency: "GBP", HideAmounts: true})(15.49); got != "£•••" {
		t.Errorf("hidden: %q", got)
	}
}
