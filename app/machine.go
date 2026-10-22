package main

import (
	"strconv"
	"strings"
	"sync"
)

// machineName is the system's version and the computer's model, for
// Setup's Machine row ("macOS 26.0", "Mac mini (M4)"); either is "" where
// it cannot be read. Read once: it does not change while the app runs.
var machineName = sync.OnceValues(readMachine)

// osRelease reads /etc/os-release: its name and version ("Ubuntu 24.04"),
// or the name alone where there is no version (Arch).
func osRelease(data string) string {
	vals := map[string]string{}
	for _, line := range strings.Split(data, "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), "=")
		if ok {
			vals[k] = strings.Trim(v, `"'`)
		}
	}
	name := vals["NAME"]
	if name == "" {
		return vals["PRETTY_NAME"]
	}
	if v := vals["VERSION_ID"]; v != "" {
		return name + " " + v
	}
	return name
}

// boardNames are what firmware says when the maker left the model blank.
var boardNames = []string{"to be filled by o.e.m.", "system product name", "default string", "not applicable", "none", "o.e.m.", "unknown"}

// modelName tidies a firmware model name: "" for a placeholder, and the
// Steam Deck by name (its firmware says Jupiter or Galileo).
func modelName(s string) string {
	s = strings.TrimSpace(s)
	switch strings.ToLower(s) {
	case "jupiter", "galileo":
		return "Steam Deck"
	}
	for _, b := range boardNames {
		if strings.EqualFold(s, b) {
			return ""
		}
	}
	return s
}

// macModel reads system_profiler SPHardwareDataType: "Mac mini (M4)" from
// its model name and Apple chip, the model name alone on an Intel Mac.
func macModel(out string) string {
	model, chip := "", ""
	for _, line := range strings.Split(out, "\n") {
		k, v, ok := strings.Cut(strings.TrimSpace(line), ":")
		if !ok {
			continue
		}
		switch strings.TrimSpace(k) {
		case "Model Name":
			model = strings.TrimSpace(v)
		case "Chip":
			chip = strings.TrimPrefix(strings.TrimSpace(v), "Apple ")
		}
	}
	if model != "" && chip != "" {
		return model + " (" + chip + ")"
	}
	return model
}

// windowsName is "Windows 11 24H2" from the build number (Windows 11 still
// calls itself Windows 10 in ProductName) and the display version.
func windowsName(build, display string) string {
	name := "Windows 10"
	if n, err := strconv.Atoi(build); err == nil && n >= 22000 {
		name = "Windows 11"
	}
	if display != "" {
		name += " " + display
	}
	return name
}
