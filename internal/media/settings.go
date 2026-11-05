package media

import (
	"encoding/json"
	"os"
	"path/filepath"
	"strconv"
	"strings"
)

// Inputs are what the engines' settings are made from.
type Inputs struct {
	Root string
	Env  map[string]string // .env over .env.example
	Home string
	// Installed reports whether a catalog app has a container (running or
	// stopped): its address goes in the settings only then.
	Installed func(id string) bool
	// NativeJellyfin: Jellyfin runs as its own program here, seeing this
	// machine's paths as they are.
	NativeJellyfin bool
	// GPU: Tdarr's node can transcode on a graphics card.
	GPU bool
	// Record: what earlier runs set up (Tdarr's library IDs).
	Record Record
	// Python: Python can make a venv here, so beets runs on this machine
	// (faster) rather than in the beets container.
	LocalEngine bool
	// CalibreDir: where Calibre's tools are, when not on PATH (CalibreDir).
	CalibreDir string
}

// Library is the folder for kind: TIDY_<KIND>_LIBRARY, else its folder on
// the media drive, as the apps' compose files mount it.
func Library(env map[string]string, home, kind string) string {
	if v := strings.TrimSpace(env["TIDY_"+strings.ToUpper(kind)+"_LIBRARY"]); v != "" {
		return expand(v, home)
	}
	root := expand(or(env["MEDIA_ROOT"], "/Volumes/Media"), home)
	sub := map[string]string{"music": "music", "books": "Books", "movies": "movies", "tv": "tv", "audiobooks": "audiobooks"}[kind]
	return filepath.Join(root, sub)
}

// InboxFolders are the folders the inbox watches: TIDY_INBOX_FOLDERS
// (separated by ;), else ~/Downloads and the download client's folder.
func InboxFolders(env map[string]string, home string) []string {
	var out []string
	add := func(p string) {
		p = expand(strings.TrimSpace(p), home)
		if p == "" {
			return
		}
		for _, o := range out {
			if strings.EqualFold(filepath.Clean(o), filepath.Clean(p)) {
				return
			}
		}
		out = append(out, p)
	}
	if v := env["TIDY_INBOX_FOLDERS"]; strings.TrimSpace(v) != "" {
		for _, p := range strings.Split(v, ";") {
			add(p)
		}
		return out
	}
	add(filepath.Join(home, "Downloads"))
	add(env["DOWNLOADS_ROOT"])
	return out
}

