import Foundation

/// Finances' Export on the phone, as the computer's (web/src/finances/exportData.ts,
/// F18): the plan as finance.json keeps it, and the year ahead as a
/// spreadsheet. Both are made here from what was read; nothing is sent.
enum FinanceExport {
    /// A CSV cell: quoted when it holds a comma, quote, semicolon or line
    /// break; text a spreadsheet would run as a formula starts with an apostrophe.
    static func cell(_ s: String) -> String {
        var s = s
        if let first = s.unicodeScalars.first, "=+-@\t\r".unicodeScalars.contains(first) { s = "'" + s }
        // By scalar: in Swift "\r\n" is one Character, so a lone line break wouldn't match it.
        if s.unicodeScalars.contains(where: { "\",\r\n;".unicodeScalars.contains($0) }) { return "\"" + s.replacingOccurrences(of: "\"", with: "\"\"") + "\"" }
        return s
    }

    /// The plan as JSON, as finance.json keeps it (its keys in order, so two exports compare).
    static func planJSON(_ plan: JSONValue) -> Data? {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes]
        guard var data = try? encoder.encode(plan) else { return nil }
        data.append(0x0A)
        return data
    }

    /// Every payday and payment from today to a year out, oldest first, from
    /// the computer's view (`days` and `later`): the date, who or what, its
    /// kind, the amount (money out a minus), the account, and checking at the
    /// end of that day where it's worked out (`days`; past them, none).
    static func aheadCSV(view v: JSONValue) -> String {
        func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
        func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
        func list(_ x: JSONValue?) -> [JSONValue] { if case .array(let a)? = x { return a }; return [] }
        let plan = v["plan"] ?? .object([:])
        let today = str(v["today"]) ?? ""
        let checking = str(v["checking"]) ?? ""
        let payments = list(plan["payments"])
        func accountName(_ id: String?) -> String {
            guard let id, !id.isEmpty else { return "" }
            return str(list(plan["accounts"]).first { $0["id"] == .string(id) }?["name"]) ?? id
        }
        func what(_ e: JSONValue) -> (String, String) {
            if let id = str(e["payment"]), !id.isEmpty {
                let name = str(payments.first { $0["id"] == .string(id) }?["name"]) ?? id
                let kind = str(e["card"]).map { !$0.isEmpty } == true ? "Card charge" : (num(e["amount"]) ?? 0) >= 0 ? "Money in" : "Payment"
                return (name, kind)
            }
            let names = list(e["people"]).compactMap(str).map { id in
                str(list(plan["people"]).first { $0["id"] == .string(id) }?["name"]) ?? id
            }
            return (names.isEmpty ? "Pay" : "\(names.joined(separator: " and "))'s pay", "Payday")
        }
        let money = { (n: Double) in String(format: "%.2f", n) }
        var rows: [[String]] = [["Date", "What", "Kind", "Amount", "Account", "Checking after"]]
        let days = list(v["days"]).map { ($0, true) } + list(v["later"]).map { ($0, false) }
        for (d, worked) in days {
            guard let date = str(d["date"]), date >= today else { continue }
            let balance = worked ? num(d["balance"]).map(money) ?? "" : ""
            for e in list(d["events"]) {
                let (name, kind) = what(e)
                let amount = num(e["amount"]) ?? 0
                let pay = str(e["payment"]).flatMap { id in payments.first { $0["id"] == .string(id) } }
                let account = str(e["card"]).flatMap { $0.isEmpty ? nil : $0 }
                    ?? (amount >= 0 ? str(pay?["to"]) : str(pay?["from"])).flatMap { $0.isEmpty ? nil : $0 }
                    ?? checking
                rows.append([date, name, kind, money(amount), accountName(account), balance])
            }
            for e in list(d["charges"]) {
                let (name, _) = what(e)
                rows.append([date, name, "Card charge", money(num(e["amount"]) ?? 0), accountName(str(e["card"])), ""])
            }
        }
        // Amounts and balances are numbers, their minus a minus: never a formula's.
        return rows.map { row in
            row.enumerated().map { i, c in i == 3 || i == 5 ? c : cell(c) }.joined(separator: ",")
        }.joined(separator: "\r\n") + "\r\n"
    }

    /// Every amount is in what's exported, so Export shows only while amounts
    /// do, and never where the plan hides amounts on this device.
    static func offered(amountsShown: Bool, hiddenByPlan: Bool) -> Bool { amountsShown && !hiddenByPlan }

    static func planName(_ today: String) -> String { "finances-plan-\(today).json" }
    static func aheadName(_ today: String) -> String { "finances-ahead-\(today).csv" }
}

