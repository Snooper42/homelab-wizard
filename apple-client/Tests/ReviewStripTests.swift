import Foundation
import Testing
@testable import HomelabClient

/// The line under Transactions' review strip, as the redesign's picture. Made-up rows.
@Suite struct ReviewStripTests {
    @Test func whatToSortInAFewWords() {
        #expect(ReviewStrip.line(bills: 2, transfers: 0, uncategorized: 1) == "2 look like bills · 1 needs a category")
        #expect(ReviewStrip.line(bills: 1, transfers: 1, uncategorized: 3) == "1 looks like a bill · 1 looks like a transfer · 3 need a category")
        #expect(ReviewStrip.line(bills: 0, transfers: 2, uncategorized: 0) == "2 look like transfers")
        #expect(ReviewStrip.line(bills: 0, transfers: 0, uncategorized: 0) == nil)
    }

    @Test func aMoveOrASplitNeedsNoCategory() throws {
        let rows = try JSONDecoder.homelab().decode(FinanceLedger.self, from: Data(#"""
        {"transactions":[
          {"id":"a","date":"2026-11-20","account":"chk","amount":-63.75,"payee":"Grocer"},
          {"id":"b","date":"2026-11-20","account":"chk","amount":-500,"payee":"Savings","to":"sav"},
          {"id":"c","date":"2026-11-21","account":"chk","amount":-48.2,"payee":"Fuel","category":"Gas"}
        ]}
        """#.utf8)).transactions
        #expect(ReviewStrip.uncategorized(rows) == 1)
    }
}
