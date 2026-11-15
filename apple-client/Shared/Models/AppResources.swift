import Foundation

/// What an app takes on the computer (item 4 of apple-loop.md, Parity's
/// "Memory and processor per app" and "Memory and disk it uses"): memory and
/// processor now, from `docker stats` (the "usage" card, `docker.Stat`), and
/// its folder under data/appdata as the nightly backup measured it (the
/// "storage" card, `storage.Folder`; whose photos take what stays on the
/// computer). An app of several containers ("immich-server", "immich-ml")
/// counts them all.
struct AppResources: Sendable, Equatable {
    /// Bytes in memory now; nil while it isn't running or isn't read.
    var memory: Int64?
    /// Percent of one processor now (docker's CPU%, which passes 100 on several).
    var processor: Double?
    /// Bytes its folder takes.
    var disk: Int64?
    /// When the folder was measured.
    var diskMeasured: Date?

    var isEmpty: Bool { memory == nil && processor == nil && disk == nil }

    /// `id`'s share of the two cards as they came (each nil when the computer didn't send it).
    static func of(_ id: String, usage: JSONValue?, storage: JSONValue?) -> AppResources {
        var out = AppResources()
        func mine(_ name: String) -> Bool { name == id || name.hasPrefix(id + "-") }
        if case .array(let stats)? = usage {
            var memory: Int64 = 0, cpu = 0.0, found = false
            for s in stats {
                guard case .string(let name)? = s["name"], mine(name) else { continue }
                found = true
                if case .number(let c)? = s["cpu"] { cpu += c }
                if case .string(let m)? = s["mem"], let bytes = bytes(m) { memory += bytes }
            }
            if found {
                out.memory = memory
                out.processor = cpu
            }
        }
        if case .array(let apps)? = storage?["apps"] {
            let sizes = apps.compactMap { a -> Int64? in
                guard case .string(let name)? = a["app"], mine(name), case .number(let n)? = a["bytes"] else { return nil }
                return Int64(n)
            }
            if !sizes.isEmpty { out.disk = sizes.reduce(0, +) }
            if case .string(let when)? = storage?["when"] { out.diskMeasured = ISO8601DateFormatter().date(from: when) }
        }
        return out
    }

    /// Docker's memory as it writes it ("312.4MiB", "1.2GiB", "800B", "12.5kB") in bytes.
    static func bytes(_ s: String) -> Int64? {
        let t = s.trimmingCharacters(in: .whitespaces)
        let units: [(String, Double)] = [("TiB", 1 << 40), ("GiB", 1 << 30), ("MiB", 1 << 20), ("KiB", 1 << 10),
                                         ("TB", 1e12), ("GB", 1e9), ("MB", 1e6), ("kB", 1e3), ("KB", 1e3), ("B", 1)]
        for (unit, size) in units where t.hasSuffix(unit) {
            guard let n = Double(t.dropLast(unit.count).trimmingCharacters(in: .whitespaces)), n.isFinite, n >= 0 else { return nil }
            return Int64((n * size).rounded())
        }
        return nil
    }
}
