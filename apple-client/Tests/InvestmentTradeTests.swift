import Foundation
import Testing
@testable import HomelabClient

/// A holding's buys and sales on its page (Parity gap 5: Change or Delete a
/// buy), as the computer's `FinancesInvestmentTrades` answers them (made up).
@Suite("A holding's buys and sales")
struct InvestmentTradeTests {
    private let json = #"""
    [{"id":"a1","account":"brk","symbol":"VTI","dataSource":"YAHOO","currency":"USD","shares":10,"total":2400,"date":"2026-03-02"},
     {"id":"a2","account":"brk","symbol":"VTI","dataSource":"YAHOO","currency":"USD","shares":2,"total":520,"fee":1.5,"date":"2026-09-15","sold":true}]
    """#

    @Test func readAsTheComputerSendsThem() throws {
        let trades = try JSONDecoder().decode([InvestmentTrade].self, from: Data(json.utf8))
        #expect(trades.map(\.id) == ["a1", "a2"])
        #expect(!trades[0].isSale && trades[1].isSale)
        #expect(trades[1].fee == 1.5)
        #expect(trades[0].day == LocalDay.parse("2026-03-02"))
    }

    @Test func aChangeKeepsWhatItDoesntChange() throws {
        let t = try JSONDecoder().decode([InvestmentTrade].self, from: Data(json.utf8))[1]
        var utc = Calendar(identifier: .gregorian)
        utc.timeZone = TimeZone(identifier: "UTC")!
        let changed = t.changed(shares: 3, total: 780, on: try #require(LocalDay.parse("2026-09-16")), calendar: utc)
        #expect(changed.shares == 3 && changed.total == 780 && changed.date == "2026-09-16")
        #expect(changed.id == "a2" && changed.account == "brk" && changed.symbol == "VTI" && changed.isSale && changed.fee == 1.5)
        // Sent back as the computer reads a Trade: the same keys.
        let sent = try JSONDecoder().decode(JSONValue.self, from: JSONEncoder().encode(changed))
        #expect(sent["sold"] == .bool(true))
        #expect(sent["dataSource"] == .string("YAHOO"))
    }

    @Test func refusedAsTheComputerWouldRefuseIt() throws {
        let t = try JSONDecoder().decode([InvestmentTrade].self, from: Data(json.utf8))[0]
        let now = try #require(LocalDay.parse("2026-11-14"))
        #expect(t.problem(now: now) == nil)
        var bad = t
        bad.shares = 0
        #expect(bad.problem(now: now) == "How many shares: more than 0.")
        bad = t
        bad.total = -1
        #expect(bad.problem(now: now) == "What was paid: type it without a minus.")
        bad = t
        bad.date = "2026-12-01"
        #expect(bad.problem(now: now) == "The day is still to come: pick the day it happened.")
    }
}
