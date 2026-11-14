import Foundation
import Testing
@testable import HomelabClient

// Finances read forward on the phone with the computer's own Go
// (mobile/finance through gomobile: HomelabFinance.xcframework, made by
// `make phone-finance-framework` into apple-client/Frameworks/): the same
// finance.View the computer gives, on the golden plans the Go and
// WebAssembly builds are checked against (internal/finance/testdata/golden,
// made up). CI's Mac job builds the framework first, so this runs there; a
// package built without it says so instead.

private let golden = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("internal/finance/testdata/golden")

@Suite("Finances read forward on the phone")
struct FinanceProjectionTests {
    @Test("The golden plans read forward as on the computer", arguments: ["collection", "empty", "household"])
    func golden(_ name: String) throws {
        let dir = golden.appendingPathComponent(name)
        let today = try String(contentsOf: dir.appendingPathComponent("today"), encoding: .utf8).trimmingCharacters(in: .whitespacesAndNewlines)
        let got = try FinanceProjection.project(plan: Data(contentsOf: dir.appendingPathComponent("plan.json")),
                                                ledger: Data(contentsOf: dir.appendingPathComponent("ledger.json")), today: today)
        guard FinanceProjection.available else {
            #expect(got == nil, "a build without the framework projects nothing")
            return
        }
        let view = try #require(got)
        let want = try JSONSerialization.jsonObject(with: Data(contentsOf: dir.appendingPathComponent("view.json"))) as? NSDictionary
        let have = try JSONSerialization.jsonObject(with: view) as? NSDictionary
        #expect(have != nil && have == want, "\(name) on \(today) isn't the computer's view")
    }

    @Test("A plan that isn't one is refused in words")
    func refused() throws {
        guard FinanceProjection.available else { return }
        #expect(throws: FinanceProjection.Failed.self) { try FinanceProjection.project(plan: Data("not json".utf8), ledger: Data("{}".utf8), today: "2026-11-13") }
    }

    @Test("CI's Mac job builds with the framework")
    func inCI() {
        if ProcessInfo.processInfo.environment["HOMELAB_FINANCE_FRAMEWORK"] == "1" { #expect(FinanceProjection.available) }
    }
}
