import Foundation

/// Finances › Calendar, as the computer's (web/src/finances/Calendar.tsx):
/// the money day by day. Each day the computer read ahead (`days`) has
/// checking at its end, its paydays and payments, and whether it's under the
/// cushion; past them, to a year from today, what's planned (`later`), with
/// no balance; before them, back to a year ago, what the ledger recorded.
/// Made here from what was read, as Export is: no new call.
struct FinanceCalendar: Sendable {
    /// A payday or a payment on a day (`finance.Event`).
    struct Event: Sendable, Equatable {
        let payment: String?
        /// Who is paid, for a payday.
        let people: [String]
        let amount: Double
        /// A bill charged to a card: no checking money moves that day.
        let card: String?
        /// When the card's bill is due.
        let due: String?
        var isPayday: Bool { !people.isEmpty }
    }

    /// A payday moved before a weekend or holiday.
    struct Moved: Sendable, Equatable {
        let person: String
        let from: String
        let why: String
    }

    /// A transaction recorded on a day, its amount in the plan's currency.
    struct Recorded: Sendable, Equatable, Identifiable {
        let id: String
        let payee: String
        let amount: Double
        /// A move to another account: neither in nor out.
        let to: String?
    }

    struct Day: Sendable, Equatable, Identifiable {
        let date: String
        /// Checking at the end of the day (read days only).
        var balance: Double = 0
        var events: [Event] = []
        var charges: [Event] = []
        var holiday: String?
        var moved: [Moved] = []
        /// Under the cushion.
        var low = false
        /// Past the days read: what's planned, with no balance.
        var later = false
        /// Before the days read: what the ledger recorded.
        var past = false
        /// What was recorded on it (before today, and today's own).
        var spent: [Recorded] = []
        /// What they came to, moves left out.
        var net: Double = 0
        var id: String { date }
    }

    /// The month in all: what its paychecks bring and its bills take, the
    /// lowest checking gets, and what was recorded on its days up to today.
    struct Summary: Sendable, Equatable {
        var paychecks = 0
        var paid: Double = 0
        var who: [String] = []
        var comesIn = 0
        var came: Double = 0
        var bills = 0
        var billed: Double = 0
        var charges = 0
        /// What was charged to cards, as a plus.
        var charged: Double = 0
        var lowest: Day?
        var recordedIn = 0
        var recordedOut = 0
        var recorded: Double = 0
        var isEmpty: Bool {
            paychecks + comesIn + bills + charges + recordedIn + recordedOut == 0 && lowest == nil
        }
    }

    let today: String
    let cushion: Double
    /// Weeks start on Monday with UK bank holidays, else on Sunday.
    let mondayFirst: Bool
    let days: [String: Day]
    /// The first and last days it has.
    let first: String
    let last: String
    /// The first and last days checking is read for.
    let from: String
    let read: String
    private let people: [String: String]

    /// How far back it shows what was recorded: a year, from the 1st of its month.
    static let backMonths = 12

