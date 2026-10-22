package main

import "os"

func readMachine() (string, string) {
	version := ""
	if data, err := os.ReadFile("/etc/os-release"); err == nil {
		version = osRelease(string(data))
	}
	model := ""
	if data, err := os.ReadFile("/sys/class/dmi/id/product_name"); err == nil {
		model = modelName(string(data))
	}
	return version, model
}
