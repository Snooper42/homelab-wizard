package main

import "golang.org/x/sys/windows/registry"

func readMachine() (string, string) {
	version, model := "", ""
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, `SOFTWARE\Microsoft\Windows NT\CurrentVersion`, registry.QUERY_VALUE); err == nil {
		build, _, _ := k.GetStringValue("CurrentBuildNumber")
		display, _, _ := k.GetStringValue("DisplayVersion")
		k.Close()
		if build != "" {
			version = windowsName(build, display)
		}
	}
	if k, err := registry.OpenKey(registry.LOCAL_MACHINE, `HARDWARE\DESCRIPTION\System\BIOS`, registry.QUERY_VALUE); err == nil {
		name, _, _ := k.GetStringValue("SystemProductName")
		k.Close()
		model = modelName(name)
	}
	return version, model
}
