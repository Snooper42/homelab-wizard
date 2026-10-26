package main

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestCoverageAgainstFloors(t *testing.T) {
	dir := t.TempDir()
	profile := filepath.Join(dir, "cover.out")
	// a/x.go: 3 of 4 statements run; b/y.go: none of 2; one block listed twice.
	_ = os.WriteFile(profile, []byte("mode: set\nm/a/x.go:1.1,2.2 3 1\nm/a/x.go:3.1,4.2 1 0\nm/a/x.go:3.1,4.2 1 0\nm/b/y.go:1.1,2.2 2 0\n"), 0o644)
	got, err := coverage(profile)
	if err != nil {
		t.Fatal(err)
	}
	if got["m/a"] != 75 || got["m/b"] != 0 {
		t.Fatalf("coverage %v", got)
	}
	floorsFile := filepath.Join(dir, "floors.txt")
	_ = os.WriteFile(floorsFile, []byte("# comment\nm/a 70  # target 80\nm/b 1\nm/c 0\n"), 0o644)
	floors, err := readFloors(floorsFile)
	if err != nil {
		t.Fatal(err)
	}
	var out strings.Builder
	if n := check(got, floors, &out); n != 1 || !strings.Contains(out.String(), "LOW  m/b") || !strings.Contains(out.String(), "ok   m/a") {
		t.Errorf("%d below:\n%s", n, out.String())
	}
	if _, err := readFloors(writeFile(t, dir, "bad.txt", "m/a seventy\n")); err == nil {
		t.Error("a floor that is not a number")
	}
}

func writeFile(t *testing.T, dir, name, s string) string {
	p := filepath.Join(dir, name)
	if err := os.WriteFile(p, []byte(s), 0o644); err != nil {
		t.Fatal(err)
	}
	return p
}
