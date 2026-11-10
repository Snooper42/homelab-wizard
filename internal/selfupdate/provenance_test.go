package selfupdate

import (
	"os"
	"strings"
	"testing"

	"gopkg.in/yaml.v3"
)

// Every job that publishes a release attests its files first (N29), with
// the rights that needs, so an update can be checked against the build
// provenance: the release job alone did, and it runs only for a tag, while
// the releases the app takes come from main.
func TestEveryReleaseIsAttested(t *testing.T) {
	data, err := os.ReadFile("../../.github/workflows/release.yml")
	if err != nil {
		t.Fatal(err)
	}
	var wf struct {
		Jobs map[string]struct {
			Permissions map[string]string `yaml:"permissions"`
			Steps       []struct {
				Uses string `yaml:"uses"`
				Run  string `yaml:"run"`
				With struct {
					SubjectPath string `yaml:"subject-path"`
					Files       string `yaml:"files"`
				} `yaml:"with"`
			} `yaml:"steps"`
		} `yaml:"jobs"`
	}
	if err := yaml.Unmarshal(data, &wf); err != nil {
		t.Fatal(err)
	}
	publishers := 0
	for name, job := range wf.Jobs {
		attested := false
		for _, s := range job.Steps {
			if strings.HasPrefix(s.Uses, "actions/attest-build-provenance@") && s.With.SubjectPath == "dist/*" {
				attested = true
			}
			publishes := strings.Contains(s.Run, "gh release create") || strings.HasPrefix(s.Uses, "softprops/action-gh-release@")
			if !publishes {
				continue
			}
			publishers++
			if !attested {
				t.Errorf("job %s publishes a release before attesting dist/*", name)
			}
		}
		if attested && (job.Permissions["id-token"] != "write" || job.Permissions["attestations"] != "write") {
			t.Errorf("job %s attests without id-token and attestations write: %v", name, job.Permissions)
		}
	}
	if publishers < 2 {
		t.Fatalf("found %d steps that publish a release; the workflow changed shape", publishers)
	}
}
