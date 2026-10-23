package main

import (
	"os"
	"path/filepath"
	"testing"
)

func TestExampleValue(t *testing.T) {
	root := t.TempDir()
	if err := os.WriteFile(filepath.Join(root, ".env.example"), []byte("# Jellyfin\nJELLYFIN_DATA_DIR=~/.local/share/jellyfin\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if got := exampleValue(root, "JELLYFIN_DATA_DIR"); got != "~/.local/share/jellyfin" {
		t.Errorf("JELLYFIN_DATA_DIR = %q", got)
	}
	if got := exampleValue(root, "MISSING"); got != "" {
		t.Errorf("MISSING = %q", got)
	}
	if got := exampleValue(t.TempDir(), "JELLYFIN_DATA_DIR"); got != "" {
		t.Errorf("without .env.example: %q", got)
	}
}

func TestLoginNameWithoutUSER(t *testing.T) {
	t.Setenv("USER", "")
	if loginName() == "" {
		t.Error("loginName is empty when USER is unset")
	}
	t.Setenv("USER", "sam")
	if got := loginName(); got != "sam" {
		t.Errorf("loginName = %q", got)
	}
}
