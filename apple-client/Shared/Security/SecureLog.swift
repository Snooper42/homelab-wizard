import Foundation
import os

/// The app's loggers, one per area.
///
/// Logging rules. Review checks these; the compiler can't:
///
/// 1. A device token or pairing code is never interpolated into a log line,
///    not even with `privacy: .private`. Log that one was present, or nothing.
///    The secret types (`PairingCode`, `DeviceCredential`) also print as
///    `<redacted>`, so a slip in a log line or a `print` doesn't leak them.
/// 2. Anything else from the server or the person (hosts, server error text,
///    API payloads, app names) uses `privacy: .private`. Use
///    `.private(mask: .hash)` when matching up lines helps.
/// 3. Only values the app makes itself (HTTP status codes, method names,
///    counts, state names) may use `privacy: .public`.
enum Log {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "com.homelab.client"

    static let security = Logger(subsystem: subsystem, category: "security")
    static let network = Logger(subsystem: subsystem, category: "network")
    static let events = Logger(subsystem: subsystem, category: "events")
    static let ui = Logger(subsystem: subsystem, category: "ui")
}
