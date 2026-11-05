import Foundation

/// What a device may do with Finances (`companion.Finances*`). It's set per
/// device on the computer, apart from `canChange`, and the computer checks
/// it on every call. Finances also need the encrypted link, which is the
/// only kind this client uses.
enum FinancesLevel: String, Sendable, Comparable {
    case none = ""
    /// A wall screen: the next payday, what's left after it, the next bills.
    case card
    case view
    case edit

    init(_ raw: String?) {
        self = FinancesLevel(rawValue: (raw ?? "").lowercased()) ?? .none
    }

    private var rank: Int {
        switch self {
        case .none: 0
        case .card: 1
        case .view: 2
        case .edit: 3
        }
    }

    static func < (a: FinancesLevel, b: FinancesLevel) -> Bool { a.rank < b.rank }
}

/// The money card (`finance.Wall`, the `FinancesWall` call). It holds a
/// few facts and never the plan. With Hide amounts on, the computer
/// zeroes every amount before sending.
struct MoneyCard: Decodable, Sendable, Equatable {
    /// The next paycheck's day, nil with none ahead.
    let payday: Date?
    /// Who is paid that day.
    let who: [String]
    /// What's left in checking once that paycheck's stretch has paid its bills.
    let left: Double
    /// The next bills, soonest first.
    let bills: [MoneyBill]
    /// Hide amounts is on: every amount here is 0, so show none.
    let hidden: Bool
    /// ISO 4217; USD when the plan has none.
    let currency: String

    enum CodingKeys: String, CodingKey { case payday, who, left, bills, hidden, currency }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        payday = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .payday))
        who = (try c.decodeIfPresent([String].self, forKey: .who) ?? []).filter { !$0.isEmpty }
        left = try c.decodeIfPresent(Double.self, forKey: .left) ?? 0
        bills = try c.decodeIfPresent([MoneyBill].self, forKey: .bills) ?? []
        hidden = try c.decodeIfPresent(Bool.self, forKey: .hidden) ?? false
        currency = Self.currencyCode(try c.decodeIfPresent(String.self, forKey: .currency))
    }

    /// A three-letter code, as the computer keeps it, or USD.
    static func currencyCode(_ raw: String?) -> String {
        let code = (raw ?? "").trimmingCharacters(in: .whitespaces).uppercased()
        guard code.count == 3, code.unicodeScalars.allSatisfy({ $0.value >= 65 && $0.value <= 90 }) else { return "USD" }
        return code
    }
}

struct MoneyBill: Decodable, Sendable, Equatable, Identifiable {
    let name: String
    let institution: String?
    let date: Date?
    let amount: Double

    var id: String { "\(name)|\(date?.timeIntervalSince1970 ?? 0)" }

    enum CodingKeys: String, CodingKey { case name, institution, date, amount }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        name = try c.decodeIfPresent(String.self, forKey: .name) ?? ""
        institution = try c.decodeIfPresent(String.self, forKey: .institution)
        date = LocalDay.parse(try c.decodeIfPresent(String.self, forKey: .date))
        amount = try c.decodeIfPresent(Double.self, forKey: .amount) ?? 0
    }
}
