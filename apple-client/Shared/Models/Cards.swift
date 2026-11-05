import Foundation

// The cards a phone can read beside Status (`phoneMethods` › StatusBoard in
// cmd/homelab/serve.go), each decoded from its Go type.

/// The watchdog's last run (`health.Summary`, card "watchdog").
struct WatchdogSummary: Decodable, Sendable, Equatable {
    /// Nil when the watchdog hasn't run yet (Go writes a zero time).
    let lastRun: Date?
    let checks: Int
    /// Confirmed failures, oldest first.
    let failing: [WatchdogFailure]
    /// Failed once. They're checked again on the next run.
    let pending: Int
    /// Each check's share of passing runs this week, 0 to 1, by app id.
    let week: [String: Double]
    /// Each check's times down this week, oldest first, by app id.
    let outages: [String: [WatchdogOutage]]

    enum CodingKeys: String, CodingKey { case lastRun, checks, failing, pending, week, outages }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lastRun = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastRun))
        checks = try c.decodeIfPresent(Int.self, forKey: .checks) ?? 0
        failing = try c.decodeIfPresent([WatchdogFailure].self, forKey: .failing) ?? []
        pending = try c.decodeIfPresent(Int.self, forKey: .pending) ?? 0
        week = try c.decodeIfPresent([String: Double].self, forKey: .week) ?? [:]
        outages = ((try? c.decodeIfPresent([String: [WatchdogOutage]].self, forKey: .outages)) ?? nil) ?? [:]
    }

    /// "96.2% up this week", as the computer words it: shown only below
    /// 99%, cut (not rounded) to a tenth of a percent.
    func uptimeLabel(for id: String) -> String? {
        guard let share = week[id], share < 0.99 else { return nil }
        let tenths = (share * 1000).rounded(.down) / 10
        return "\(tenths.formatted(.number.precision(.fractionLength(0...1))))% up this week"
    }

    /// The share of passing checks this week across all checks, or nil
    /// before the first run.
    var weekUptime: Double? {
        guard !week.isEmpty else { return nil }
        return week.values.reduce(0, +) / Double(week.count)
    }
}

/// One time a check was down (`health.Outage`).
struct WatchdogOutage: Decodable, Sendable, Equatable, Identifiable {
    let from: Date
    /// Nil while it's still down.
    let to: Date?
    let problem: String

    var id: Date { from }

    enum CodingKeys: String, CodingKey { case from, to, problem }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        from = try c.decode(Date.self, forKey: .from)
        to = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .to))
        problem = try c.decodeIfPresent(String.self, forKey: .problem) ?? ""
    }

    /// How long it lasted, or has lasted so far.
    func duration(now: Date = Date()) -> TimeInterval { (to ?? now).timeIntervalSince(from) }
}

struct WatchdogFailure: Decodable, Sendable, Equatable, Identifiable {
    let name: String
    let problem: String
    let since: Date

    var id: String { name }
}

/// The yearly saving that the nightly backup recorded on a day (`savings.Point`, card "savings").
struct SavingsPoint: Decodable, Sendable, Equatable, Identifiable {
    /// YYYY-MM-DD, in the computer's time zone.
    let date: String
    let annual: Double

    var id: String { date }

    /// Noon on that day, for charting, so time zones can't move it to another day.
    var day: Date? { LocalDay.parse(date) }
}

/// CrowdSec as the app shows it (`crowdsec.Protection`, card "protection").
struct Protection: Decodable, Sendable, Equatable {
    /// Bans reach the proxy, so attackers are actually blocked.
    let enforced: Bool
    /// What the check of the bouncer found, in words.
    let bouncer: String
    /// Alerts in the last 7 days.
    let week: Int
    /// Addresses with a ban in force.
    let bannedNow: Int
    /// Newest first, at most 5.
    let recent: [Attack]

    enum CodingKeys: String, CodingKey { case enforced, bouncer, week, bannedNow, recent }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        enforced = try c.decodeIfPresent(Bool.self, forKey: .enforced) ?? false
        bouncer = try c.decodeIfPresent(String.self, forKey: .bouncer) ?? ""
        week = try c.decodeIfPresent(Int.self, forKey: .week) ?? 0
        bannedNow = try c.decodeIfPresent(Int.self, forKey: .bannedNow) ?? 0
        recent = try c.decodeIfPresent([Attack].self, forKey: .recent) ?? []
    }
}

struct Attack: Decodable, Sendable, Equatable, Identifiable {
    /// For example, http-probing.
    let scenario: String
    let ip: String
    /// Two letters.
    let country: String?
    /// The address's AS name.
    let network: String?
    let when: Date
    /// A ban on it is still in force.
    let banned: Bool

    var id: String { "\(ip)|\(when.timeIntervalSince1970)|\(scenario)" }

    /// "http-probing" → "Http probing".
    var scenarioWords: String {
        let words = scenario.replacingOccurrences(of: "-", with: " ").replacingOccurrences(of: "_", with: " ")
        return words.prefix(1).uppercased() + words.dropFirst()
    }

    /// The flag emoji for `country`, if it's two letters.
    var flag: String? {
        guard let country, country.count == 2 else { return nil }
        let scalars = country.uppercased().unicodeScalars.compactMap { Unicode.Scalar(127_397 + $0.value) }
        guard scalars.count == 2 else { return nil }
        return String(String.UnicodeScalarView(scalars))
    }
}

/// One alert ntfy kept (`notify.Event`, card "alerts").
struct AlertEvent: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let time: Date
    let topic: String
    let title: String?
    let message: String
    /// 1 to 5. 4 and 5 are urgent.
    let priority: Int?
    let tags: [String]?

    var isUrgent: Bool { (priority ?? 3) >= 4 }

    /// The title, or the topic when there's none.
    var heading: String {
        if let title, !title.isEmpty { return title }
        return topic
    }
}

/// Go writes an unset time.Time as 0001-01-01T00:00:00Z.
enum GoZeroTime {
    static func drop(_ date: Date?) -> Date? {
        guard let date, date.timeIntervalSince1970 > 0 else { return nil }
        return date
    }
}

/// A card's data, decoded by the card's name.
enum CardData: Sendable, Equatable {
    case watchdog(WatchdogSummary)
    case savings([SavingsPoint])
    case protection(Protection)
    case alerts([AlertEvent])
    /// A card this client doesn't know yet, kept as plain JSON.
    case other(JSONValue)
}
