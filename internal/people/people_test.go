package people

import (
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

func TestUsernameAndSplit(t *testing.T) {
	for name, want := range map[string]string{"Anna Smith": "anna", "  Ben  ": "ben", "Zoë Ångström": "zoe", "José-María": "jose-maria", "Ølaf": "olaf", "Straße": "strasse", "!!!": "", "": ""} {
		if got := Username(name); got != want {
			t.Errorf("Username(%q) = %q, want %q", name, got, want)
		}
	}
	if f, l := Split("Anna Maria Smith"); f != "Anna" || l != "Maria Smith" {
		t.Errorf("Split: %q %q", f, l)
	}
	if f, l := Split("  "); f != "" || l != "" {
		t.Errorf("Split of nothing: %q %q", f, l)
	}
}

func TestUsesAndActive(t *testing.T) {
	everyone := Person{Name: "Anna"}
	some := Person{Name: "Ben", Apps: []string{"mealie", "immich-server"}}
	if !everyone.Uses("vaultwarden") || !some.Uses("mealie") || some.Uses("vaultwarden") {
		t.Error("Uses: no apps means every app; a list means those")
	}
	if !everyone.Active() || (Person{Removed: time.Now()}).Active() {
		t.Error("Active: until their sign-in is turned off")
	}
}

func TestLoadSaveFind(t *testing.T) {
	root := t.TempDir()
	path := Path(root)
	if list, err := Load(path); err != nil || list != nil {
		t.Fatalf("no household yet: %v %v", list, err)
	}
	list := []Person{{Username: "ben", Name: "ben Jones"}, {Username: "anna", Name: "Anna Smith", Apps: []string{"mealie"}}}
	if err := Save(path, list); err != nil {
		t.Fatal(err)
	}
	if fi, _ := os.Stat(path); runtime.GOOS != "windows" && fi.Mode().Perm() != 0o600 {
		t.Errorf("people.json is %v; it holds names and emails, so it is the account's own", fi.Mode().Perm())
	}
	back, err := Load(path)
	if err != nil || len(back) != 2 || back[0].Username != "anna" || back[1].Username != "ben" || back[0].Apps[0] != "mealie" {
		t.Fatalf("saved sorted by name, read back the same: %+v %v", back, err)
	}
	for _, who := range []string{"ANNA", "anna smith", "Anna Smith"} {
		if i, ok := Find(back, who); !ok || i != 0 {
			t.Errorf("Find(%q) = %d %v", who, i, ok)
		}
	}
	if _, ok := Find(back, "carol"); ok {
		t.Error("found someone not in the household")
	}
	if err := os.WriteFile(path, []byte("{not json"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := Load(path); err == nil {
		t.Error("a broken people.json reads as an error, not an empty household")
	}
	if got := WelcomePath(root, "anna"); got != filepath.Join(root, "data", "people", "anna.html") {
		t.Errorf("WelcomePath %s", got)
	}
}

func TestWelcomePage(t *testing.T) {
	var b strings.Builder
	w := Welcome{
		Person:    Person{Name: "Anna <b>Smith</b>"},
		Household: "The Smith homelab",
		SignIn:    "https://sso.example.com/lc/abc123",
		Until:     time.Date(2026, 10, 27, 12, 0, 0, 0, time.UTC),
		Issuer:    "https://sso.example.com",
		Apps:      []App{{Name: "Photos", Address: "https://photos.example.com", What: "Your photos", Phone: "Immich"}, {Name: "Recipes", Address: "https://recipes.example.com", What: "<script>x</script>"}},
		Tailnet:   true,
		StartPage: "https://home.example.com/#anna",
	}
	if err := Render(&b, w); err != nil {
		t.Fatal(err)
	}
	page := b.String()
	for _, want := range []string{"Welcome, Anna", "The Smith homelab", "https://sso.example.com/lc/abc123", "https://photos.example.com", "Phone app: Immich", "https://home.example.com/#anna", "Tailscale"} {
		if !strings.Contains(page, want) {
			t.Errorf("the page has no %q", want)
		}
	}
	if strings.Contains(page, "<script>x") || strings.Contains(page, "<b>Smith") {
		t.Error("what people typed is put on the page as text, not as HTML")
	}

	b.Reset()
	if err := Render(&b, Welcome{Person: Person{Name: "Ben"}}); err != nil {
		t.Fatal(err)
	}
	if page := b.String(); !strings.Contains(page, "Your homelab") || strings.Contains(page, "It works once") || strings.Contains(page, "Tailscale") {
		t.Errorf("without a link, a household name, or the tailnet, the page says none of them:\n%s", page)
	}
}

// A password on the welcome page is copied by eye onto a TV's keyboard:
// it stays on one line (a break at its hyphen read as part of it), and a
// phone stacks the table's columns so it fits without sliding sideways
// (both measured at 320 and 390 px when this was made).
func TestWelcomeKeepsAPasswordWhole(t *testing.T) {
	var b strings.Builder
	if err := Render(&b, Welcome{Person: Person{Name: "Anna Smith", Username: "anna"}, Accounts: []Account{{App: "Jellyfin", Address: "https://jellyfin.example.com", Username: "anna", Password: "k7mp-2xqr-9wfd-h3nt"}}}); err != nil {
		t.Fatal(err)
	}
	page := b.String()
	for _, want := range []string{"<code>k7mp-2xqr-9wfd-h3nt</code>", "code { font: 15px ui-monospace, SFMono-Regular, Menlo, monospace; white-space: nowrap; }", "@media (max-width: 480px) { td { display: block; }"} {
		if !strings.Contains(page, want) {
			t.Errorf("the welcome page lacks %q", want)
		}
	}
}

// The sheet for the fridge has each app, its address, phone app, and a code
// for the camera, and never the sign-in link, a username, or a password,
// though the welcome page it comes from holds them.
func TestSheetForTheFridge(t *testing.T) {
	w := Welcome{
		Person: Person{Name: "Anna Smith", Username: "anna"}, Household: "The Smith homelab",
		SignIn: "https://id.example.com/lc/secret-one-time", Issuer: "https://id.example.com",
		Apps: []App{
			{Name: "Immich", Address: "https://photos.example.com", What: "Photos", Phone: "Immich"},
			{Name: "Vaultwarden", Address: "https://vault.example.com", What: "Passwords"},
		},
		Accounts:  []Account{{App: "Jellyfin", Address: "https://films.example.com", Username: "anna-films", Password: "correct-horse-battery"}},
		StartPage: "https://home.example.com/anna",
	}
	var b strings.Builder
	if err := RenderSheet(&b, w); err != nil {
		t.Fatal(err)
	}
	page := b.String()
	for _, want := range []string{"Anna's apps", "The Smith homelab", "https://photos.example.com", "Phone app: Immich", "Vaultwarden", "All your apps", "https://home.example.com/anna", `src="data:image/svg`} {
		if !strings.Contains(page, want) {
			t.Errorf("the sheet lacks %q", want)
		}
	}
	if n := strings.Count(page, `src="data:image/svg`); n != 3 {
		t.Errorf("%d codes, want one per app and the start page", n)
	}
	for _, never := range []string{"secret-one-time", "anna-films", "correct-horse-battery", "films.example.com", "Tailscale"} {
		if strings.Contains(page, never) {
			t.Errorf("the sheet shows %q", never)
		}
	}
	// The welcome page links to it, by its name beside it.
	w.Sheet = "anna-sheet.html"
	b.Reset()
	if err := Render(&b, w); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(b.String(), `href="anna-sheet.html"`) {
		t.Error("the welcome page does not link to the sheet")
	}
	if got := SheetPath("/r", "anna"); got != filepath.Join("/r", "data", "people", "anna-sheet.html") {
		t.Errorf("SheetPath = %s", got)
	}
}

// An address too long for a code still gets its card, without the code;
// a sheet that cannot be written says so.
func TestSheetEdges(t *testing.T) {
	long := "https://example.com/" + strings.Repeat("a", 3000)
	var b strings.Builder
	if err := RenderSheet(&b, Welcome{Person: Person{Name: "Bo"}, Apps: []App{{Name: "Long", Address: long}}}); err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(b.String(), "<strong>Long</strong>") || strings.Contains(b.String(), "data:image/svg") {
		t.Errorf("a long address: %.300s", b.String())
	}
	if err := RenderSheet(failWriter{}, Welcome{}); err == nil || !strings.Contains(err.Error(), "the sheet for the fridge") {
		t.Errorf("a failed write: %v", err)
	}
}

type failWriter struct{}

func (failWriter) Write([]byte) (int, error) { return 0, errors.New("disk full") }
