package finance

import (
	"fmt"
	"math"
	"time"
)

// A car loses value as it ages: most in its first year, less each year
// after, never below a tenth of what it cost. With what it was bought for
// and when, Finances reads what it is worth today; a value typed in since
// (from a dealer's quote, say) is kept, and it goes on falling from there.

// How fast a car loses value: its first year's share, and each year's
// after, by how it holds its value.
var carClasses = map[string][2]float64{
	"":      {0.20, 0.12}, // most cars
	"holds": {0.12, 0.08}, // trucks, and the makes that keep their value
	"fast":  {0.25, 0.16}, // luxury cars and electric ones
}

// carFloor is the least a car is ever read as worth: a tenth of its price.
const carFloor = 0.10

// carFactor is the share of its price a car is worth, years after it was
// bought: the first year's drop taken evenly through that year, then each
// year's after it, never below the floor.
func carFactor(class string, years float64) float64 {
	c, ok := carClasses[class]
	if !ok {
		c = carClasses[""]
	}
	f := 1.0
	switch {
	case years <= 0:
	case years < 1:
		f = 1 - c[0]*years
	default:
		f = (1 - c[0]) * math.Pow(1-c[1], years-1)
	}
	return math.Max(f, carFloor)
}

// cleanCar keeps a purchase only on a car: a price not below nothing, a
// day it was bought, and a class Finances knows.
func cleanCar(a *Account) error {
	if a.Kind != Car {
		a.Bought, a.BoughtOn, a.Holds = 0, "", ""
		return nil
	}
	if a.Bought < 0 || math.IsInf(a.Bought, 0) {
		return fmt.Errorf("%s: type what it cost without a minus", a.Name)
	}
	if a.BoughtOn != "" {
		if _, err := day(a.BoughtOn, time.UTC); err != nil || len(a.BoughtOn) != 10 {
			return fmt.Errorf("%s: no date %q it was bought (YYYY-MM-DD)", a.Name, a.BoughtOn)
		}
	}
	if _, ok := carClasses[a.Holds]; !ok {
		return fmt.Errorf("%s: %q is not how a car holds its value (holds, fast, or none)", a.Name, a.Holds)
	}
	return nil
}

// carNow is what a car is worth today, read from its purchase: from what
// was typed in on its day, if that is after the purchase, else from its
// price; ok is false when it has no purchase to read from.
func carNow(a Account, typed time.Time, today time.Time) (float64, bool) {
	bought, err := day(a.BoughtOn, today.Location())
	if a.Kind != Car || a.Bought <= 0 || err != nil {
		return 0, false
	}
	years := func(t time.Time) float64 { return math.Max(0, t.Sub(bought).Hours()/24/365.25) }
	now := carFactor(a.Holds, years(today))
	if !typed.IsZero() && typed.After(bought) && a.Balance > 0 {
		return cents(math.Max(a.Balance*now/carFactor(a.Holds, years(typed)), a.Bought*carFloor)), true
	}
	return cents(a.Bought * now), true
}

// carsNow is the plan with each car that has a purchase worth what it is
// read to be today, as though typed in today: Finances reads ahead from it.
func (p Plan) carsNow(today time.Time) Plan {
	var accounts []Account
	for i, a := range p.Accounts {
		typed := time.Time{}
		for _, s := range []string{a.Updated, p.Updated} {
			if d, err := day(s, today.Location()); err == nil {
				typed = d
				break
			}
		}
		v, ok := carNow(a, typed, today)
		if !ok {
			continue
		}
		if accounts == nil {
			accounts = append([]Account{}, p.Accounts...)
		}
		accounts[i].Balance, accounts[i].Updated = v, dateOf(today)
	}
	if accounts != nil {
		p.Accounts = accounts
	}
	return p
}
