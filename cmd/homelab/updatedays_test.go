package main

import (
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/envfile"
	"github.com/Snooper42/homelab-wizard/internal/updates"
)

func TestUpdateWindowLeavesAnAppForItsDays(t *testing.T) {
	fakeDocker(t, []docker.FakeContainer{
		{Name: "paperless", Image: "ghcr.io/paperless-ngx/paperless-ngx:latest", ImageID: "sha256:p1", Running: true, Project: "homelab_paperless", Service: "paperless"},
	})
	root, _ := repoCopy(t)
	today := time.Now().Weekday()
	name := func(d time.Weekday) string { return strings.ToLower(d.String()[:3]) }
	var others []string
	for d := range time.Weekday(7) {
		if d != today {
			others = append(others, name(d))
		}
	}
	daysKept := func() string {
		env, _ := envfile.Load(filepath.Join(root, ".env"))
		return env.Map()[updates.DaysKey]
	}

	// Any day but today: tonight's update leaves it, and says so.
	out, code := homelabCmd(t, root, "", "updates", "days", "paperless", strings.Join(others, "+"))
	if code != 0 || !strings.Contains(out, "by the nightly update on") {
		t.Fatalf("exit %d:\n%s", code, out)
	}
	if got := daysKept(); got != "paperless:"+strings.Join(sorted(others), "+") {
		t.Errorf("%s=%q", updates.DaysKey, got)
	}
	out, _ = homelabCmd(t, root, "", "update", "--all")
	if !strings.Contains(out, "Nothing to update now") || !strings.Contains(out, "Updated on their own days, so not today: Paperless-ngx (") {
		t.Errorf("the plan should leave Paperless for its days:\n%s", out)
	}
	if out, _ = homelabCmd(t, root, "", "updates"); !strings.Contains(out, "On their own days: Paperless") {
		t.Errorf("updates does not list its days:\n%s", out)
	}

	// Today is one of its days: tonight takes it.
	homelabCmd(t, root, "", "updates", "days", "paperless", name(today))
	if out, _ = homelabCmd(t, root, "", "update", "--all"); !strings.Contains(out, "(1 apps): paperless") || strings.Contains(out, "not today") {
		t.Errorf("its day should take it:\n%s", out)
	}
	if out, _ = homelabCmd(t, root, "", "updates", "days", "paperless"); !strings.Contains(out, "only.") {
		t.Errorf("its days are not said:\n%s", out)
	}

	// Every night again; a day that is not one is refused.
	if out, _ = homelabCmd(t, root, "", "updates", "days", "paperless", "every"); !strings.Contains(out, "updated every night") || daysKept() != "" {
		t.Errorf("every night: %q\n%s", daysKept(), out)
	}
	if out, code = homelabCmd(t, root, "", "updates", "days", "paperless", "funday"); code == 0 || !strings.Contains(out, "is not a day") {
		t.Errorf("funday was taken (exit %d):\n%s", code, out)
	}
}

// sorted puts day names as UPDATE_DAYS keeps them: Monday first.
func sorted(names []string) []string {
	days, _ := updates.ParseDays(strings.Join(names, "+"))
	return updates.DayNames(days)
}
