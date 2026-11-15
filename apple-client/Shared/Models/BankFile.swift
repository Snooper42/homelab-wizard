import Foundation

/// A bank's file read on the phone, as the computer's Import reads one
/// (web/src/finances/importData.ts): a CSV (any bank's columns, guessed
/// from its header and changeable) or an OFX/QFX statement. Plain
/// functions: the file's text in, rows out. Read on this device and never
/// sent anywhere; what comes in goes into the ledger as other changes do.
enum BankFile {
    /// A row of a bank's file, read: its day, amount (money in a plus), payee,
    /// and the bank's own ID when it gives one.
    struct Row: Sendable, Equatable {
        var date: String
        var amount: Double
        var payee: String
        var memo: String? = nil
        var id: String? = nil
        /// The town a City/State column names for it (American Express's), to take off its payee.
        var town: String? = nil
        /// What the file's Category column calls it ("Food & Drink").
        var kind: String? = nil
    }

    /// Which column holds what: indexes into a row, -1 for none. Debit and
    /// credit are a bank's two money columns.
    struct Columns: Sendable, Hashable {
        var date: Int
        var amount: Int
        var debit: Int
        var credit: Int
        var payee: Int
        var memo: Int
        var town: Int = -1
        var kind: Int = -1

        /// Whether a day and some money are picked, so rows can be read.
        var readable: Bool { date >= 0 && (amount >= 0 || debit >= 0 || credit >= 0) }
    }

    /// Whether a file's text is an OFX or QFX statement rather than a CSV.
    static func isOFX(_ text: String) -> Bool {
        let head = String(text.prefix(2000)).uppercased()
        return head.contains("<OFX>") || head.contains("OFXHEADER")
    }

    /// A CSV's text as rows of cells: commas, semicolons or tabs, quotes, and "" inside them.
    static func csvRows(_ text: String) -> [[String]] {
        let chars = Array(text.unicodeScalars)
        let firstLine = String(String.UnicodeScalarView(chars.prefix { $0 != "\n" && $0 != "\r" }))
        let semis = firstLine.filter { $0 == ";" }.count, commas = firstLine.filter { $0 == "," }.count
        let sep: Unicode.Scalar = semis > commas ? ";" : firstLine.contains("\t") && !firstLine.contains(",") ? "\t" : ","
        var rows: [[String]] = []
        var row: [String] = []
        var cell = String.UnicodeScalarView()
        var quoted = false
        var i = 0
        func endRow() {
            row.append(String(cell)); cell = String.UnicodeScalarView()
            if row.contains(where: { !$0.trimmingCharacters(in: .whitespaces).isEmpty }) { rows.append(row) }
            row = []
        }
        while i < chars.count {
            let c = chars[i]
            if quoted {
                if c == "\"", i + 1 < chars.count, chars[i + 1] == "\"" { cell.append("\""); i += 1 }
                else if c == "\"" { quoted = false }
                else { cell.append(c) }
            } else if c == "\"" {
                quoted = true
            } else if c == sep {
                row.append(String(cell)); cell = String.UnicodeScalarView()
            } else if c == "\n" || c == "\r" {
                if c == "\r", i + 1 < chars.count, chars[i + 1] == "\n" { i += 1 }
                endRow()
            } else {
                cell.append(c)
            }
            i += 1
        }
        endRow()
        return rows.map { $0.map { $0.trimmingCharacters(in: .whitespacesAndNewlines) } }
    }

    /// The columns guessed from a header row's words, the first word given
    /// winning wherever its column is (Chase's Details, CREDIT or DEBIT, comes
    /// before its Description, the payee). With the rows under it, a payee
    /// column that holds no names gives way to the one with the most different words.
    static func guessColumns(_ header: [String], body: [[String]] = []) -> Columns {
        let lower = header.map { $0.lowercased() }
        func find(_ words: String...) -> Int {
            for w in words { if let i = lower.firstIndex(where: { $0.contains(w) }) { return i } }
            return -1
        }
        var col = Columns(
            date: find("date", "posted", "day", "datum"),
            amount: find("amount", "value", "betrag"),
            debit: find("debit", "withdrawal", "money out", "paid out"),
            credit: find("credit", "deposit", "money in", "paid in"),
            payee: find("payee", "description", "name", "merchant", "details", "empfänger", "beschreibung"),
            memo: find("memo", "note", "reference"),
            town: find("city"),
            kind: find("category"))
        if !body.isEmpty, !namesIn(body, col.payee) {
            let taken: Set<Int> = [col.date, col.amount, col.debit, col.credit, col.memo, col.town, col.kind]
            let better = header.indices.filter { !taken.contains($0) && namesIn(body, $0) }
                .min { a, b in kinds(body, a) > kinds(body, b) || (kinds(body, a) == kinds(body, b) && a < b) }
            if let better { col.payee = better }
        }
        return col
    }

