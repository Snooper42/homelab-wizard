import Foundation

// Analytics on Status, as the computer's (web/src/status/Analytics.tsx): the processor, memory and drives now, the
// apps' use over time, and what each app uses, heaviest first. From the "usage" card (`docker.Stat`), the "storage"
// card (each app's folder), the machine's facts, and `UsageHistory` for a day, a week or a month.

/// One reading of every app together: their processor (percent of one core) and memory (bytes).
struct UsageSample: Equatable, Sendable, Identifiable {
    let at: Date
    let processor: Double
    let memory: Int64
    var id: Date { at }
}

/// What the apps use now, from the usage and storage cards as they came.
struct UsageNow: Equatable, Sendable {
    struct Row: Identifiable, Equatable, Sendable {
        let id: String
        let name: String
        let memory: Int64
        let processor: Double
        /// Its folder, as the nightly backup measured it; nil when it wasn't.
        let disk: Int64?
    }

    /// Whether the usage card was read at all.
    let read: Bool
    /// Every container's processor together, in percent of one core.
    let processor: Double
    let memory: Int64
    /// Each app's use, heaviest memory first, then the busiest.
    let rows: [Row]
    /// What the apps' folders take together; nil before the nightly backup measured them.
    let appsData: Int64?

    static func from(usage: JSONValue?, storage: JSONValue?, apps: [AppStatus]) -> UsageNow {
        var cpu = 0.0, memory: Int64 = 0, read = false
        if case .array(let stats)? = usage {
            read = !stats.isEmpty
            for s in stats {
                if case .number(let c)? = s["cpu"], c.isFinite { cpu += c }
                if case .string(let m)? = s["mem"], let bytes = AppResources.bytes(m) { memory += bytes }
            }
        }
        let rows = apps.compactMap { app -> Row? in
            let r = AppResources.of(app.id, usage: usage, storage: storage)
            guard let used = r.memory else { return nil }
            return Row(id: app.id, name: app.name, memory: used, processor: r.processor ?? 0, disk: r.disk)
        }
        .sorted { $0.memory != $1.memory ? $0.memory > $1.memory : $0.processor > $1.processor }
        var appsData: Int64?
        if case .array(let folders)? = storage?["apps"] {
            let sizes = folders.compactMap { f -> Int64? in
                if case .number(let n)? = f["bytes"], n > 0 { return Int64(n) }
                return nil
            }
            if !sizes.isEmpty { appsData = sizes.reduce(0, +) }
        }
        return UsageNow(read: read, processor: cpu, memory: memory, rows: rows, appsData: appsData)
    }

    /// The app using the most processor, when one uses any (0.1% or more).
    var busiest: Row? {
        guard let top = rows.max(by: { $0.processor < $1.processor }), top.processor >= 0.1 else { return nil }
        return top
    }

    /// The app holding the most memory.
    var heaviest: Row? { rows.first }

    /// "51", "4.2": whole from 10 up, else to a tenth (`pct`).
    static func percent(_ n: Double) -> String {
        n >= 10 ? "\(Int(n.rounded()))" : String(format: "%g", (n * 10).rounded() / 10)
    }

    /// Memory as the computer says it, in 1000s: "1.1 GB", "640 MB", "<1 MB" (`formatMem`).
    static func memory(_ bytes: Int64) -> String {
        let b = Double(bytes)
        if b >= 1e9 { return String(format: b >= 1e10 ? "%.0f GB" : "%.1f GB", b / 1e9) }
        if b >= 1e6 { return "\(Int((b / 1e6).rounded())) MB" }
        return bytes > 0 ? "<1 MB" : "0 MB"
    }

    /// A drive's bytes, short: "3.4 TB", "412 GB", "18 GB" (`formatDisk`).
    static func disk(_ bytes: Int64) -> String {
        let b = Double(bytes)
        if b >= 1e12 { return String(format: b >= 1e13 ? "%.0f TB" : "%.1f TB", b / 1e12) }
        if b >= 1e9 { return "\(Int((b / 1e9).rounded())) GB" }
        return "\(max(0, Int((b / 1e6).rounded()))) MB"
    }

    /// "Now", "The last minute", "The last 12 minutes": what the samples span.
    static func span(_ samples: [UsageSample]) -> String {
        guard let first = samples.first, let last = samples.last, samples.count > 1 else { return "Now" }
        let minutes = max(1, Int((last.at.timeIntervalSince(first.at) / 60).rounded()))
        return minutes == 1 ? "The last minute" : "The last \(minutes) minutes"
    }

    /// The reading these make, at `at`; nil when the usage card wasn't read.
    func sample(at: Date) -> UsageSample? {
        read ? UsageSample(at: at, processor: processor, memory: memory) : nil
    }
}

/// The apps' processor and memory over the last days, as the computer kept them (`usage.History`, `UsageHistory`):
/// Analytics' Day, Week and Month.
struct UsageHistory: Decodable, Sendable, Equatable {
    /// The readings, oldest first, each the apps together.
    let samples: [UsageSample]

    enum CodingKeys: String, CodingKey { case at, cpu, mem }

    init(samples: [UsageSample]) { self.samples = samples }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        let at = try c.decodeIfPresent([String].self, forKey: .at) ?? []
        let cpu = try c.decodeIfPresent([Double].self, forKey: .cpu) ?? []
        let mem = try c.decodeIfPresent([Double].self, forKey: .mem) ?? []
        samples = at.indices.compactMap { i in
            guard i < cpu.count, i < mem.count, let when = GoTime.parse(at[i]), cpu[i].isFinite, mem[i].isFinite else { return nil }
            return UsageSample(at: when, processor: cpu[i], memory: Int64(max(0, mem[i])))
        }
    }

    /// At most `count` points, each the average of its stretch, so a month draws as quickly as a day.
    func thinned(to count: Int = 240) -> [UsageSample] {
        guard samples.count > count, count > 0 else { return samples }
        let size = Int((Double(samples.count) / Double(count)).rounded(.up))
        return stride(from: 0, to: samples.count, by: size).map { start in
            let part = samples[start..<min(start + size, samples.count)]
            let n = Double(part.count)
            return UsageSample(at: part[part.startIndex].at,
                               processor: part.reduce(0) { $0 + $1.processor } / n,
                               memory: Int64(Double(part.reduce(Int64(0)) { $0 + $1.memory }) / n))
        }
    }
}

/// What Analytics' timeline shows: the minutes since it opened, or the computer's day, week or month.
enum UsageSpan: String, CaseIterable, Identifiable, Sendable {
    case now = "Now", day = "Day", week = "Week", month = "Month"
    var id: String { rawValue }

    /// The days `UsageHistory` is asked for; nil for the minutes since it opened.
    var days: Int? {
        switch self {
        case .now: nil
        case .day: 1
        case .week: 7
        case .month: 31
        }
    }

    /// The timeline's heading.
    var heading: String {
        switch self {
        case .now: "Now"
        case .day: "The last day"
        case .week: "The last week"
        case .month: "The last month"
        }
    }
}
