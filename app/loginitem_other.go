//go:build !darwin

package main

import "errors"

// Login items through SMAppService are the Mac's: elsewhere there is none.
const (
	itemNone             = -1
	itemNotRegistered    = 0
	itemEnabled          = 1
	itemRequiresApproval = 2
	itemNotFound         = 3
)

func loginItemState() int { return itemNone }

func loginItemSet(bool) error { return errors.New("login items are the Mac's") }