// Settings is homelab_media.json, as the engines read it.
func Settings(in Inputs) map[string]any {
	env := in.Env
	installed := in.Installed
	if installed == nil {
		installed = func(string) bool { return false }
	}
	lib := func(kind string) string { return Library(env, in.Home, kind) }
	port := func(key, def string) string { return or(env[key], def) }
	mediaRoot := expand(or(env["MEDIA_ROOT"], "/Volumes/Media"), in.Home)
	engine := "container"
	if in.LocalEngine {
		engine = "local"
	}
	if v := env["TIDY_MUSIC_ENGINE"]; v != "" {
		engine = v
	}
	s := map[string]any{
		"reports_dir": ReportsDir(in.Root),
		"music": map[string]any{
			"library": lib("music"), "engine": engine, "pause_containers": "auto",
			"playlists_folder": "Playlists",
			"shrink_lossless":  !off(env["TIDY_SHRINK_LOSSLESS"]),
			"shrink_bitrate":   or(env["TIDY_SHRINK_BITRATE"], "256k"),
		},
		"books": map[string]any{"library": lib("books"), "pause_containers": "auto", "workers": 4,
			"calibre_bin_dir": or(in.CalibreDir, env["CALIBRE_BIN_DIR"])},
		"movies":     map[string]any{"library": lib("movies")},
		"tv":         map[string]any{"library": lib("tv")},
		"audiobooks": map[string]any{"library": lib("audiobooks"), "bitrate": or(env["TIDY_AUDIOBOOK_BITRATE"], "64k")},
		"video":      map[string]any{"keep_languages": list(or(env["TIDY_KEEP_LANGUAGES"], "eng"))},
		"inbox": map[string]any{"folders": InboxFolders(env, in.Home), "settle_minutes": 5,
			"pdf_min_pages": 50},
		"lyrics": map[string]any{"where": or(env["TIDY_LYRICS"], "embed"), "prefer_synced": true,
			"skip_instrumentals": true, "on_new_music": !off(env["TIDY_LYRICS_NEW_MUSIC"])},
		"scrubber": map[string]any{"roots": []string{}},
		"tools":    map[string]any{},
	}
	if installed("tdarr") {
		s["tdarr"] = map[string]any{
			"url":       "http://localhost:" + port("TDARR_PORT", "8265"),
			"codec":     strings.ToLower(or(env["TIDY_VIDEO_CODEC"], "hevc")),
			"gpu":       in.GPU,
			"libraries": in.Record.TdarrLibraries,
			// What Tdarr's container mounts (compose/media-automation.yaml), and
			// nothing else: a films or TV library set elsewhere (TIDY_MOVIES_LIBRARY)
			// isn't in it, and the engines say so rather than hand Tdarr a path it
			// can't open.
			"path_map": [][]string{{filepath.Join(mediaRoot, "movies"), "/media/movies"}, {filepath.Join(mediaRoot, "tv"), "/media/tv"}},
		}
	}
	servers := map[string]any{}
	if installed("navidrome") {
		inside := or(env["NAVIDROME_MUSIC_PATH"], filepath.ToSlash(filepath.Join(mediaRoot, "music")))
		servers["navidrome"] = map[string]any{"url": "http://localhost:" + port("NAVIDROME_PORT", "4533"),
			"kinds": []string{"music"}, "path_map": [][]string{{filepath.Join(mediaRoot, "music"), inside}}}
	}
	if in.NativeJellyfin || installed("jellyfin") {
		servers["jellyfin"] = map[string]any{"url": "http://localhost:" + port("JELLYFIN_PORT", "8096"),
			"kinds": []string{"movies", "tv", "music"}, "path_map": [][]string{}}
	} else if installed("jellyfin-container") {
		servers["jellyfin"] = map[string]any{"url": "http://localhost:" + port("JELLYFIN_PORT", "8096"),
			"kinds":    []string{"movies", "tv"},
			"path_map": [][]string{{filepath.Join(mediaRoot, "movies"), "/media/movies"}, {filepath.Join(mediaRoot, "tv"), "/media/tv"}}}
	}
	if u := strings.TrimSpace(env["PLEX_URL"]); u != "" {
		servers["plex"] = map[string]any{"url": u, "kinds": []string{"movies", "tv", "music"},
			"path_map": pathMap(env["PLEX_PATH_MAP"], in.Home)}
	}
	if installed("audiobookshelf") {
		servers["audiobookshelf"] = map[string]any{"url": "http://localhost:" + port("AUDIOBOOKSHELF_PORT", "13378"),
			"kinds": []string{"audiobooks"}, "path_map": [][]string{{filepath.Join(mediaRoot, "audiobooks"), "/audiobooks"}}}
	}
	s["servers"] = servers
	return s
}

// Write saves the settings where the engines read them (--config).
func Write(root string, s map[string]any) (string, error) {
	path := SettingsPath(root)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}
	if err := os.MkdirAll(ReportsDir(root), 0o755); err != nil {
		return "", err
	}
	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return "", err
	}
	tmp := path + ".tmp"
	if err := os.WriteFile(tmp, append(data, '\n'), 0o644); err != nil {
		return "", err
	}
	return path, os.Rename(tmp, path)
}

// SecretKeys are the .env keys the engines read from their environment
// (never from a command line or the settings file).
var SecretKeys = []string{"JELLYFIN_API_KEY", "NAVIDROME_ADMIN_USER", "NAVIDROME_ADMIN_PASSWORD", "PLEX_TOKEN",
	"AUDIOBOOKSHELF_API_KEY", "TDARR_API_KEY", "TDARR_USER", "TDARR_PASSWORD"}

// Environ is the engines' environment: this one, with their keys from .env.
func Environ(env map[string]string) []string {
	out := os.Environ()
	for _, k := range SecretKeys {
		if v := env[k]; v != "" && !strings.HasPrefix(v, "__") {
			out = append(out, k+"="+v)
		}
	}
	return append(out, "PYTHONIOENCODING=utf-8", "PYTHONUTF8=1")
}

// pathMap reads "host=inside;host2=inside2".
func pathMap(s, home string) [][]string {
	out := [][]string{}
	for _, part := range strings.Split(s, ";") {
		host, inside, ok := strings.Cut(part, "=")
		if ok && strings.TrimSpace(host) != "" {
			out = append(out, []string{expand(strings.TrimSpace(host), home), strings.TrimSpace(inside)})
		}
	}
	return out
}

func list(s string) []string {
	var out []string
	for _, p := range strings.FieldsFunc(s, func(r rune) bool { return r == ',' || r == ' ' || r == ';' }) {
		out = append(out, strings.ToLower(p))
	}
	return out
}

func off(v string) bool {
	b, err := strconv.ParseBool(strings.TrimSpace(v))
	return err == nil && !b
}

func or(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return strings.TrimSpace(v)
}

func expand(p, home string) string {
	if p == "~" {
		return home
	}
	if strings.HasPrefix(p, "~/") || strings.HasPrefix(p, `~\`) {
		return filepath.Join(home, p[2:])
	}
	return p
}
