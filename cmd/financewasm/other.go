//go:build !(js && wasm)

// Built for anything but WebAssembly, it only says what it is for.
package main

import (
	"fmt"
	"os"
)

func main() {
	fmt.Fprintln(os.Stderr, "financewasm is built for the phone's web page: GOOS=js GOARCH=wasm go build ./cmd/financewasm")
	os.Exit(2)
}
