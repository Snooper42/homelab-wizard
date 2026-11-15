import CryptoKit
import Foundation

/// The Dashboard's prompts, as the computer's: a subscription whose charge
/// changed (widgets/Prices.tsx's `newPrices`), a bill that changes whose
/// average is off the plan's (Averages.tsx's `averages`), and a bill not
/// seen yet (Missing.tsx's `missingBills`). From the computer's view
/// (`plan.payments`, `paid`, `last`, `today`); nothing new is asked of it.
enum FinancePrompts {
    /// A subscription's new price, from the last two it was paid.
    struct NewPrice: Sendable, Equatable, Identifiable {
        let payment: String
        let was: Double
        let now: Double
        /// When it was last paid.
        let last: String
        var id: String { payment }
    }

    /// A bill's average, from what it came to the times it was paid.
    struct Average: Sendable, Equatable, Identifiable {
        let payment: String
        let planned: Double
        let average: Double
        let months: Int
        let times: Int
        var id: String { payment }
    }

    /// A bill not seen yet: its payment and its day.
    struct Missing: Sendable, Equatable, Identifiable {
        let payment: String
        let due: String
        var id: String { payment }
    }

    /// How far back an average reads, how many it needs, how far off the plan it must be to ask.
    static let back = 183, least = 3
    static let off = 0.03
    /// Days after its day before a bill counts as not seen, and how long it's said.
    static let grace = 3, said = 14

    private struct Payment {
        let id: String
        let kind: String
        let amount: Double
        let estimate: Bool
        /// On a card, or money in from someone: never asked about.
        let skip: Bool
    }

    private struct Paid {
        let payment: String
        let due: String
        let date: String
        let amount: Double
    }

    private static func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
    private static func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
    private static func list(_ x: JSONValue?) -> [JSONValue] { if case .array(let a)? = x { return a }; return [] }

    private static func payments(_ v: JSONValue) -> [Payment] {
        list(v["plan"]?["payments"]).compactMap { x in
            guard let id = str(x["id"]) else { return nil }
            let card = str(x["card"]).map { !$0.isEmpty } ?? false
            let payer = str(x["payer"]).map { !$0.isEmpty } ?? false
            let estimate: Bool = { if case .bool(true)? = x["estimate"] { return true }; return false }()
            return Payment(id: id, kind: str(x["kind"]) ?? "", amount: num(x["amount"]) ?? 0, estimate: estimate, skip: card || payer)
        }
    }

    private static func paid(_ v: JSONValue) -> [Paid] {
        list(v["paid"]).compactMap { p in
            guard let payment = str(p["payment"]), let due = str(p["due"]) else { return nil }
            return Paid(payment: payment, due: due, date: str(p["date"]) ?? due, amount: num(p["amount"]) ?? 0)
        }
    }

    /// Each subscription the last two payments of which came to the same amount, and not the plan's.
    static func newPrices(_ v: JSONValue) -> [NewPrice] {
        let all = paid(v)
        return payments(v).compactMap { x in
            guard x.kind == "subscriptions", !x.estimate, !x.skip, x.amount > 0 else { return nil }
            let mine = all.filter { $0.payment == x.id }.sorted { $0.due > $1.due }
            guard mine.count >= 2 else { return nil }
            let (a, b) = (mine[0], mine[1])
            guard abs(a.amount - b.amount) < 0.005, abs(a.amount - x.amount) >= 0.005 else { return nil }
            return NewPrice(payment: x.id, was: x.amount, now: a.amount, last: a.date)
        }
    }

    /// Each estimated bill whose last six months' average is 3% or more off the plan's amount.
    static func averages(_ v: JSONValue) -> [Average] {
        let today = str(v["today"]) ?? ""
        let all = paid(v)
        return payments(v).compactMap { x in
            guard x.estimate, !x.skip, x.amount > 0 else { return nil }
            let mine = all.filter { $0.payment == x.id && (days(from: $0.due, to: today) ?? .max) <= back }
            guard mine.count >= least else { return nil }
            let average = (mine.reduce(0) { $0 + $1.amount } / Double(mine.count) * 100).rounded() / 100
            guard abs(average - x.amount) >= x.amount * off, let first = mine.map(\.due).min() else { return nil }
            let months = max(1, Int((Double(days(from: first, to: today) ?? 0) / 30.4).rounded()))
            return Average(payment: x.id, planned: x.amount, average: average, months: months, times: mine.count)
        }
    }

    /// Each followed bill whose last day passed three days to two weeks ago with nothing paid for it.
    static func missingBills(_ v: JSONValue) -> [Missing] {
        let today = str(v["today"]) ?? ""
        let all = paid(v)
        var last: [String: String] = [:]
        if case .object(let o)? = v["last"] { for (k, x) in o { if let s = str(x) { last[k] = s } } }
        return payments(v).compactMap { x -> Missing? in
            guard let due = last[x.id], !due.isEmpty, !x.skip, x.amount > 0, let late = days(from: due, to: today),
                  late >= grace, late <= said else { return nil }
            // Followed: paid in the ledger before; not seen: nothing for this day.
            guard all.contains(where: { $0.payment == x.id && $0.due < due }),
                  !all.contains(where: { $0.payment == x.id && $0.due == due }) else { return nil }
            return Missing(payment: x.id, due: due)
        }
        .sorted { $0.due < $1.due }
    }

    // MARK: Kept on this phone

    /// The key a Keep is remembered under, for that amount, as the computer's
    /// (so a later change asks again).
    static func keptKey(_ p: NewPrice) -> String { "homelab.finances.keptPrice.\(p.payment).\(jsNumber(p.now))" }
    static func keptKey(_ a: Average) -> String { "homelab.finances.keptAverage.\(a.payment).\(jsNumber(a.average))" }

    /// A number as JavaScript writes it: 80, not 80.0.
    static func jsNumber(_ n: Double) -> String {
        n.rounded() == n && abs(n) < 1e15 ? String(Int64(n)) : String(n)
    }

    /// Whole days from one day to another ("yyyy-MM-dd"), as money.ts's daysBetween.
    static func days(from a: String, to b: String) -> Int? {
        guard let x = utcDay(a), let y = utcDay(b) else { return nil }
        return Int((y.timeIntervalSince(x) / 86_400).rounded())
    }

    private static func utcDay(_ day: String) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return c.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }
}

/// The prompts kept on this phone ("Keep $15.49"), as the computer keeps
/// them in its browser: for that payment and amount, so a later change asks
/// again. As TransactionsSeen does, it keeps nothing readable: only an HMAC
/// of each kept key under this device's random key from the Keychain, and
/// at most the last 200.
struct PromptsKept: Equatable, Sendable {
    static let storeKey = "financePromptsKept.v1"
    static let most = 200

    private(set) var hashes: [String]

    static func load(_ defaults: UserDefaults = .standard) -> PromptsKept {
        guard let data = defaults.data(forKey: storeKey),
              let list = try? JSONDecoder().decode([String].self, from: data) else { return PromptsKept(hashes: []) }
        return PromptsKept(hashes: list)
    }

    func save(to defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(hashes) else { return }
        defaults.set(data, forKey: Self.storeKey)
    }

    func has(_ kept: String, key: SymmetricKey) -> Bool { hashes.contains(ChangeMemory.hash(kept, key: key)) }

    mutating func keep(_ kept: String, key: SymmetricKey) {
        let h = ChangeMemory.hash(kept, key: key)
        guard !hashes.contains(h) else { return }
        hashes.append(h)
        if hashes.count > Self.most { hashes.removeFirst(hashes.count - Self.most) }
    }
}
