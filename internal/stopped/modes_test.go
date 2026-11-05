package stopped

import "runtime"

// runtimeHasModes: Windows keeps no Unix file modes to check.
var runtimeHasModes = runtime.GOOS != "windows"