    private static func cell(_ r: [String], _ i: Int) -> String { i >= 0 && i < r.count ? r[i] : "" }
    private static func cellsOf(_ body: [[String]], _ i: Int) -> [String] {
        body.map { cell($0, i).trimmingCharacters(in: .whitespaces) }.filter { !$0.isEmpty }
    }
    private static func kinds(_ body: [[String]], _ i: Int) -> Int { Set(cellsOf(body, i).map { $0.lowercased() }).count }
    private static let figure = #"^[-+()$€£\d.,\s/:]+$"#
    private static func namesIn(_ body: [[String]], _ i: Int) -> Bool {
        i >= 0 && cellsOf(body, i).contains { !wayOnly($0) && !matches($0, figure) }
    }

    /// A payee that is only a bank's word for which way the money went: CREDIT, DEBIT.
    static func wayOnly(_ payee: String?) -> Bool {
        ["credit", "debit", "dr", "cr", "withdrawal", "deposit"].contains((payee ?? "").trimmingCharacters(in: .whitespacesAndNewlines).lowercased())
    }

    /// Patterns are kept as text and compiled where they're used (a compiled one isn't Sendable).
    private static func matches(_ s: String, _ pattern: String) -> Bool { groups(s, pattern) != nil }
    private static func groups(_ s: String, _ pattern: String, options: NSRegularExpression.Options = []) -> [String]? {
        guard let re = try? NSRegularExpression(pattern: pattern, options: options),
              let m = re.firstMatch(in: s, range: NSRange(s.startIndex..., in: s)) else { return nil }
        return (0..<m.numberOfRanges).map { i in Range(m.range(at: i), in: s).map { String(s[$0]) } ?? "" }
    }

    private static let isoish = #"^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})"#
    private static let numeric = #"^(\d{1,2})([/.-])(\d{1,2})\2(\d{2,4})"#
    private static let wordedFormats = ["MMM d yyyy", "MMM d, yyyy", "MMMM d yyyy", "MMMM d, yyyy", "d MMM yyyy", "d MMMM yyyy", "EEE, d MMM yyyy", "EEE MMM d yyyy"]

    /// A day as a bank writes it: 2026-10-30, 10/30/2026 (30/10/2026 when
    /// `dayFirst`), 30.10.2026, Oct 30 2026; "" when it is none.
    static func readDay(_ s: String, dayFirst: Bool = false) -> String {
        let s = s.trimmingCharacters(in: .whitespacesAndNewlines)
        if let m = groups(s, isoish) { return ymd(Int(m[1]) ?? 0, Int(m[2]) ?? 0, Int(m[3]) ?? 0) }
        if let m = groups(s, numeric) {
            let year = m[4].count == 2 ? 2000 + (Int(m[4]) ?? 0) : Int(m[4]) ?? 0
            let (mo, d) = m[2] == "." || dayFirst ? (Int(m[3]) ?? 0, Int(m[1]) ?? 0) : (Int(m[1]) ?? 0, Int(m[3]) ?? 0)
            return ymd(year, mo, d)
        }
        let f = DateFormatter()
        f.locale = Locale(identifier: "en_US_POSIX")
        f.timeZone = TimeZone(identifier: "UTC")
        for format in wordedFormats {
            f.dateFormat = format
            if let date = f.date(from: s) {
                var cal = Calendar(identifier: .gregorian)
                cal.timeZone = TimeZone(identifier: "UTC")!
                let c = cal.dateComponents([.year, .month, .day], from: date)
                return ymd(c.year ?? 0, c.month ?? 0, c.day ?? 0)
            }
        }
        return ""
    }

    private static func ymd(_ y: Int, _ m: Int, _ d: Int) -> String {
        (1...12).contains(m) && (1...31).contains(d) ? String(format: "%d-%02d-%02d", y, m, d) : ""
    }

    private static let dotted = #"^\d{1,2}\."#
    private static let slashed = #"^(\d{1,2})/"#

    /// Whether a file's days read as day first (a 13th or later in the first place, or dots): 30/10/2026 is.
    static func daysFirst(_ cells: [String]) -> Bool {
        cells.contains { c in matches(c, dotted) || (groups(c, slashed).flatMap { Int($0[1]) } ?? 0) > 12 }
    }

    /// An amount as a bank writes it, whatever this device's language
    /// (money.ts's parseAmount): $1,234.56, 1.234,56, −12.50. Nil when none.
    static func amount(_ typed: String) -> Double? {
        var t = String(typed.unicodeScalars.filter { !CharacterSet.whitespaces.contains($0) && $0 != "\u{00a0}" && $0 != "\u{202f}" && $0 != "'" })
        t = String(t.filter { $0.isASCII && ($0.isNumber || $0 == "." || $0 == "," || $0 == "-") || $0 == "\u{2212}" })
        if let i = t.firstIndex(of: "\u{2212}") { t.replaceSubrange(i...i, with: "-") }
        if let mark = groups(t, decimalMark) {
            let whole = String(t.dropLast(mark[0].count)).filter { $0 != "." && $0 != "," }
            t = whole + "." + mark[0].dropFirst()
        } else {
            t = t.filter { $0 != "." && $0 != "," }
        }
        guard !t.isEmpty, t != "-" else { return nil }
        return leadingNumber(t)
    }
    private static let decimalMark = #"[.,]\d{1,2}$"#
    private static let number = #"^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?"#

