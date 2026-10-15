package schedule

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestUnits(t *testing.T) {
	backup := Job{Label: "com.homelab.backup", Description: "dump databases", Args: []string{"backup", "--apply"}, Daily: true, Hour: 4, Minute: 30}
	service, timer := backup.Units("/opt/homelab/bin/homelab", "/home/me/Home Lab", "/home/me/Home Lab/logs", "/usr/bin:/bin")
	for _, want := range []string{
		"Type=oneshot",
		`ExecStart="/opt/homelab/bin/homelab" "--root" "/home/me/Home Lab" "--no-color" "backup" "--apply"`,
		`Environment="PATH=/usr/bin:/bin"`,
		"WorkingDirectory=/home/me/Home Lab\n",
		"StandardOutput=append:/home/me/Home Lab/logs/backup.log",
	} {
		if !strings.Contains(string(service), want) {
			t.Errorf("service is missing %q:\n%s", want, service)
		}
	}
	if !strings.Contains(string(timer), "OnCalendar=*-*-* 04:30:00") || !strings.Contains(string(timer), "WantedBy=timers.target") {
		t.Errorf("timer:\n%s", timer)
	}
	startup := Job{Label: "com.homelab.startup", Args: []string{"up"}, RunAtLoad: true}
	if service, timer := startup.Units("/b", "/r", "/l", "/p"); timer != nil || !strings.Contains(string(service), "WantedBy=default.target") {
		t.Errorf("startup service:\n%s\ntimer: %s", service, timer)
	}
	watchdog := Job{Label: "com.homelab.watchdog", Args: []string{"watchdog"}, Interval: 900}
	if _, timer := watchdog.Units("/b", "/r", "/l", "/p"); !strings.Contains(string(timer), "OnUnitActiveSec=900s") {
		t.Errorf("watchdog timer:\n%s", timer)
	}
}

func TestSystemd(t *testing.T) {
	var calls []string
	enabled := map[string]bool{}
	s := Systemd{Dir: t.TempDir(), Run: func(args ...string) ([]byte, error) {
		calls = append(calls, strings.Join(args, " "))
		switch args[0] {
		case "enable":
			enabled[args[2]] = true
		case "is-enabled":
			if enabled[args[1]] {
				return []byte("enabled\n"), nil
			}
			return []byte("disabled\n"), os.ErrNotExist
		case "show":
			return []byte("ActiveState=inactive\nExecMainStatus=0\nExecMainStartTimestampMonotonic=123\n"), nil
		}
		return nil, nil
	}}
	j := Job{Label: "com.homelab.watchdog", Args: []string{"watchdog"}, Interval: 900}
	if st := s.Status(j.Label); st.Installed || st.Loaded {
		t.Fatalf("before install: %+v", st)
	}
	if err := s.InstallJob(j, "/b", "/r", "/l", "/p"); err != nil {
		t.Fatal(err)
	}
	st := s.Status(j.Label)
	if !st.Installed || !st.Loaded || st.LastExit != "0" || st.State != "inactive" {
		t.Fatalf("after install: %+v", st)
	}
	if err := s.Remove(j.Label); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(s.Dir, "homelab-watchdog.timer")); !os.IsNotExist(err) {
		t.Fatalf("timer was not removed: %v", err)
	}
	if got := strings.Join(calls, "; "); !strings.Contains(got, "enable --now homelab-watchdog.timer") || !strings.Contains(got, "disable --now homelab-watchdog.timer") {
		t.Fatalf("calls: %s", got)
	}
}