    init(view v: JSONValue, ledger: JSONValue?) {
        func str(_ x: JSONValue?) -> String? { if case .string(let s)? = x { return s }; return nil }
        func num(_ x: JSONValue?) -> Double? { if case .number(let n)? = x { return n }; return nil }
        func list(_ x: JSONValue?) -> [JSONValue] { if case .array(let a)? = x { return a }; return [] }
        func event(_ e: JSONValue) -> Event {
            Event(payment: str(e["payment"]), people: list(e["people"]).compactMap(str), amount: num(e["amount"]) ?? 0,
                  card: str(e["card"]), due: str(e["due"]))
        }
        let plan = v["plan"] ?? .object([:])
        let today = str(v["today"]) ?? ""
        let cushion = num(plan["cushion"]) ?? 0
        self.today = today
        self.cushion = cushion
        mondayFirst = str(plan["holidays"]) == "uk"
        people = Dictionary(list(plan["people"]).compactMap { p in str(p["id"]).map { ($0, str(p["name"]) ?? $0) } },
                            uniquingKeysWith: { a, _ in a })
        var holidays: [String: String] = [:]
        if case .object(let h)? = v["holidays"] { for (k, x) in h { if let s = str(x) { holidays[k] = s } } }
        var moved: [String: [Moved]] = [:]
        for p in list(v["paydays"]) {
            guard let date = str(p["date"]) else { continue }
            let m = list(p["moved"]).map { Moved(person: str($0["person"]) ?? "", from: str($0["from"]) ?? "", why: str($0["why"]) ?? "") }
            if !m.isEmpty { moved[date] = m }
        }
        // The ledger by day, each in the plan's currency (model.ts's inHome and rateOf).
        var rates: [String: Double] = [:]
        if case .object(let r)? = plan["rates"] { for (k, x) in r { if let n = num(x) { rates[k.uppercased()] = n } } }
        var rateOf: [String: Double] = [:]
        for a in list(plan["accounts"]) {
            guard let id = str(a["id"]) else { continue }
            rateOf[id] = str(a["currency"]).flatMap { rates[$0.uppercased()] } ?? 1
        }
        var byDay: [String: [Recorded]] = [:]
        for t in list(ledger?["transactions"]) {
            guard let id = str(t["id"]), let date = str(t["date"]) else { continue }
            let raw = num(t["amount"]) ?? 0
            let rate = rates.isEmpty ? 1 : rateOf[str(t["account"]) ?? ""] ?? 1
            let amount = rate == 1 ? raw : (raw * rate * 100).rounded() / 100
            byDay[date, default: []].append(Recorded(id: id, payee: str(t["payee"]) ?? "", amount: amount, to: str(t["to"]).flatMap { $0.isEmpty ? nil : $0 }))
        }
        func recorded(_ date: String) -> ([Recorded], Double) {
            let spent = byDay[date] ?? []
            return (spent, spent.filter { $0.to == nil }.reduce(0) { $0 + $1.amount })
        }

        var out: [String: Day] = [:]
        let read = list(v["days"])
        let firstRead = read.first.flatMap { str($0["date"]) }
        // Before the days read ahead: what was recorded, from the month of the first transaction, a year back at most.
        if let firstRead, let earliest = byDay.keys.filter({ $0 < firstRead }).min(),
           let floor = Self.addMonths(Self.month(of: today), -Self.backMonths).map({ $0 + "-01" }) {
            let start = String(earliest.prefix(7)) + "-01"
            var d = start < floor ? floor : start
            while d < firstRead {
                let (spent, net) = recorded(d)
                out[d] = Day(date: d, holiday: holidays[d], past: true, spent: spent, net: net)
                guard let next = Self.addDays(d, 1) else { break }
                d = next
            }
        }
        for x in read {
            guard let date = str(x["date"]) else { continue }
            let balance = num(x["balance"]) ?? 0
            var day = Day(date: date, balance: balance, events: list(x["events"]).map(event), charges: list(x["charges"]).map(event),
                          holiday: holidays[date], moved: moved[date] ?? [], low: cushion != 0 && balance < cushion)
            if date <= today { (day.spent, day.net) = recorded(date) }
            out[date] = day
        }
        // Further ahead, every day to a year from today: what falls on it, or nothing.
        var ahead: [String: JSONValue] = [:]
        for x in list(v["later"]) { if let date = str(x["date"]) { ahead[date] = x } }
        if let lastDay = read.last.flatMap({ str($0["date"]) }), let end = Self.yearAhead(today) {
            var d = Self.addDays(lastDay, 1)
            while let day = d, day <= end {
                out[day] = Day(date: day, events: list(ahead[day]?["events"]).map(event), charges: list(ahead[day]?["charges"]).map(event),
                               holiday: holidays[day], later: true)
                d = Self.addDays(day, 1)
            }
        }
        days = out
        let dates = out.keys.sorted()
        first = dates.first ?? today
        last = dates.last ?? today
        from = firstRead ?? first
        self.read = read.last.flatMap { str($0["date"]) } ?? last
    }

    /// The day it opens on: today, or the first day read when today has none.
    var opening: String { days[today] != nil ? today : from }

    /// A person's name from their id.
    func name(of person: String) -> String { people[person] ?? person }

    /// An event in words: "Alex's paycheck", or the payment's name from `payments` (id to name).
    func named(_ e: Event, payments: [String: String]) -> String {
        if e.isPayday { return e.people.map(name(of:)).joined(separator: " and ") + "'s paycheck" }
        return e.payment.flatMap { payments[$0] } ?? e.payment ?? ""
    }

    /// The days of a month ("2026-12") it has, in order.
    func inMonth(_ month: String) -> [Day] {
        Self.datesOf(month).compactMap { days[$0] }
    }

    /// How many of the month's days are under the cushion.
    func lowDays(in month: String) -> Int { inMonth(month).filter(\.low).count }