    /// The number a text starts with, as JavaScript's parseFloat reads it.
    static func leadingNumber(_ s: String) -> Double? {
        let s = s.trimmingCharacters(in: .whitespacesAndNewlines)
        guard let m = groups(s, number) else { return nil }
        return Double(m[0])
    }

    /// To the cent, a half up, as JavaScript's Math.round.
    static func cents(_ x: Double) -> Double { (x * 100 + 0.5).rounded(.down) / 100 }

    /// A CSV's rows (header first) as what happened, with the columns given.
    /// A row with no day or amount is left out. A payee keeps its runs of
    /// spaces, which say where American Express's columns end.
    static func fromCSV(_ rows: [[String]], _ col: Columns) -> [Row] {
        let body = Array(rows.dropFirst())
        let dayFirst = daysFirst(body.map { cell($0, col.date) })
        func money(_ s: String) -> Double {
            amount(s.replacingOccurrences(of: "(", with: "-").replacingOccurrences(of: ")", with: "")) ?? 0
        }
        func optional(_ r: [String], _ i: Int) -> String? {
            let v = cell(r, i).trimmingCharacters(in: .whitespaces)
            return i >= 0 && !v.isEmpty ? v : nil
        }
        var out: [Row] = []
        for r in body {
            let date = readDay(cell(r, col.date), dayFirst: dayFirst)
            let amount = col.amount >= 0 ? money(cell(r, col.amount)) : money(cell(r, col.credit)) - abs(money(cell(r, col.debit)))
            if date.isEmpty || amount == 0 || !amount.isFinite { continue }
            out.append(Row(date: date, amount: cents(amount), payee: cell(r, col.payee).trimmingCharacters(in: .whitespacesAndNewlines),
                           memo: col.memo >= 0 && !cell(r, col.memo).isEmpty ? cell(r, col.memo) : nil,
                           town: col.town >= 0 && !cell(r, col.town).isEmpty ? cell(r, col.town) : nil,
                           kind: optional(r, col.kind)))
        }
        return out
    }

    /// Whether a card's file lists its charges as plus amounts and payments as
    /// minus (American Express does; Chase writes a charge as minus): most of
    /// three or more rows above zero says so.
    static func chargesPlus(_ rows: [Row]) -> Bool {
        let n = rows.filter { $0.amount != 0 }.count
        return n >= 3 && Double(rows.filter { $0.amount > 0 }.count) > Double(n) / 2
    }

    /// An OFX or QFX statement's transactions: each STMTTRN's day, amount,
    /// name (or memo), and the bank's FITID.
    static func fromOFX(_ text: String) -> [Row] {
        // Split on each <STMTTRN>, in any capitals.
        let blocks = text.replacingOccurrences(of: "<STMTTRN>", with: "\u{0}", options: .caseInsensitive).components(separatedBy: "\u{0}")
        var out: [Row] = []
        for block in blocks.dropFirst() {
            func tag(_ name: String) -> String {
                guard let g = groups(block, "<\(name)>([^<\\r\\n]*)", options: [.caseInsensitive]) else { return "" }
                return g[1].trimmingCharacters(in: .whitespaces)
            }
            let d = tag("DTPOSTED")
            guard d.count >= 8, d.prefix(8).allSatisfy(\.isASCII), d.prefix(8).allSatisfy(\.isNumber),
                  let amount = leadingNumber(tag("TRNAMT")) else { continue }
            let name = tag("NAME"), memo = tag("MEMO")
            let said = name.isEmpty ? memo : name
            let payee = said.split(whereSeparator: \.isWhitespace).joined(separator: " ")
            let day = Array(d)
            out.append(Row(date: "\(String(day[0..<4]))-\(String(day[4..<6]))-\(String(day[6..<8]))", amount: cents(amount), payee: payee,
                           memo: !name.isEmpty && !memo.isEmpty ? memo : nil, id: tag("FITID").isEmpty ? nil : tag("FITID")))
        }
        return out
    }

    /// The words of a payee that say who it is: three letters or more, no store numbers.
    private static func named(_ s: String) -> [String] {
        let stop: Set<String> = ["the", "and", "inc", "llc", "payment", "purchase", "card", "debit", "pos"]
        let letters = String(s.lowercased().map { ($0.isASCII && $0.isLetter) || $0.isWhitespace ? $0 : " " })
        return letters.split(whereSeparator: \.isWhitespace).map(String.init).filter { $0.count >= 3 && !stop.contains($0) }
    }

    /// Two payees for the same: the same words, or one of them in the other
    /// ("Trader Joe's" and "TRADER JOE'S STORE 552").
    static func alike(_ a: String, _ b: String) -> Bool {
        let y = Set(named(b))
        return a.lowercased() == b.lowercased() || named(a).contains { y.contains($0) }
    }
}
