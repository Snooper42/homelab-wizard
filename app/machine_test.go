package main

import "testing"

func TestMachineNames(t *testing.T) {
	if got := osRelease("NAME=\"Ubuntu\"\nVERSION_ID=\"24.04\"\nPRETTY_NAME=\"Ubuntu 24.04.5 LTS\"\n"); got != "Ubuntu 24.04" {
		t.Errorf("ubuntu: %q", got)
	}
	if got := osRelease("NAME=\"Arch Linux\"\nPRETTY_NAME=\"Arch Linux\"\n"); got != "Arch Linux" {
		t.Errorf("arch: %q", got)
	}
	if got := osRelease("NAME=\"SteamOS\"\nVERSION_ID=3.6\n"); got != "SteamOS 3.6" {
		t.Errorf("steamos: %q", got)
	}
	for in, want := range map[string]string{"Jupiter\n": "Steam Deck", "To Be Filled By O.E.M.": "", "ThinkPad X1 Carbon Gen 11": "ThinkPad X1 Carbon Gen 11"} {
		if got := modelName(in); got != want {
			t.Errorf("model %q: %q", in, got)
		}
	}
	mac := "Hardware:\n\n    Hardware Overview:\n\n      Model Name: Mac mini\n      Model Identifier: Mac16,10\n      Chip: Apple M4\n"
	if got := macModel(mac); got != "Mac mini (M4)" {
		t.Errorf("mac: %q", got)
	}
	if got := macModel("      Model Name: MacBook Pro\n      Processor Name: Quad-Core Intel Core i7\n"); got != "MacBook Pro" {
		t.Errorf("intel mac: %q", got)
	}
	if got := windowsName("26100", "24H2"); got != "Windows 11 24H2" {
		t.Errorf("win11: %q", got)
	}
	if got := windowsName("19045", "22H2"); got != "Windows 10 22H2" {
		t.Errorf("win10: %q", got)
	}
}
