import Foundation
import Testing
@testable import HomelabClient

// Read Now and Add a Holding from the phone (main #494, #498): what's
// checked before the computer is asked, what's sent, and what's said.
@Suite("Investments from the phone")
struct InvestmentsActionsTests {
    private var utc: Calendar {
        var c = Calendar(identifier: .gregorian)
        c.timeZone = TimeZone(identifier: "UTC") ?? .current
        return c
    }

    private let vti = InvestmentSymbol(symbol: "VTI", name: "Vanguard Total Stock Market ETF", currency: "USD", dataSource: "YAHOO")

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Date {
        utc.date(from: DateComponents(year: y, month: m, day: d, hour: 12)) ?? .distantPast
    }

    @Test func whatsCheckedFirst() {
        let now = day(2026, 11, 8)
        var add = InvestmentAdd(account: "ira", newName: nil, symbol: vti, shares: 2, total: 500, date: day(2026, 11, 5), sold: false)
        #expect(add.problem(now: now, calendar: utc) == nil)
        add.account = nil
        #expect(add.problem(now: now, calendar: utc) == "Pick the account it's in, or name a new one.")
        add.newName = "  Brokerage "
        #expect(add.problem(now: now, calendar: utc) == nil)
        add.symbol = nil
        #expect(add.problem(now: now, calendar: utc) == "Pick what was bought from the list Ghostfolio finds.")
        add.symbol = vti
        add.shares = 0
        #expect(add.problem(now: now, calendar: utc) == "How many shares: more than 0.")
        add.shares = 1
        add.total = -1
        #expect(add.problem(now: now, calendar: utc) == "What was paid: type it without a minus.")
        add.total = 0
        add.date = day(2026, 11, 9)
        #expect(add.problem(now: now, calendar: utc) == "The day is still to come: pick the day it was bought.")
    }

    @Test func whatsSent() {
        let add = InvestmentAdd(account: "ira", newName: nil, symbol: vti, shares: 2.5, total: 610.25, date: day(2026, 11, 5), sold: true)
        #expect(add.json(calendar: utc) == .object([
            "account": .string("ira"), "symbol": .string("VTI"), "dataSource": .string("YAHOO"), "currency": .string("USD"),
            "shares": .number(2.5), "total": .number(610.25), "date": .string("2026-11-05"), "sold": .bool(true),
        ]))
        // A new account goes by its name, never with an account id.
        let new = InvestmentAdd(account: "ira", newName: " Brokerage ", symbol: vti, shares: 1, total: 1, date: day(2026, 1, 2), sold: false)
        let json = new.json(calendar: utc)
        #expect(json?["newName"] == .string("Brokerage"))
        #expect(json?["account"] == nil)
        #expect(json?["sold"] == nil)
        #expect(InvestmentAdd(account: "a", newName: nil, symbol: nil, shares: 1, total: 1, date: Date(), sold: false).json() == nil)
    }

    @Test func whatReadNowSays() throws {
        let view = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-11-08","plan":{"people":[],"payments":[],"cushion":0,
          "accounts":[{"id":"ira","name":"Roth IRA","kind":"retirement","balance":1000,
                       "holdings":[{"symbol":"VTI","shares":2,"paid":400,"value":500},{"symbol":"BND","shares":3,"paid":200,"value":210}]}]},
         "periods":[]}
        """#.utf8))
        let read = FinancesRead(view: view, rawPlan: .null)
        let at = Date()
        #expect(InvestmentsReadResult(read: read, unmatched: [], accounts: 1, holdings: 2).words(at: at).hasSuffix(": 2 holdings in 1 account."))
        #expect(InvestmentsReadResult(read: read, unmatched: [], accounts: 0, holdings: 0).words(at: at).contains("it has no accounts yet"))
        #expect(InvestmentsReadResult(read: read, unmatched: [], accounts: 2, holdings: 0).words(at: at).contains("its 2 accounts hold nothing yet"))
    }

    @Test func symbolsDecode() throws {
        let found = try JSONDecoder().decode([InvestmentSymbol].self, from: Data(#"[{"symbol":"VTI","name":"Vanguard","currency":"USD","dataSource":"YAHOO"}]"#.utf8))
        #expect(found.first?.id == "YAHOO:VTI")
    }
}
