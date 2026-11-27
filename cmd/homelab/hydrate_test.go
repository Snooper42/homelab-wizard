package main

import (
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// ISSUE-0003: on a new Mac, Proton Drive has synced the backup folder as
// placeholders. The rebuild reads each one through the Mac first, so the
// restore inside Docker sees whole files, and says how many it fetched.
func TestRebuildDownloadsTheCloudDrivesPlaceholdersFirst(t *testing.T) {
	fakeDocker(t, nil)
	fakeSystemctl(t)
	was := datalessFile
	t.Cleanup(func() { datalessFile = was })
	var seen []string
	datalessFile = func(fi fs.FileInfo) bool {
		if strings.HasSuffix(fi.Name(), ".dlist.zip.aes") {
			seen = append(seen, fi.Name())
			return true
		}
		return false
	}
	src, _ := repoCopy(t)
	env, err := os.ReadFile(filepath.Join(src, ".env"))
	if err != nil {
		t.Fatal(err)
	}
	folder := t.TempDir()
	backupJob(t, folder, "secrets", "sesame", map[string]string{"homelab.env": string(env) + "\nDUPLICATI_PASSPHRASE=open-the-rest\n"})
	fresh, _ := repoCopy(t)
	_ = os.Remove(filepath.Join(fresh, ".env"))
	t.Setenv("DUPLICATI_SECRETS_PASSPHRASE", "sesame")
	out, _ := homelabCmd(t, fresh, "", "rebuild", folder, "--apply")
	fetched, restored := strings.Index(out, "downloaded 1 file(s) of "+filepath.Join(folder, "secrets")), strings.Index(out, ".env and the household's records restored")
	if fetched < 0 || restored < fetched {
		t.Fatalf("the placeholders fetched before the restore:\n%s", out)
	}
	if len(seen) == 0 {
		t.Error("no file was looked at")
	}
}
