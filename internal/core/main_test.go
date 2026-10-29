package core

import (
	"os"
	"testing"
)

// The tests' stand-in docker answers every read, never a real engine's
// socket (a CI runner has one).
func TestMain(m *testing.M) {
	os.Setenv("DOCKER_API", "off")
	os.Exit(m.Run())
}