    /// The month in rows of seven, nil where a week starts before it or ends after it.
    func weeks(of month: String) -> [[String?]] {
        let dates = Self.datesOf(month)
        guard let start = dates.first, let weekday = Self.weekday(start) else { return [] }
        // 1 is Sunday.
        let lead = (weekday - 1 + (mondayFirst ? 6 : 0)) % 7
        var cells: [String?] = Array(repeating: nil, count: lead) + dates.map { Optional($0) }
        while cells.count % 7 != 0 { cells.append(nil) }
        return stride(from: 0, to: cells.count, by: 7).map { Array(cells[$0..<$0 + 7]) }
    }

    /// Whether the month before (-1) or after (1) has any day it shows.
    func canTurn(from month: String, by n: Int) -> Bool {
        n < 0 ? month > Self.month(of: first) : month < Self.month(of: last)
    }

    /// The month in all (Calendar.tsx's MonthCard).
    func summary(of month: String) -> Summary {
        let ds = inMonth(month)
        var s = Summary()
        var who: [String] = []
        for e in ds.flatMap(\.events) {
            if e.isPayday {
                s.paychecks += 1
                s.paid += e.amount
                for p in e.people where !who.contains(p) { who.append(p) }
            } else if e.amount < 0 {
                s.bills += 1
                s.billed += e.amount
            } else if e.amount > 0 {
                s.comesIn += 1
                s.came += e.amount
            }
        }
        s.who = who.map(name(of:))
        let charges = ds.flatMap(\.charges)
        s.charges = charges.count
        s.charged = -charges.reduce(0) { $0 + $1.amount }
        // The lowest of the days checking is read for, from today on.
        s.lowest = ds.filter { !$0.past && !$0.later && $0.date >= today }.min { $0.balance < $1.balance }
        for d in ds where d.past || d.date == today {
            for t in d.spent where t.to == nil {
                if t.amount > 0 { s.recordedIn += 1 } else if t.amount < 0 { s.recordedOut += 1 }
            }
            s.recorded += d.net
        }
        s.billed = (s.billed * 100).rounded() / 100
        s.recorded = (s.recorded * 100).rounded() / 100
        return s
    }

    // MARK: Days as "yyyy-MM-dd", worked out in UTC so no clock change moves them

    private static func calendar() -> Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC") ?? .gmt
        return c
    }

    private static func date(_ day: String) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return calendar().date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2]))
    }

    private static func string(_ date: Date) -> String {
        let c = calendar().dateComponents([.year, .month, .day], from: date)
        return String(format: "%04d-%02d-%02d", c.year ?? 0, c.month ?? 0, c.day ?? 0)
    }

    static func addDays(_ day: String, _ n: Int) -> String? {
        date(day).flatMap { calendar().date(byAdding: .day, value: n, to: $0) }.map(string)
    }

    static func month(of day: String) -> String { String(day.prefix(7)) }

    static func addMonths(_ month: String, _ n: Int) -> String? {
        date(month + "-01").flatMap { calendar().date(byAdding: .month, value: n, to: $0) }.map { String(string($0).prefix(7)) }
    }

    /// A year from today, less a day (Calendar.tsx's end).
    static func yearAhead(_ today: String) -> String? {
        date(today).flatMap { calendar().date(byAdding: .year, value: 1, to: $0) }.flatMap { addDays(string($0), -1) }
    }

    /// 1 for Sunday to 7 for Saturday.
    static func weekday(_ day: String) -> Int? { date(day).map { calendar().component(.weekday, from: $0) } }

    static func datesOf(_ month: String) -> [String] {
        guard let start = date(month + "-01"), let range = calendar().range(of: .day, in: .month, for: start) else { return [] }
        return range.map { month + String(format: "-%02d", $0) }
    }

    /// The week's day names, short, as the grid's heads.
    static func weekdayLetters(mondayFirst: Bool) -> [String] {
        let names = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
        return mondayFirst ? Array(names[1...] + names[..<1]) : names
    }

    /// The date for a day, at noon where the phone is, to show in the phone's words.
    static func shown(_ day: String) -> Date? {
        let parts = day.split(separator: "-").compactMap { Int($0) }
        guard parts.count == 3 else { return nil }
        return Calendar.current.date(from: DateComponents(year: parts[0], month: parts[1], day: parts[2], hour: 12))
    }
}
