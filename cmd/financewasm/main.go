//go:build js && wasm

// Command financewasm is Finances' projection as WebAssembly, for the
// phone's web page when a household member keeps her Finances sealed
// (mobile/finance). It sets globalThis.homelabFinance.project(plan,
// ledger, today), which takes the plan's and the ledger's JSON and the
// phone's day, and returns {view} (the finance.View, as JSON) or {error}.
package main

import (
	"syscall/js"

	"github.com/Snooper42/homelab-wizard/mobile/finance"
)

func main() {
	project := js.FuncOf(func(_ js.Value, args []js.Value) any {
		if len(args) != 3 {
			return map[string]any{"error": "project takes the plan, the ledger and today"}
		}
		out, err := finance.Project([]byte(args[0].String()), []byte(args[1].String()), args[2].String())
		if err != nil {
			return map[string]any{"error": err.Error()}
		}
		return map[string]any{"view": string(out)}
	})
	js.Global().Set("homelabFinance", map[string]any{"project": project})
	select {}
}
