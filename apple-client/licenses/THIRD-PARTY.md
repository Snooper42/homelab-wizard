# Third-party material in the Apple client

## App logos

`Shared/Assets.xcassets/AppLogos/` holds a logo for each app the homelab
knows, from [homarr-labs/dashboard-icons](https://github.com/homarr-labs/dashboard-icons),
used under the Apache License 2.0 ([dashboard-icons-LICENSE](dashboard-icons-LICENSE)).
`scripts/fetch-app-logos.py` fetched them and changed them: each is
re-encoded as a 180 px PNG, and a logo that isn't a tile of its own is
centred on a white tile.

All product names, trademarks and registered trademarks are the property of
their respective owners. The logos are used only to show which app is which,
and don't imply endorsement.

The homelab companion's logo is the app's own mark (`scripts/make-app-icon.py`).
