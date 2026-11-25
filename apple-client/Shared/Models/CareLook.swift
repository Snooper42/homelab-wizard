import Foundation

/// Settings' Automatic Care and Household rows as the redesign's phone
/// picture (phone-settings.png): each care setting its symbol, a short title
/// and one line under it, in the computer's words (Settings › General,
/// web/src/settings/General.tsx); Phones with how many are paired and which
/// only look.
enum CareLook {
    struct Row: Equatable, Sendable {
        let title: String
        let symbol: String
        /// A `TileColour` by name: green, blue, orange, indigo, red.
        let tint: String
        let subtitle: String?
    }

    /// The row for one of the first settings (`HomelabSettingsForm.firstKeys`); nil for any other.
    static func row(_ key: String, value: String) -> Row? {
        switch key {
        case "AUTO_HEAL": Row(title: "Restart an app that stops answering", symbol: "waveform.path.ecg", tint: "blue", subtitle: "Checked every 15 minutes")
        case "AUTO_ROLLBACK": Row(title: "Undo an update that breaks an app", symbol: "clock.arrow.circlepath", tint: "orange", subtitle: "Puts the version before back by itself")
        case "QUIET_HOURS": Row(title: "Quiet hours", symbol: "moon.fill", tint: "indigo", subtitle: quietWords(value))
        case "DESKTOP_ALERTS": Row(title: "Alerts on the computer's screen", symbol: "bell.badge.fill", tint: "red", subtitle: nil)
        default: nil
        }
    }

    /// "10 PM – 7 AM" from "22-7", as the computer's `quietWords`; "Off" when empty, the value as typed otherwise.
    static func quietWords(_ value: String) -> String {
        let v = value.trimmingCharacters(in: .whitespaces)
        let parts = v.split(separator: "-", omittingEmptySubsequences: false)
        guard parts.count == 2, parts.allSatisfy({ (1...2).contains($0.count) && $0.allSatisfy { ("0"..."9").contains($0) } }),
              let from = Int(parts[0]), let to = Int(parts[1])
        else { return v.isEmpty ? "Off" : v }
        func hour(_ n: Int) -> String { "\(n % 12 == 0 ? 12 : n % 12) \(n < 12 ? "AM" : "PM")" }
        return "\(hour(from)) – \(hour(to))"
    }

    /// "2 paired · Jordan's looks only", "4 paired · 2 look only", "1 paired"; nil before they're read.
    static func phones(_ phones: [PairedPhone]?) -> String? {
        guard let phones else { return nil }
        guard !phones.isEmpty else { return "None paired yet" }
        let lookers = phones.filter { !$0.canChange }
        var parts = ["\(phones.count) paired"]
        if lookers.count == 1 {
            let one = lookers[0]
            parts.append("\(one.personName.map { "\($0)'s" } ?? one.name) looks only")
        } else if lookers.count > 1 {
            parts.append("\(lookers.count) look only")
        }
        return parts.joined(separator: " · ")
    }
}
