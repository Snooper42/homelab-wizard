# Security policy

Homelab Wizard runs a household's passwords, photos, documents, and money on a computer at home, so a security hole matters. Thank you for taking the time to report one.

## Reporting a problem

Please don't open a public issue. Report it privately instead: on this repository's **Security** tab, choose **Report a vulnerability**. If you don't see that button, open an issue that says only that you have a security report to share (no details), and you'll be given a private way to send it.

A useful report says what can reach what: who the attacker is (someone on the internet, a phone that was paired, someone on the home Wi-Fi), what they send, and what they get. Steps or a test that shows it help most.

## What is supported

The newest release only. The app updates itself, and the homelab files move forward with it (**Update now**, or `./homelab upgrade`), so a fix reaches every install through the normal update.

## What has been looked at

[docs/Security.md](docs/Security.md) has the security posture: what is reachable from where by default (nothing from the internet unless you choose it), how secrets and backups are kept, and every finding from the reviews of the app's own code, each with its fix and the test that shows it. CI runs `govulncheck`, `gosec`, and `npm audit` on every change.
