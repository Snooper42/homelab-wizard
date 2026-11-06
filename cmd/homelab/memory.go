package main

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/detect"
	"github.com/Snooper42/homelab-wizard/internal/docker"
	"github.com/Snooper42/homelab-wizard/internal/health"
	"github.com/Snooper42/homelab-wizard/internal/notify"
)

// memoryNow measures the apps' memory against what Docker has (its
// engine's total: the whole machine on Linux, Docker Desktop's share on a
// Mac or Windows), each container counted to the app it belongs to. ok is
// false when it could not be read; the watchdog then leaves the last
// measure as it was.
func memoryNow(ctx context.Context, client *docker.Client, report *detect.Report) (m health.Memory, ok bool) {
	info, err := client.Info(ctx)
	if err != nil || info.MemTotal <= 0 {
		return m, false
	}
	stats, err := client.Stats(ctx)
	if err != nil {
		return m, false
	}
	return appsMemory(stats, report, info.MemTotal), true
}

// appsMemory adds up docker stats' memory, by app: a container the catalog
// knows counts to its app (with its id, for Stop), any other to its own
// name.
func appsMemory(stats []docker.Stat, report *detect.Report, total int64) health.Memory {
	type owner struct{ id, name string }
	of := map[string]owner{}
	if report != nil {
		for _, m := range report.Summary() {
			of[m.Container.Name] = owner{m.App.ID, m.App.Name()}
		}
	}
	m := health.Memory{Total: total}
	byApp := map[string]*health.AppMemory{}
	var order []string
	for _, s := range stats {
		used, _, _ := strings.Cut(s.Mem, "/")
		n := int64(parseSize(used))
		m.Used += n
		o, known := of[s.Name]
		if !known {
			o = owner{"", s.Name}
		}
		key := o.id + "\x00" + o.name
		if byApp[key] == nil {
			byApp[key] = &health.AppMemory{ID: o.id, Name: o.name}
			order = append(order, key)
		}
		byApp[key].Bytes += n
	}
	for _, k := range order {
		m.Biggest = append(m.Biggest, *byApp[k])
	}
	sort.SliceStable(m.Biggest, func(i, j int) bool { return m.Biggest[i].Bytes > m.Biggest[j].Bytes })
	if len(m.Biggest) > 3 {
		m.Biggest = m.Biggest[:3]
	}
	return m
}

// gb says a size the way the alert does: 2.1 GB, 900 MB.
func gb(n int64) string {
	if n >= 1<<30 {
		return fmt.Sprintf("%.1f GB", float64(n)/(1<<30))
	}
	return fmt.Sprintf("%d MB", n/(1<<20))
}

// memoryAlert is the alert once the apps' memory has stayed high: how
// much, for how long, the biggest apps, and how to stop one.
func memoryAlert(m health.Memory, now time.Time) notify.Message {
	var names []string
	for _, a := range m.Biggest {
		names = append(names, a.Name+" "+gb(a.Bytes))
	}
	mins := int(now.Sub(m.Since).Round(time.Minute) / time.Minute)
	body := fmt.Sprintf("The apps have used %d%% of the %s of memory Docker has for %d minutes, so the computer may slow down or Docker may stop an app.", percent(m), gb(m.Total), mins)
	if len(names) > 0 {
		body += " The biggest: " + strings.Join(names, ", ") + "."
	}
	body += "\nStop one you don't need now from Status"
	if len(m.Biggest) > 0 && m.Biggest[0].ID != "" {
		body += " (or homelab stop " + m.Biggest[0].ID + ")"
	}
	body += "."
	return notify.Message{Title: "Homelab: memory nearly full", Body: body, Priority: 4, Tags: []string{"warning"}}
}

// memoryBack is the alert when it has come down again.
func memoryBack(m health.Memory) notify.Message {
	return notify.Message{Title: "Homelab: memory is back to normal", Body: fmt.Sprintf("The apps use %d%% of the memory Docker has now.", percent(m)), Tags: []string{"white_check_mark"}}
}

func percent(m health.Memory) int {
	if m.Total <= 0 {
		return 0
	}
	return int(float64(m.Used)*100/float64(m.Total) + 0.5)
}
