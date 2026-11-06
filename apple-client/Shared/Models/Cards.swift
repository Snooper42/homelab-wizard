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
    /// Memory nearly full, while the watchdog has alerted about it (main #458).
    let memory: MemoryPressure?
    /// Failing checks whose alerts are snoozed on the computer, and until
    /// when, by check name (main #469). Still checked and shown.
    let snoozed: [String: Date]

    enum CodingKeys: String, CodingKey { case lastRun, checks, failing, pending, week, outages, memory, snoozed }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        lastRun = GoZeroTime.drop(try c.decodeIfPresent(Date.self, forKey: .lastRun))
        checks = try c.decodeIfPresent(Int.self, forKey: .checks) ?? 0
        failing = try c.decodeIfPresent([WatchdogFailure].self, forKey: .failing) ?? []
        pending = try c.decodeIfPresent(Int.self, forKey: .pending) ?? 0
        week = try c.decodeIfPresent([String: Double].self, forKey: .week) ?? [:]
        outages = ((try? c.decodeIfPresent([String: [WatchdogOutage]].self, forKey: .outages)) ?? nil) ?? [:]
        // A part the phone can't read costs only that part.
        memory = (try? c.decodeIfPresent(MemoryPressure.self, forKey: .memory)) ?? nil
        snoozed = ((try? c.decodeIfPresent([String: Date].self, forKey: .snoozed)) ?? nil) ?? [:]
    }

    /// When the alerts about a failing check start again, while snoozed.
    func snoozedUntil(_ check: String, now: Date = Date()) -> Date? {
        guard let until = snoozed[check], until > now else { return nil }
        return until
    }

    /// When a snooze ends, as the computer says it: "3:40 PM" today,
    /// "Sat 9:15 AM" on another day (`wakeText` in web/src/status/Cards.tsx).
    static func wakeText(_ date: Date, now: Date = Date(), calendar: Calendar = .current) -> String {
        if calendar.isDate(date, inSameDayAs: now) {
            return date.formatted(date: .omitted, time: .shortened)
        }
        return date.formatted(.dateTime.weekday(.abbreviated).hour().minute())
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

/// The apps together using nearly all the memory Docker has, for long
/// enough that the watchdog alerted (`health.Memory`, main #458). Status
/// names the biggest, each with Stop, until it comes down.
struct MemoryPressure: Decodable, Sendable, Equatable {
    /// Bytes, all the apps together.
    let used: Int64
    /// Bytes Docker has.
    let total: Int64
    /// When it first measured high in a row.
    let since: Date?
    /// The apps using the most, largest first (three at most).
    let biggest: [AppMemory]

    struct AppMemory: Decodable, Sendable, Equatable {
        /// Its catalog id. Empty for a container the catalog doesn't know,
        /// which gets no Stop.
        let id: String?
        let name: String
        let bytes: Int64
    }

    enum CodingKeys: String, CodingKey { case used, total, since, biggest }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        used = try c.decodeIfPresent(Int64.self, forKey: .used) ?? 0
        total = try c.decodeIfPresent(Int64.self, forKey: .total) ?? 0
        since = GoZeroTime.drop((try? c.decodeIfPresent(Date.self, forKey: .since)) ?? nil)
        biggest = Array(((try? c.decodeIfPresent([AppMemory].self, forKey: .biggest)) ?? nil)?.prefix(3) ?? [])
    }

    /// The share used, in whole percent, as the computer rounds it.
    var percent: Int {
        total > 0 ? Int((Double(used) / Double(total) * 100).rounded()) : 0
    }

    /// Memory as the alert says it, in the binary units Docker sets it in:
    /// "2.1 GB", "900 MB" (`memText` in web/src/status/Cards.tsx).
    static func text(_ bytes: Int64) -> String {
        let gib = Double(1 << 30), mib = Double(1 << 20)
        if Double(bytes) >= gib {
            return (Double(bytes) / gib).formatted(.number.precision(.fractionLength(1)).locale(Locale(identifier: "en_US_POSIX"))) + " GB"
        }
        return "\(Int((Double(bytes) / mib).rounded())) MB"
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
    /// What it stopped since midnight on the computer, newest first, at
    /// most `maxToday` (main #430); `todayCount` is all of them.
    let today: [Attack]
    let todayCount: Int

    static let maxToday = 50

    /// How many of today's aren't listed: "and 12 more today".
    var moreToday: Int { max(0, todayCount - today.count) }

    enum CodingKeys: String, CodingKey { case enforced, bouncer, week, bannedNow, recent, today, todayCount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        enforced = try c.decodeIfPresent(Bool.self, forKey: .enforced) ?? false
        bouncer = try c.decodeIfPresent(String.self, forKey: .bouncer) ?? ""
        week = try c.decodeIfPresent(Int.self, forKey: .week) ?? 0
        bannedNow = try c.decodeIfPresent(Int.self, forKey: .bannedNow) ?? 0
        recent = try c.decodeIfPresent([Attack].self, forKey: .recent) ?? []
        let today = Array((try c.decodeIfPresent([Attack].self, forKey: .today) ?? []).prefix(Self.maxToday))
        self.today = today
        todayCount = max(today.count, try c.decodeIfPresent(Int.self, forKey: .todayCount) ?? 0)
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

/// What the apps have saved so far, month by month (main #437,
/// `savedSoFar` in web/src/status/Tiles.tsx): each recorded day counts its
/// yearly figure over 365, and each day up to the next record counts the
/// earlier one's. Worked on the days as written (YYYY-MM-DD), in UTC, so no
/// time zone can move a day into another month.
struct SavedSoFar: Equatable, Sendable {
    struct Month: Equatable, Sendable, Identifiable {
        /// YYYY-MM.
        let month: String
        let amount: Double
        var id: String { month }
    }

    let total: Double
    /// The first record's day (YYYY-MM-DD), or "" with none.
    let since: String
    /// Newest first.
    let months: [Month]

    /// No more than ten years of days are counted, whatever the records say.
    static let maxDays = 3660

    static func from(_ points: [SavingsPoint]) -> SavedSoFar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = .gmt
        func day(_ text: String) -> Date? {
            let f = text.split(separator: "-")
            guard f.count == 3, let y = Int(f[0]), let m = Int(f[1]), let d = Int(f[2]),
                  (1...12).contains(m), (1...31).contains(d) else { return nil }
            return calendar.date(from: DateComponents(year: y, month: m, day: d, hour: 12))
        }
        let dated = points.compactMap { p in day(p.date).map { (date: $0, text: p.date, annual: p.annual) } }
            .filter { $0.annual.isFinite }
            .sorted { $0.text < $1.text }
        guard let first = dated.first else { return SavedSoFar(total: 0, since: "", months: []) }

        var byMonth: [String: Double] = [:]
        var total = 0.0
        var counted = 0
        for (i, p) in dated.enumerated() {
            guard let next = i + 1 < dated.count ? dated[i + 1].date : calendar.date(byAdding: .day, value: 1, to: p.date)
            else { continue }
            var d = p.date
            while d < next, counted < maxDays {
                let c = calendar.dateComponents([.year, .month], from: d)
                let key = String(format: "%04d-%02d", c.year ?? 0, c.month ?? 0)
                byMonth[key, default: 0] += p.annual / 365
                total += p.annual / 365
                counted += 1
                guard let following = calendar.date(byAdding: .day, value: 1, to: d) else { break }
                d = following
            }
        }
        let months = byMonth.map { Month(month: $0.key, amount: $0.value) }.sorted { $0.month > $1.month }
        return SavedSoFar(total: total, since: first.text, months: months)
    }
}
