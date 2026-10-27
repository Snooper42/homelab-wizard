package backup

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// ImagesFolder holds, beside the dumps in recovery-staging/databases, the
// images the apps ran at each backup, so a restore or a move starts the
// versions that wrote the data before it offers the updates. It goes off
// site with the dumps (Duplicati's Homelab Databases job, Kopia's
// /staging/databases) and in a move's bundle.
const ImagesFolder = "images"

// AppImage is the image one app ran at a backup.
type AppImage struct {
	// Ref is the image as its compose file named it, after .env's
	// values: binwiederhier/ntfy:latest.
	Ref     string `json:"ref"`
	ImageID string `json:"imageId"`
	// Digest pulls that same image again from its registry
	// (binwiederhier/ntfy@sha256:…); empty for an image built here.
	Digest string `json:"digest,omitempty"`
}

// Images are the images every running app ran at one backup.
type Images struct {
	Made time.Time           `json:"made"`
	Apps map[string]AppImage `json:"apps"`
}

// SaveImages writes the record into dir as images-YYYYMMDD-HHMMSS.json, a
// name Rotate keeps the newest of like the dumps, and returns its path.
func SaveImages(dir string, im Images) (string, error) {
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", err
	}
	data, err := json.MarshalIndent(im, "", "  ")
	if err != nil {
		return "", err
	}
	path := filepath.Join(dir, fmt.Sprintf("%s-%s.json", ImagesFolder, im.Made.Format("20060102-150405")))
	return path, os.WriteFile(path, append(data, '\n'), 0o600)
}

// LoadImages reads a record SaveImages wrote.
func LoadImages(path string) (Images, error) {
	var im Images
	data, err := os.ReadFile(path)
	if err == nil {
		err = json.Unmarshal(data, &im)
	}
	return im, err
}

// RepoDigest picks, from an image's repository digests (docker image
// inspect's RepoDigests), the one for ref's repository: what pulls that
// image again. An image pulled by digest already is its own.
func RepoDigest(ref string, repoDigests []string) string {
	if strings.Contains(ref, "@sha256:") {
		return ref
	}
	want := repository(ref)
	for _, d := range repoDigests {
		repo, sum, ok := strings.Cut(d, "@")
		if ok && strings.HasPrefix(sum, "sha256:") && repository(repo) == want {
			return d
		}
	}
	return ""
}

// repository is a reference without its tag, in Docker Hub's short form:
// docker.io/library/postgres:16 and postgres both are postgres.
func repository(ref string) string {
	ref, _, _ = strings.Cut(ref, "@")
	if i := strings.LastIndex(ref, ":"); i > strings.LastIndex(ref, "/") {
		ref = ref[:i]
	}
	for _, p := range []string{"docker.io/", "index.docker.io/", "registry-1.docker.io/"} {
		ref = strings.TrimPrefix(ref, p)
	}
	return strings.TrimPrefix(ref, "library/")
}
