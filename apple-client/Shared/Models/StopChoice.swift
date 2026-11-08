import Foundation

/// One choice in Stop for a while. The computer keeps the stop
/// (internal/stopped) and starts the app again by itself at `until`.
struct StopChoice: Sendable, Equatable, Identifiable {
    /// "For an hour", "Until 9:00 PM tonight", "Until 8:00 AM tomorrow".
    let label: String
    let until: Date

    var id: Date { until }

    /// `until` as `homelab stop --until` takes it: RFC 3339 in UTC, whole seconds.
    var untilArgument: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime]
        formatter.timeZone = TimeZone(identifier: "UTC")
        return formatter.string(from: until)
    }

    /// The times on offer, as the computer offers them (web/src/status/stopFor.ts):
    /// - an hour from now
    /// - 9 PM tonight, while that's more than an hour away
    /// - 8 AM: this morning if it's still before 6, otherwise tomorrow
    static func choices(now: Date = Date(), calendar: Calendar = .current) -> [StopChoice] {
        var out: [StopChoice] = []

        let inAnHour = now.addingTimeInterval(3600)
        let hourFloor = calendar.dateInterval(of: .minute, for: inAnHour)?.start ?? inAnHour
        out.append(StopChoice(label: "For an hour", until: hourFloor))

        let startOfToday = calendar.startOfDay(for: now)
        if let tonight = calendar.date(byAdding: .hour, value: 21, to: startOfToday),
           tonight.timeIntervalSince(now) > 3600 {
            out.append(StopChoice(label: "Until \(clock(tonight)) tonight", until: tonight))
        }

        let early = calendar.component(.hour, from: now) < 6
        if let day = calendar.date(byAdding: .day, value: early ? 0 : 1, to: startOfToday),
           let morning = calendar.date(byAdding: .hour, value: 8, to: day) {
            out.append(StopChoice(label: "Until \(clock(morning))\(early ? "" : " tomorrow")", until: morning))
        }
        return out
    }

    private static func clock(_ date: Date) -> String {
        date.formatted(date: .omitted, time: .shortened)
    }
}

/// An app stopped on purpose (`stopped.Stop`). Nothing starts it by itself,
/// except at `until` when that's set.
struct StopRecord: Codable, Sendable, Equatable, Hashable {
    let since: Date
    let until: Date?
    /// Who stopped it when not a person (`stopped.Stop.Why`):
    /// `restarting` is the watchdog, after Docker restarted it over and
    /// over (main #427). It stays stopped until someone starts it.
    let why: String?
    /// How many times Docker restarted it in the hour, for `restarting`.
    let restarts: Int

    static let keptRestartingWhy = "restarting"

    enum CodingKeys: String, CodingKey { case since, until, why, restarts }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        since = try c.decode(Date.self, forKey: .since)
        until = try c.decodeIfPresent(Date.self, forKey: .until)
        why = try c.decodeIfPresent(String.self, forKey: .why)
        restarts = max(0, try c.decodeIfPresent(Int.self, forKey: .restarts) ?? 0)
    }

    /// Stopped by the watchdog for restarting over and over. Unlike one
    /// stopped by you, it needs a look: its log says why.
    var keptRestarting: Bool { why == Self.keptRestartingWhy }

    /// How a row says it, as on the computer: "Stopped by you",
    /// "Stopped: it restarted 5 times in an hour" (the watchdog),
    /// "Stopped until 9:00 PM", "Stopped until tomorrow, 8:00 AM",
    /// "Stopped until Fri, 8:00 AM".
    func words(now: Date = Date(), calendar: Calendar = .current) -> String {
        if keptRestarting {
            return restarts > 0 ? "Stopped: it restarted \(restarts) times in an hour" : "Stopped: it restarted many times in an hour"
        }
        guard let until else { return "Stopped by you" }
        let days = calendar.dateComponents([.day], from: calendar.startOfDay(for: now), to: calendar.startOfDay(for: until)).day ?? 0
        let time = until.formatted(date: .omitted, time: .shortened)
        switch days {
        case ...0: return "Stopped until \(time)"
        case 1: return "Stopped until tomorrow, \(time)"
        default: return "Stopped until \(until.formatted(.dateTime.weekday(.abbreviated))), \(time)"
        }
    }
}
