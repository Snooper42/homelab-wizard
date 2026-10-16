package api_test

import (
	"encoding/json"
	"os"
	"reflect"
	"sort"
	"strings"
	"testing"

	"github.com/Snooper42/homelab-wizard/internal/api"
	"github.com/Snooper42/homelab-wizard/internal/install"
	"github.com/Snooper42/homelab-wizard/internal/setup"
)

// contract is every JSON type the app and the phone read, by name.
var contract = map[string]any{
	"Catalog": api.Catalog{}, "Category": api.Category{}, "App": api.App{}, "Preset": api.Preset{},
	"Plan": api.Plan{}, "Skip": api.Skip{}, "PortChange": api.PortChange{}, "EnvChange": api.EnvChange{},
	"Started": api.Started{}, "Status": api.Status{}, "AppStatus": api.AppStatus{},
	"setup.Step": setup.Step{}, "install.Event": install.Event{},
}

// fields are a struct's JSON field names, embedded structs flattened.
func fields(t reflect.Type) []string {
	var out []string
	for i := 0; i < t.NumField(); i++ {
		f := t.Field(i)
		if !f.IsExported() {
			continue
		}
		name, _, _ := strings.Cut(f.Tag.Get("json"), ",")
		if name == "-" {
			continue
		}
		if f.Anonymous && name == "" && f.Type.Kind() == reflect.Struct {
			out = append(out, fields(f.Type)...)
			continue
		}
		if name == "" {
			name = f.Name
		}
		out = append(out, name)
	}
	sort.Strings(out)
	return out
}

// TestJSONContract fails when a field the app or the phone may read
// disappears or is renamed: that breaks clients, so it needs a new
// --json schema number (cmd/homelab jsonSchema) and a note in Commands.md.
// New fields are fine: add them with UPDATE_CONTRACT=1 go test ./internal/api.
func TestJSONContract(t *testing.T) {
	now := map[string][]string{}
	for name, v := range contract {
		now[name] = fields(reflect.TypeOf(v))
	}
	const path = "testdata/contract.json"
	if os.Getenv("UPDATE_CONTRACT") != "" {
		b, _ := json.MarshalIndent(now, "", "  ")
		if err := os.WriteFile(path, append(b, '\n'), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	b, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	var was map[string][]string
	if err := json.Unmarshal(b, &was); err != nil {
		t.Fatal(err)
	}
	for name, list := range was {
		has := map[string]bool{}
		for _, f := range now[name] {
			has[f] = true
		}
		for _, f := range list {
			if !has[f] {
				t.Errorf("%s lost its %q field, which clients of --json may read: bump jsonSchema and say so in docs/Commands.md, then UPDATE_CONTRACT=1", name, f)
			}
		}
	}
}
