import Foundation
import Testing
@testable import HomelabClient

/// Finances' first card as the redesign's phone picture: what's left after
/// the next paycheck's bills, against the period before, checking each day
/// of the period with its bills marked, and how many bills. Made-up figures.
@Suite struct FinanceLeadTests {
    let us = Locale(identifier: "en_US")

    private func view(_ periods: String, days: String = "[]") throws -> FinancesPlanView {
        try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(#"""
        {"today":"2026-10-30","checking":"chk","start":{"chk":2512.40},
         "plan":{"people":[{"id":"alex","name":"Alex"}],"accounts":[{"id":"chk","name":"Example Checking","kind":"checking"}],
                 "payments":[],"cushion":500},
         "periods":\#(periods),"days":\#(days)}
        """#.utf8))
    }

    private let now = #"{"now":true,"start":"2026-10-30","last":"2026-11-05","carried":2512.40,"in":0,"out":2104.49,"saved":0,"left":407.91,"rows":[]}"#
    private let next = #"""
    {"start":"2026-11-06","last":"2026-11-09","pay":{"date":"2026-11-06","people":["alex"],"amount":2150},"carried":407.91,"in":2150,"out":1818.14,"saved":0,"left":739.77,
     "rows":[{"date":"2026-11-07","payment":"rent","amount":1500},{"date":"2026-11-08","payment":"power","amount":118.14},
             {"date":"2026-11-08","payment":"card","amount":200,"outside":true},{"date":"2026-11-09","payment":"roth","amount":200,"into":true}]}
    """#
    private let days = #"[{"date":"2026-11-06","balance":2557.91},{"date":"2026-11-07","balance":1057.91},{"date":"2026-11-08","balance":939.77},{"date":"2026-11-09","balance":739.77}]"#

    @Test func theNextPaychecksPeriodAfterItsBills() throws {
        let lead = try #require(FinanceLead(view("[\(now),\(next)]", days: days)))
        #expect(lead.left == 739.77)
        // Bills out of checking only: not one paid from a card, not money moved into another account.
        #expect(lead.bills == 2 && abs(lead.owed - 1618.14) < 0.001)
        #expect(lead.change.map { abs($0 - 331.86) < 0.001 } == true)
        #expect(lead.label(locale: us) == "In checking on Nov 9, after 2 bills")
    }

    @Test func checkingEachDayWithItsBillsMarked() throws {
        let lead = try #require(FinanceLead(view("[\(now),\(next)]", days: days)))
        #expect(lead.days.map(\.balance) == [2557.91, 1057.91, 939.77, 739.77])
        #expect(lead.days.map(\.bill) == [false, true, true, false])
        // A day the computer didn't read ahead is left out, not drawn as nothing.
        let gap = try #require(FinanceLead(view("[\(now),\(next)]", days: #"[{"date":"2026-11-06","balance":2557.91},{"date":"2026-11-09","balance":739.77}]"#)))
        #expect(gap.days.count == 2)
    }

    @Test func nowsPeriodHasNothingToCompareWith() throws {
        let lead = try #require(FinanceLead(view("[\(now)]")))
        #expect(lead.change == nil && lead.bills == 0 && lead.days.isEmpty)
        #expect(lead.label(locale: us) == "In checking on Nov 5")
        #expect(FinanceLead(try view("[]")) == nil)
    }

    @Test func theCentsAreSetApart() {
        func split(_ s: String) -> String { let p = FinanceLead.splitCents(s); return p.whole + "|" + p.cents }
        #expect(split("$739.77") == "$739|.77")
        #expect(split("-$1,818.14") == "-$1,818|.14")
        #expect(split("$740") == "$740|")
        #expect(split("$•••") == "$•••|")
    }
}
