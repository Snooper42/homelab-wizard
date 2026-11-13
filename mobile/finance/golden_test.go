package finance

import (
	"bytes"
	"encoding/json"
	"flag"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/finance"
)

// update rewrites each golden plan's view.json from the computer's own
// projection: go test ./mobile/finance -update, after a change to what
// Finances shows (and look at the diff).
var update = flag.Bool("update", false, "rewrite the golden views")

// golden is made-up plans and ledgers (never the household's), each with
// the day it's read on and the finance.View the computer gives for it.
const golden = "../../internal/finance/testdata/golden"

type goldenCase struct {
	name                string
	plan, ledger, today []byte
	dir                 string
}

func goldenCases(t *testing.T) []goldenCase {
	t.Helper()
	dirs, err := os.ReadDir(golden)
	if err != nil {
		t.Fatal(err)
	}
	var out []goldenCase
	for _, d := range dirs {
		if !d.IsDir() {
			continue
		}
		dir := filepath.Join(golden, d.Name())
		read := func(name string) []byte {
			b, err := os.ReadFile(filepath.Join(dir, name))
			if err != nil {
				t.Fatal(err)
			}
			return b
		}
		out = append(out, goldenCase{d.Name(), read("plan.json"), read("ledger.json"), bytes.TrimSpace(read("today")), dir})
	}
	if len(out) < 3 {
		t.Fatalf("%d golden plans: there are at least 3", len(out))
	}
	return out
}

func compact(t *testing.T, b []byte) string {
	t.Helper()
	var out bytes.Buffer
	if err := json.Compact(&out, b); err != nil {
		t.Fatal(err)
	}
	return out.String()
}

// The phone's projection gives, for each golden plan, the very finance.View
// saved beside it. The same test runs on the computer and as WebAssembly
// (CI's phone-finance job), so the page's build is checked against the
// computer's own.
func TestTheGoldenViews(t *testing.T) {
	for _, c := range goldenCases(t) {
		t.Run(c.name, func(t *testing.T) {
			got, err := Project(c.plan, c.ledger, string(c.today))
			if err != nil {
				t.Fatal(err)
			}
			path := filepath.Join(c.dir, "view.json")
			if *update && runtime.GOOS != "js" {
				var pretty bytes.Buffer
				if err := json.Indent(&pretty, got, "", " "); err != nil {
					t.Fatal(err)
				}
				pretty.WriteByte('\n')
				if err := os.WriteFile(path, pretty.Bytes(), 0o644); err != nil {
					t.Fatal(err)
				}
			}
			want, err := os.ReadFile(path)
			if err != nil {
				t.Fatalf("%v: go test ./mobile/finance -update writes it", err)
			}
			if compact(t, got) != compact(t, want) {
				t.Errorf("%s on %s isn't the saved view (%s): if Finances changed on purpose, go test ./mobile/finance -update and look at the diff", c.name, c.today, runtime.GOOS)
			}
		})
	}
}

// Each golden plan is one the computer would keep (Clean passes), and the
// phone's projection is what the computer's Finances call gives for the
// same files: Load, LoadLedger, ProjectWith.
func TestTheGoldenPlansAreTheComputers(t *testing.T) {
	if runtime.GOOS == "js" {
		t.Skip("on the computer only")
	}
	for _, c := range goldenCases(t) {
		t.Run(c.name, func(t *testing.T) {
			root := t.TempDir()
			if err := os.MkdirAll(filepath.Join(root, "data"), 0o700); err != nil {
				t.Fatal(err)
			}
			if err := os.WriteFile(finance.Path(root), c.plan, 0o600); err != nil {
				t.Fatal(err)
			}
			if len(c.ledger) > 0 {
				if err := os.WriteFile(finance.LedgerPath(root), c.ledger, 0o600); err != nil {
					t.Fatal(err)
				}
			}
			p, err := finance.Load(finance.Path(root))
			if err != nil {
				t.Fatal(err)
			}
			l, err := finance.LoadLedger(finance.LedgerPath(root))
			if err != nil {
				t.Fatal(err)
			}
			// Checked on copies of their own: Clean fills in the slices it's handed.
			if kept, err := finance.ParsePlan(c.plan); err != nil {
				t.Fatal(err)
			} else if cleaned, err := finance.Clean(kept); err != nil {
				t.Errorf("not a plan the computer keeps: %v", err)
			} else if kept, err := finance.ParseLedger(c.ledger); len(c.ledger) > 0 && err == nil {
				if _, err := finance.CleanLedger(kept, cleaned); err != nil {
					t.Errorf("not a ledger the computer keeps: %v", err)
				}
			}
			day, _ := time.Parse(time.DateOnly, string(c.today))
			want, err := json.Marshal(finance.ProjectWith(p, l, day, finance.Ahead))
			if err != nil {
				t.Fatal(err)
			}
			got, err := Project(c.plan, c.ledger, string(c.today))
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != string(want) {
				i := 0
				for i < len(got) && i < len(want) && got[i] == want[i] {
					i++
				}
				t.Errorf("the phone's projection isn't the computer's, from byte %d: %.120s / %.120s", i, got[max(0, i-40):], want[max(0, i-40):])
			}
		})
	}
}

// What the phone hands in that isn't a plan, a ledger or a day is refused
// in words, never projected as if it were empty.
func TestProjectRefusesWhatIsNotAPlan(t *testing.T) {
	for _, c := range []struct{ plan, ledger, today, says string }{
		{`{}`, ``, `13/11/2026`, "no day"},
		{`{}`, ``, ``, "no day"},
		{`not json`, ``, `2026-11-13`, "the plan"},
		{`{}`, `[1,2]`, `2026-11-13`, "the ledger"},
	} {
		_, err := Project([]byte(c.plan), []byte(c.ledger), c.today)
		if err == nil || !strings.Contains(err.Error(), c.says) {
			t.Errorf("%q %q %q: %v", c.plan, c.ledger, c.today, err)
		}
	}
	if _, err := Project([]byte(`{}`), nil, "2026-11-13"); err != nil {
		t.Errorf("an empty plan and no ledger yet: %v", err)
	}
}
