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

    // MARK: A month on paper (exportData.ts's monthPage)

    private static func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
    private static func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
    private static func list(_ x: JSONValue?) -> [JSONValue] { if case .array(let a)? = x { return a }; return [] }

    /// Text for a page: &, <, > and " written so they show as themselves.
    static func esc(_ s: String) -> String {
        s.replacingOccurrences(of: "&", with: "&amp;").replacingOccurrences(of: "<", with: "&lt;")
            .replacingOccurrences(of: ">", with: "&gt;").replacingOccurrences(of: "\"", with: "&quot;")
    }

    /// Who or what an event is: a payment's name, or whose pay.
    private static func what(_ e: JSONValue, plan: JSONValue) -> String {
        if let id = str(e["payment"]), !id.isEmpty {
            return str(list(plan["payments"]).first { $0["id"] == .string(id) }?["name"]) ?? id
        }
        let names = list(e["people"]).compactMap(str).map { id in
            str(list(plan["people"]).first { $0["id"] == .string(id) }?["name"]) ?? id
        }
        return names.isEmpty ? "Pay" : "\(names.joined(separator: " and "))'s pay"
    }

    private static func account(_ id: String?, plan: JSONValue) -> String {
        guard let id, !id.isEmpty else { return "" }
        return str(list(plan["accounts"]).first { $0["id"] == .string(id) }?["name"]) ?? id
    }

    /// A month on paper (YYYY-MM): each day with a payday or payment, what it
    /// is and its amount, and checking at the day's end where it's worked out;
    /// then each paycheck starting in the month, with what came in, went out,
    /// was saved, and was left. Export shows only while amounts do, so they're written out.
    static func monthPage(view v: JSONValue, month: String, title: String, locale: Locale = .current) -> String {
        let plan = v["plan"] ?? .object([:])
        let currency = str(plan["currency"]) ?? "USD"
        let style = FloatingPointFormatStyle<Double>.Currency(code: currency, locale: locale)
        func money(_ n: Double?) -> String { (n ?? 0).formatted(style) }
        let english = Locale(identifier: "en_US")
        func date(_ iso: String) -> Date? {
            var c = DateComponents()
            let f = iso.split(separator: "-").compactMap { Int($0) }
            guard f.count >= 2 else { return nil }
            c.year = f[0]; c.month = f[1]; c.day = f.count > 2 ? f[2] : 1; c.hour = 12
            return Calendar(identifier: .gregorian).date(from: c)
        }
        func day(_ iso: String) -> String {
            date(iso)?.formatted(Date.FormatStyle(locale: english).weekday(.abbreviated).month(.abbreviated).day()) ?? iso
        }
        let label = date(month + "-01")?.formatted(Date.FormatStyle(locale: english).month(.wide).year()) ?? month
        let shownDays = list(v["days"])
        let all = shownDays.map { ($0, true) } + list(v["later"]).map { ($0, false) }
        let days = all.filter { pair in
            (str(pair.0["date"]) ?? "").hasPrefix(month) && (!list(pair.0["events"]).isEmpty || !list(pair.0["charges"]).isEmpty)
        }
        let lines = days.map { pair -> String in
            let (d, shown) = pair
            var items: [(String, String)] = list(d["events"]).map { e in (what(e, plan: plan), money(num(e["amount"]))) }
            for e in list(d["charges"]) {
                items.append(("\(what(e, plan: plan)) (on \(account(str(e["card"]), plan: plan)))", money(num(e["amount"]))))
            }
            let cells = items.map { item in "<div><span>\(esc(item.0))</span><span class=\"n\">\(esc(item.1))</span></div>" }.joined()
            return "<tr><th scope=\"row\">\(esc(day(str(d["date"]) ?? "")))</th><td>\(cells)</td><td class=\"n\">\(shown ? esc(money(num(d["balance"]))) : "")</td></tr>"
        }.joined(separator: "\n")
        let pays = list(v["periods"]).filter { (str($0["start"]) ?? "").hasPrefix(month) }.map { p -> String in
            let head = "<tr><th scope=\"row\">\(esc(day(str(p["start"]) ?? ""))) \u{2013} \(esc(day(str(p["last"]) ?? "")))</th>"
            let cells: [String] = ["in", "out", "saved", "left"].map { key in "<td class=\"n\">\(esc(money(num(p[key]))))</td>" }
            return head + cells.joined() + "</tr>"
        }.joined(separator: "\n")
        let table = days.isEmpty ? "<p>Nothing is planned this month.</p>"
            : "<table><thead><tr><th>Day</th><th>What</th><th class=\"n\">Checking after</th></tr></thead><tbody>\n\(lines)\n</tbody></table>"
        let paychecks = pays.isEmpty ? ""
            : "<h2>Paychecks</h2><table><thead><tr><th>Paycheck</th><th class=\"n\">In</th><th class=\"n\">Out</th><th class=\"n\">Saved</th><th class=\"n\">Left</th></tr></thead><tbody>\n\(pays)\n</tbody></table>"
        return """
        <!doctype html>
        <html lang="en"><head><meta charset="utf-8"><title>\(esc(title)) \u{00B7} \(esc(label))</title>
        <style>
        body { font: 13px/1.45 -apple-system, "Segoe UI", system-ui, sans-serif; color: #111; margin: 32px; }
        h1 { font-size: 20px; margin: 0 0 2px; } p { color: #555; margin: 0 0 18px; } h2 { font-size: 15px; margin: 26px 0 8px; }
        table { width: 100%; border-collapse: collapse; } th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #ddd; }
        th { font-weight: 600; white-space: nowrap; } td div { display: flex; justify-content: space-between; gap: 16px; }
        .n { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; } thead th { color: #555; font-weight: 500; }
        @media print { body { margin: 0; } @page { margin: 16mm; } }
        </style></head>
        <body>
        <h1>\(esc(title)): \(esc(label))</h1>
        <p>Paydays and payments as planned on \(esc(day(str(v["today"]) ?? ""))), with checking at each day's end.</p>
        \(table)
        \(paychecks)
        </body></html>

        """
    }

    /// The month a page is for, `ahead` months from today's (YYYY-MM).
    static func month(_ today: String, ahead: Int) -> String {
        let f = today.split(separator: "-").compactMap { Int($0) }
        guard f.count >= 2 else { return today }
        let m = (f[0] * 12 + (f[1] - 1)) + ahead
        return String(format: "%04d-%02d", m / 12, m % 12 + 1)
    }

    static func monthName(_ month: String) -> String { "finances-\(month).html" }

    static func planName(_ today: String) -> String { "finances-plan-\(today).json" }
    static func aheadName(_ today: String) -> String { "finances-ahead-\(today).csv" }
}

