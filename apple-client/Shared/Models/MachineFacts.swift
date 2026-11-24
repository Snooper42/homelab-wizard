import Foundation

/// How the computer is, for Status's This Mac card (the `machine` card,
/// `core.MachineFacts` in internal/core/machine.go): the room on the disk
/// that holds the homelab folder, and its power. A computer from before it
/// sends nothing, and the card shows the nightly updates alone.
struct MachineFacts: Sendable, Equatable {
    /// In bytes.
    let free: Int64
    let total: Int64
    /// Under the threshold the computer's disk-space check warns at.
    let low: Bool
    /// "plugged" or "battery"; empty where the computer can't tell.
    let power: String
    /// It keeps itself awake while plugged in (KEEP_AWAKE).
    let keptAwake: Bool

    static func from(_ v: JSONValue?) -> MachineFacts? {
        guard case .number(let total)? = v?["total"], total > 0, case .number(let free)? = v?["free"] else { return nil }
        func flag(_ key: String) -> Bool {
            if case .bool(let b)? = v?[key] { return b }
            return false
        }
        var power = ""
        if case .string(let s)? = v?["power"] { power = s }
        return MachineFacts(free: Int64(free), total: Int64(total), low: flag("low"), power: power, keptAwake: flag("keptAwake"))
    }

    /// "412 GB": the figure, with "free" beside it.
    var freeFigure: String { free.formatted(.byteCount(style: .file)) }

    /// The power in a few words, as the computer's card says it; nil where it can't be told.
    var powerWords: String? {
        switch power {
        case "battery": "On battery"
        case "plugged": keptAwake ? "Plugged in" : "Plugged in, may sleep"
        default: nil
        }
    }

    /// Something on it that needs a look (little room, on battery, or it may sleep).
    var needsALook: Bool { low || power == "battery" || (power == "plugged" && !keptAwake) }
}
