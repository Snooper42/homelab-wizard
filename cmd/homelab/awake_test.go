package main

import "testing"

func TestParseSleep(t *testing.T) {
	laptop := "Battery Power:\n lowpowermode         0\n sleep                1\n displaysleep         2\nAC Power:\n sleep                10 (sleep prevented by caffeinate)\n displaysleep         10\n"
	if n, ok := parseSleep(laptop); !ok || n != 10 {
		t.Errorf("laptop on power: %d %v", n, ok)
	}
	mini := "AC Power:\n Sleep On Power Button 1\n sleep                0\n"
	if n, ok := parseSleep(mini); !ok || n != 0 {
		t.Errorf("never sleeps: %d %v", n, ok)
	}
	if _, ok := parseSleep("nothing here"); ok {
		t.Error("no sleep line")
	}
}
