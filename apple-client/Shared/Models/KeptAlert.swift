import Foundation

/// One alert the computer sent, as its record keeps it (AlertLog;
/// internal/history's alerts): kept 90 days, with when its problem cleared
/// and who snoozed it. The computer redacts every line.
struct KeptAlert: Decodable, Sendable, Identifiable, Equatable {
    let id: Int64
    let at: Date?
    /// ntfy's topic it went to: tunnel-watchdog, duplicati-alerts, watchtower…
    let topic: String
    let title: String
    let body: String
    let priority: Int
    /// The watchdog's checks a down alert is about; none for other alerts.
    let checks: [String]
    let clearedAt: Date?
    let snoozedUntil: Date?
    /// Who snoozed it (this computer, a phone by its name); "" on a wall screen.
    let snoozedBy: String

    init(id: Int64, at: Date?, topic: String, title: String, body: String, priority: Int, checks: [String],
         clearedAt: Date?, snoozedUntil: Date?, snoozedBy: String) {
        self.id = id
        self.at = at
        self.topic = topic
        self.title = title
        self.body = body
        self.priority = priority
        self.checks = checks
        self.clearedAt = clearedAt
        self.snoozedUntil = snoozedUntil
        self.snoozedBy = snoozedBy
    }

    private enum CodingKeys: String, CodingKey { case id, at, topic, title, body, priority, checks, clearedAt, snoozedUntil, snoozedBy }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        // Times read as Go writes them, whatever the decoder's date strategy.
        func time(_ key: CodingKeys) -> Date? {
            ((try? c.decodeIfPresent(String.self, forKey: key)) ?? nil).flatMap(GoTime.parse).flatMap { $0.timeIntervalSince1970 > 0 ? $0 : nil }
        }
        id = try c.decode(Int64.self, forKey: .id)
        at = time(.at)
        topic = try c.decodeIfPresent(String.self, forKey: .topic) ?? ""
        title = try c.decode(String.self, forKey: .title)
        body = try c.decodeIfPresent(String.self, forKey: .body) ?? ""
        priority = try c.decodeIfPresent(Int.self, forKey: .priority) ?? 0
        checks = try c.decodeIfPresent([String].self, forKey: .checks) ?? []
        clearedAt = time(.clearedAt)
        snoozedUntil = time(.snoozedUntil)
        snoozedBy = try c.decodeIfPresent(String.self, forKey: .snoozedBy) ?? ""
    }

    /// The checks Snooze… is for: not cleared, and still failing at the
    /// watchdog's last run. None for an alert about no check.
    func snoozable(in watchdog: WatchdogSummary?) -> [String] {
        guard clearedAt == nil, let watchdog else { return [] }
        let failing = Set(watchdog.failing.map(\.name))
        return checks.filter { failing.contains($0) }
    }

    /// Serious enough to sound overnight, as the computer's alerts are.
    var isUrgent: Bool { priority >= 4 }

    /// What became of it, as the computer's Every alert… says: when it
    /// cleared, or who snoozed it until when; nil for an alert about no check.
    func fate(now: Date = Date()) -> String? {
        if let clearedAt { return "Cleared at \(WatchdogSummary.wakeText(clearedAt, now: now))" }
        if let snoozedUntil, snoozedUntil > now {
            let until = WatchdogSummary.wakeText(snoozedUntil, now: now)
            return snoozedBy.isEmpty ? "Snoozed until \(until)" : "Snoozed by \(snoozedBy) until \(until)"
        }
        return checks.isEmpty ? nil : "Not cleared yet"
    }

    /// Its topic by the name the computer's Status gives it.
    var topicName: String {
        switch topic {
        case "watchtower": "Updates"
        case "duplicati-alerts": "Backups"
        case "uptime-kuma": "Uptime Kuma"
        case "tunnel-watchdog": "Watchdog"
        default: topic
        }
    }
}
