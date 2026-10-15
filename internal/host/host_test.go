package host

import "testing"

func TestEveryProfileHasItsHints(t *testing.T) {
	for _, goos := range []string{"darwin", "linux", "windows", "plan9"} {
		p := For(goos)
		for name, v := range map[string]string{"Runtime": p.Runtime, "InstallRuntime": p.InstallRuntime, "StartRuntime": p.StartRuntime, "UpdateRuntime": p.UpdateRuntime, "MoreMemory": p.MoreMemory, "InstallOllama": p.InstallOllama} {
			if v == "" {
				t.Errorf("%s: %s is empty", goos, name)
			}
		}
		if supported := goos != "plan9"; p.Supported != supported || (supported && p.Scheduler == "") {
			t.Errorf("%s: supported %v, scheduler %q", goos, p.Supported, p.Scheduler)
		}
	}
}
