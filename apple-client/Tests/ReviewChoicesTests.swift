import Foundation
import Testing
@testable import HomelabClient

/// The categories a new transaction's review card offers. Made-up rows.
@Suite struct ReviewChoicesTests {
    private func rows(_ json: String) throws -> [FinanceTransaction] {
        try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"{"transactions":[\#(json)]}"#.utf8)).transactions
    }

    @Test func itsOwnThenThePayeesThenTheMostUsed() throws {
        let all = try rows("""
        {"id":"new","date":"2026-11-22","account":"visa","amount":-142.36,"payee":"Costco","category":"Groceries"},
        {"id":"c1","date":"2026-11-01","account":"visa","amount":-80,"payee":"Costco","category":"Household"},
        {"id":"c2","date":"2026-10-01","account":"visa","amount":-60,"payee":"Costco","category":"Household"},
        {"id":"c3","date":"2026-09-01","account":"visa","amount":-40,"payee":"Costco","category":"groceries"},
        {"id":"d1","date":"2026-11-02","account":"chk","amount":-20,"payee":"Chipotle","category":"Dining"},
        {"id":"d2","date":"2026-11-03","account":"chk","amount":-25,"payee":"Taqueria","category":"Dining"},
        {"id":"g1","date":"2026-11-04","account":"chk","amount":-30,"payee":"Shell","category":"Gas"},
        {"id":"m","date":"2026-11-05","account":"chk","amount":-500,"payee":"To savings","to":"sav"}
        """)
        let t = all[0]
        let others = Array(all[1...3])
        // Its own, the payee's (Household twice; groceries already in, whatever its case), then the most used.
        #expect(ReviewChoices.categories(for: t, others: others, all: all) == ["Groceries", "Household", "Dining", "Gas"])
        #expect(ReviewChoices.categories(for: t, others: others, all: all, limit: 2) == ["Groceries", "Household"])
    }

    @Test func noCategoryYet() throws {
        let all = try rows(#"{"id":"new","date":"2026-11-22","account":"visa","amount":-9,"payee":"Somewhere"},{"id":"g","date":"2026-11-04","account":"chk","amount":-30,"payee":"Shell","category":"Gas"}"#)
        #expect(ReviewChoices.categories(for: all[0], others: [], all: all) == ["Gas"])
    }
}
