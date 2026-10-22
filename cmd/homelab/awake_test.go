package main

import (
	"strings"
	"testing"
)

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

func TestParseGnomeSleep(t *testing.T) {
	if n, ok := parseGnomeSleep("'suspend'\n", "900\n"); !ok || n != 15 {
		t.Errorf("suspend after 900s: %d %v", n, ok)
	}
	if n, ok := parseGnomeSleep("'nothing'\n", "1200\n"); !ok || n != 0 {
		t.Errorf("never: %d %v", n, ok)
	}
	if n, ok := parseGnomeSleep("'suspend'", "uint32 0"); !ok || n != 0 {
		t.Errorf("no timeout: %d %v", n, ok)
	}
	if _, ok := parseGnomeSleep("", "900"); ok {
		t.Error("no setting")
	}
}

func TestParsePowercfg(t *testing.T) {
	out := `Power Scheme GUID: 381b4222-f694-41f0-9685-ff5bb260df2e  (Balanced)
  Subgroup GUID: 238c9fa8-0aad-41ed-83f4-97be242c8f20  (Sleep)
    GUID Alias: SUB_SLEEP
    Power Setting GUID: 29f6c1db-86da-48c5-9fdb-f2b67b1f44da  (Sleep after)
      GUID Alias: STANDBYIDLE
      Minimum Possible Setting: 0x00000000
      Maximum Possible Setting: 0xffffffff
      Possible Settings increment: 0x00000001
      Possible Settings units: Seconds
    Current AC Power Setting Index: 0x00000708
    Current DC Power Setting Index: 0x00000384
`
	if n, ok := parsePowercfg(out); !ok || n != 30 {
		t.Errorf("30 minutes on power: %d %v", n, ok)
	}
	never := strings.Replace(out, "0x00000708", "0x00000000", 1)
	if n, ok := parsePowercfg(never); !ok || n != 0 {
		t.Errorf("never on power: %d %v", n, ok)
	}
	if _, ok := parsePowercfg("Invalid Parameters -- try \"/?\" for help"); ok {
		t.Error("no setting")
	}
}
