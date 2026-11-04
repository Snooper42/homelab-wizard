package main

// homelab media install ffmpeg: Tidy Up's Install button. Without --yes (or
// --apply) it says what it would fetch, from whom, and how big; with it, it
// fetches the pinned build into ~/.homelab-media/bin (internal/media/fetch.go).

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os/exec"
	"runtime"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/procattr"
)

// What install fetches, and with what: tests replace them.
var (
	mediaPin    = func() (media.Pin, bool) { return media.FFmpegPin(runtime.GOOS, runtime.GOARCH) }
	mediaClient = &http.Client{Timeout: 30 * time.Minute}
	mediaWorks  = func(ctx context.Context, ffmpeg string) error {
		ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
		defer cancel()
		out, err := procattr.Hide(exec.CommandContext(ctx, ffmpeg, "-version")).CombinedOutput()
		if err != nil {
			return fmt.Errorf("%v %s", err, firstLine(string(out)))
		}
		return nil
	}
)

func (h *homelab) mediaInstall(ctx context.Context, args []string) error {
	if len(args) == 0 || args[0] != "ffmpeg" {
		return errors.New("homelab media install ffmpeg [--yes]: the only one it fetches is ffmpeg (with ffprobe)")
	}
	f := parseMediaFlags(args[1:])
	say := func(typ, text string, kv ...any) {
		if !f.events {
			switch typ {
			case "ok":
				h.ui.OK("%s", text)
			case "step", "info":
				h.ui.Info("%s", text)
			}
			return
		}
		ev := map[string]any{"type": typ, "text": text}
		for i := 0; i+1 < len(kv); i += 2 {
			ev[kv[i].(string)] = kv[i+1]
		}
		line, _ := json.Marshal(ev)
		fmt.Fprintln(h.ui.Out, string(line))
	}
	pin, ok := mediaPin()
	if !ok {
		return fmt.Errorf("no ffmpeg build is pinned for %s/%s: install it yourself (%s)", runtime.GOOS, runtime.GOARCH, "homelab media preflight says how")
	}
	mb := (pin.Size() + (1 << 19)) >> 20
	what := fmt.Sprintf("ffmpeg %s from %s (about %d MB, %s)", pin.Version, pin.Source, mb, pin.Licence)
	if !f.yes && !f.apply {
		h.ui.Info("Install would fetch %s into %s, checked against its pinned SHA-256 before it runs.", what, media.BinDir(homeDir()))
		return errPreview
	}
	say("step", "Downloading "+what, "n", 1, "total", 2)
	last := time.Time{}
	err := media.Fetch(ctx, homeDir(), runtime.GOOS, pin, media.FetchOptions{
		Client: mediaClient,
		Works:  mediaWorks,
		Progress: func(done, total int64) {
			// About four times a second: enough for the bar, few lines.
			if f.events && (time.Since(last) > 250*time.Millisecond || done == total) {
				last = time.Now()
				say("progress", "", "label", "MB", "done", done>>20, "total", max(total>>20, 1))
			}
		},
	})
	if err != nil {
		return err
	}
	say("step", "Checked, and it runs", "n", 2, "total", 2)
	say("ok", fmt.Sprintf("ffmpeg %s is ready: Tidy Up uses it from now on", pin.Version))
	return nil
}

func firstLine(s string) string {
	for i, r := range s {
		if r == '\n' {
			return s[:i]
		}
	}
	return s
}
