package finance

import (
	"fmt"
	"strings"
)

// currencySigns are the signs Finances writes amounts with; another code
// is written before the amount ("CHF 12.00").
var currencySigns = map[string]string{"USD": "$", "CAD": "CA$", "AUD": "A$", "NZD": "NZ$", "EUR": "€", "GBP": "£", "JPY": "¥", "INR": "₹", "MXN": "MX$"}

// MoneyIn writes an amount as Finances' screen does, in a plan's currency:
// "$1,234.56", "−$12.00".
func MoneyIn(code string) func(float64) string {
	code = strings.ToUpper(code)
	if code == "" {
		code = "USD"
	}
	sign, ok := currencySigns[code]
	if !ok {
		sign = code + " "
	}
	return func(n float64) string {
		minus := ""
		if n < -0.005 {
			minus, n = "−", -n
		}
		whole := fmt.Sprintf("%.2f", n)
		units, cents := whole[:len(whole)-3], whole[len(whole)-3:]
		var b strings.Builder
		for i, c := range units {
			if i > 0 && (len(units)-i)%3 == 0 {
				b.WriteByte(',')
			}
			b.WriteRune(c)
		}
		return minus + sign + b.String() + cents
	}
}

// AlertMoney writes amounts for what leaves Finances' screens (the
// household's reminders, on the computer or a phone): as MoneyIn in the
// plan's currency, or the sign and "•••" while Hide amounts is on, since a
// lock screen shows them and ntfy keeps them.
func AlertMoney(p Plan) func(float64) string {
	money := MoneyIn(p.Currency)
	if p.HideAmounts {
		sign := strings.TrimSuffix(money(0), "0.00")
		return func(float64) string { return sign + "•••" }
	}
	return money
}
