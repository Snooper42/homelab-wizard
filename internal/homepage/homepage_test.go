package homepage

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestRender(t *testing.T) {
	got := string(Render([]Entry{
		{Category: "Media", Name: "Immich", Description: "Photos", URL: "https://photos.example.com", Icon: Icon("immich-server")},
		{Category: "Productivity", Name: "MoneyMatter", URL: "https://money.example.com", Icon: Icon("moneymatter-frontend")},
		{Category: "Media", Name: `Say "hi"`, URL: "https://x.example.com", Icon: Icon("navidrome")},
	}))
	want := Marker + `
- "Media":
    - "Immich":
        icon: "immich.png"
        href: "https://photos.example.com"
        description: "Photos"
    - "Say \"hi\"":
        icon: "navidrome.png"
        href: "https://x.example.com"
- "Productivity":
    - "MoneyMatter":
        href: "https://money.example.com"
`
	if got != want {
		t.Fatalf("got:\n%s\nwant:\n%s", got, want)
	}
}

func TestWrite(t *testing.T) {
	path := filepath.Join(t.TempDir(), "homepage", "services.yaml")
	data := Render([]Entry{{Category: "Media", Name: "Immich", URL: "https://photos.example.com"}})
	if changed, err := Write(path, data); err != nil || !changed {
		t.Fatalf("new file: %v %v", changed, err)
	}
	if changed, err := Write(path, data); err != nil || changed {
		t.Fatalf("same content: %v %v", changed, err)
	}
	starter := "---\n- My First Group:\n    - My First Service:\n        href: http://localhost/\n\n- My Second Group:\n    - My Second Service:\n        href: http://localhost/\n"
	_ = os.WriteFile(path, []byte(starter), 0o644)
	if changed, err := Write(path, data); err != nil || !changed {
		t.Fatalf("Homepage's starter file should be replaced: %v %v", changed, err)
	}
	_ = os.WriteFile(path, []byte("- Mine:\n    - Router:\n        href: http://192.168.1.1\n"), 0o644)
	if _, err := Write(path, data); !errors.Is(err, ErrHandEdited) {
		t.Fatalf("a hand-made file should be left alone: %v", err)
	}
	if b, _ := os.ReadFile(path); !strings.Contains(string(b), "Router") {
		t.Fatal("the hand-made file was changed")
	}
}

func TestTabs(t *testing.T) {
	tab := Tab{Name: "Anna Marie", Entries: []Entry{{Category: "Household", Name: "Mealie", URL: "https://recipes.example.com"}}}
	if tab.Slug() != "anna-marie" {
		t.Errorf("slug %q", tab.Slug())
	}
	if got := string(Render(tab.Entries, tab)); !strings.Contains(got, "- \"Anna Marie's apps\":\n    - \"Mealie\":") {
		t.Errorf("%s", got)
	}
	if got := string(Settings("Homelab", []string{"Household"}, nil)); strings.Contains(got, "layout") {
		t.Errorf("no tabs, no layout:\n%s", got)
	}
	dir := t.TempDir()
	starter := filepath.Join(dir, "settings.yaml")
	_ = os.WriteFile(starter, []byte("providers:\n  openweathermap: openweathermapapikey\n"), 0o644)
	if _, err := Write(starter, Settings("Homelab", []string{"Household"}, []Tab{tab})); err != nil {
		t.Errorf("Homepage's starter settings.yaml: %v", err)
	}
	if !Ours(starter) {
		t.Error("not ours after writing")
	}
}
