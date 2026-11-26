package appdata

import "os"

// keepOwner: Windows keeps no owner the containers read (Docker Desktop maps them).
func keepOwner(string, os.FileInfo) {}
