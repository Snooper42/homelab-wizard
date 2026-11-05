import Foundation

/// What happened overnight: Status's first line in the morning (5 AM to
/// noon), about the night since 8 PM, as the computer words it
/// (web/src/status/Overnight.tsx). For example: "Overnight: 4 apps
/// updated, 1 rolled back, a backup of 2.1 GB, nothing needed you."
/// Built only from what the app already has: each app's update, the
/// alerts, the night's database copies, and the watchdog's outages.
enum Overnight {
    struct Night {
        var now: Date
        var apps: [AppStatus]
        var events: [AlertEvent]
        /// The watchdog's outages, by app id.
        var outages: [String: [WatchdogOutage]]
        /// The backup copies. Nil while not read.
        var copies: [BackupCopy]?
        /// The watchdog was read: only then can it say nothing needed you.
        var watched: Bool
    }

    /// 8 PM yesterday until now. Nil outside the morning.
    static func night(of now: Date, calendar: Calendar = .current) -> ClosedRange<Date>? {
        let hour = calendar.component(.hour, from: now)
        guard hour >= 5, hour < 12,
              let yesterday = calendar.date(byAdding: .day, value: -1, to: calendar.startOfDay(for: now)),
              let from = calendar.date(byAdding: .hour, value: 20, to: yesterday)
        else { return nil }
        return from...now
    }

    /// The line, or nil when it isn't the morning or there's nothing to say yet.
    static func words(_ n: Night, calendar: Calendar = .current) -> String? {
        guard let night = night(of: n.now, calendar: calendar) else { return nil }
        var parts: [String] = []

        let updated = n.apps.filter { app in app.updatedAt.flatMap(GoTime.parse).map(night.contains) ?? false }
        if !updated.isEmpty {
            parts.append(updated.count == 1 ? "\(updated[0].name) updated" : "\(updated.count) apps updated")
        }

        let back = n.events.filter { e in
            night.contains(e.time) && ((e.tags ?? []).contains("rewind") || (e.title ?? "").range(of: "rolled back", options: .caseInsensitive) != nil)
        }
        if !back.isEmpty { parts.append("\(back.count) rolled back") }

        if let copies = n.copies {
            let made = copies.filter { $0.newest.map(night.contains) ?? false }
            let size = made.reduce(Int64(0)) { $0 + max(0, $1.size) }
            if !made.isEmpty {
                parts.append(size > 0 ? "a backup of \(ByteCountFormatter.string(fromByteCount: size, countStyle: .file))" : "the backup ran")
            }
        }

        // What needed you: an app down overnight, or an alert that asked for a look.
        let down = n.outages.filter { _, list in
            list.contains { ($0.to ?? night.upperBound) >= night.lowerBound && $0.from <= night.upperBound }
        }.keys.sorted()
        let loud = n.events.filter { e in night.contains(e.time) && e.isUrgent && !back.contains(e) }
        if let first = down.first {
            let name = n.apps.first { $0.id == first }?.name ?? first
            parts.append(down.count == 1 ? "\(name) was down for a while" : "\(down.count) apps were down for a while")
        } else if !loud.isEmpty {
            parts.append(loud.count == 1 ? "1 alert to look at" : "\(loud.count) alerts to look at")
        } else if n.watched {
            parts.append("nothing needed you")
        }
        return parts.isEmpty ? nil : "Overnight: " + parts.joined(separator: ", ") + "."
    }

    // MARK: Hide until tomorrow (this device only; only the day is kept)

    private static let hiddenKey = "overnightHidden"

    static func isHiddenToday(_ now: Date = Date(), defaults: UserDefaults = .standard, calendar: Calendar = .current) -> Bool {
        defaults.string(forKey: hiddenKey) == FinancePlanEdit.todayString(now, calendar: calendar)
    }

    static func hideToday(_ now: Date = Date(), defaults: UserDefaults = .standard, calendar: Calendar = .current) {
        defaults.set(FinancePlanEdit.todayString(now, calendar: calendar), forKey: hiddenKey)
    }
}
