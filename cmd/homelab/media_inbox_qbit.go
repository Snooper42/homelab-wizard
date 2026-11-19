package main

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strings"
	"time"

	"github.com/Snooper42/homelab-wizard/internal/media"
	"github.com/Snooper42/homelab-wizard/internal/wiring"
)

// The inbox and qBittorrent agree (arr-loop item 0; the owner, Nov 19,
// 2026: disk space first, one copy of every download). Before the inbox
// sweeps, qBittorrent is asked which torrents it still has in hand, and the
// inbox leaves those where they are: filed while qBittorrent still shares
// one, it would show Missing files; filed while one downloads, it would be
// filed half-done. Once a torrent is finished and stopped (wire sets a
// share limit of 0, then Stop), or gone, it is filed: moved once.

// torrentHold is one torrent the inbox waits for, at its path on this
// machine, and why, in the words its card shows.
type torrentHold struct {
	Path string `json:"path"`
	Why  string `json:"why"`
}

// torrentHolds is what the inbox reads (HOMELAB_MEDIA_TORRENTS). Unread,
// when set, holds qBittorrent's whole folder: it is up, and couldn't be
// asked, so nothing in it is taken for finished.
type torrentHolds struct {
	Held   []torrentHold `json:"held"`
	Unread *struct {
		Root string `json:"root"`
		Why  string `json:"why"`
	} `json:"unread"`
}

// qbitDownloadsInside is where qBittorrent's container sees the downloads
// folder (compose/media-automation.yaml).
const qbitDownloadsInside = "/downloads"

// downloadsRoot is DOWNLOADS_ROOT on this machine, read as the compose
// files read it: ~/ from home, a relative path from the homelab folder, and
// the compose file's own default when unset.
func downloadsRoot(env map[string]string, root, home string) string {
	p := strings.TrimSpace(env["DOWNLOADS_ROOT"])
	switch {
	case p == "":
		p = "/Volumes/Media/downloads"
	case p == "~" || strings.HasPrefix(p, "~/"):
		p = filepath.Join(home, strings.TrimPrefix(strings.TrimPrefix(p, "~"), "/"))
	case !filepath.IsAbs(p) && !strings.HasPrefix(p, "/"):
		p = filepath.Join(root, p)
	}
	return filepath.Clean(filepath.FromSlash(p))
}

// inboxTorrentHolds asks qBittorrent (running, at a.URL) which torrents the
// inbox must leave alone.
func inboxTorrentHolds(ctx context.Context, a wiring.App, env map[string]string, root, home string) torrentHolds {
	dl := downloadsRoot(env, root, home)
	client := &http.Client{Timeout: 10 * time.Second}
	torrents, err := qbitList(ctx, client, qbitURL(a, env), env)
	var out torrentHolds
	if err != nil {
		why := fmt.Sprintf("waiting: qBittorrent couldn't be read (%v), so its downloads stay put until it can", err)
		if errors.Is(err, errNoQbitPassword) {
			why = "waiting: qBittorrent couldn't be read without its password (QBITTORRENT_PASSWORD in Settings), so its downloads stay put"
		}
		out.Unread = &struct {
			Root string `json:"root"`
			Why  string `json:"why"`
		}{dl, why}
		return out
	}
	for _, t := range torrents {
		inside := path.Clean(t.ContentPath)
		rel, ok := strings.CutPrefix(inside, qbitDownloadsInside+"/")
		if !ok || rel == "" || strings.HasPrefix(rel, "../") {
			continue // not in the downloads folder: not the inbox's
		}
		var why string
		switch {
		case t.Progress < 1:
			why = "still downloading in qBittorrent"
		case !t.stopped():
			why = "qBittorrent is still sharing it"
		default:
			continue // finished and stopped: the inbox's to file
		}
		out.Held = append(out.Held, torrentHold{Path: filepath.Join(dl, filepath.FromSlash(rel)), Why: why})
	}
	return out
}

// writeTorrentHolds writes what the inbox waits for where it reads it; with
// qBittorrent not running (qbit nil) nothing is being written, and the file
// goes.
func writeTorrentHolds(ctx context.Context, root string, env map[string]string, home string, qbit *wiring.App) error {
	p := media.TorrentsPath(root)
	if qbit == nil {
		if err := os.Remove(p); err != nil && !os.IsNotExist(err) {
			return err
		}
		return nil
	}
	data, err := json.Marshal(inboxTorrentHolds(ctx, *qbit, env, root, home))
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(p), 0o755); err != nil {
		return err
	}
	return os.WriteFile(p, data, 0o644)
}

// inboxTorrents is writeTorrentHolds with qBittorrent as Docker sees it now.
// Docker unread: as if qBittorrent weren't running (the inbox then files as
// before, on what the files themselves say).
func (h *homelab) inboxTorrents(ctx context.Context, env map[string]string) error {
	var qbit *wiring.App
	if apps, _, err := h.arrRunning(ctx); err == nil {
		if a, ok := apps["qbittorrent"]; ok {
			qbit = &a
		}
	}
	return writeTorrentHolds(ctx, h.root, env, homeDir(), qbit)
}
