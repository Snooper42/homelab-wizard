package main

import (
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"testing"
)

// An alert reaches the household's phones and the computer's Recent alerts
// as it is written: a setting in it is named as Settings shows it, never by
// its code name with a value (usability task 2's re-run, item 17:
// "AUTO_HEAL=false turns this off").
func TestAlertsSayASettingByItsName(t *testing.T) {
	codeName := regexp.MustCompile(`\b[A-Z][A-Z0-9]*_[A-Z0-9_]+=(true|false)\b`)
	files, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	for _, f := range files {
		if strings.HasSuffix(f, "_test.go") {
			continue
		}
		data, err := os.ReadFile(f)
		if err != nil {
			t.Fatal(err)
		}
		for i, line := range strings.Split(string(data), "\n") {
			if strings.Contains(line, "Body:") && codeName.MatchString(line) {
				t.Errorf("%s:%d: an alert names a setting by its code name (%s): say where it is in Settings", f, i+1, codeName.FindString(line))
			}
		}
	}
}
