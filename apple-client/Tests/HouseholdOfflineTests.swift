import Foundation
import Testing
@testable import HomelabClient

// The household's Finances worked out on the phone while the Homelab doesn't
// answer (offline Finances 1 of 3): the kept plan read forward from today with
// the computer's own code, on the golden household plan (made up).

private let household = URL(fileURLWithPath: #filePath)
    .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
    .appendingPathComponent("internal/finance/testdata/golden/household")

@Suite("The household's Finances, offline")
struct HouseholdOfflineTests {
    private func kept() throws -> (plan: JSONValue, ledger: JSONValue, today: String) {
        var plan = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: household.appendingPathComponent("plan.json")))
        // As the computer sends it: with the plan's rev.
        if case .object(var o) = plan { o["rev"] = .string("r42"); plan = .object(o) }
        let ledger = try JSONDecoder().decode(JSONValue.self, from: Data(contentsOf: household.appendingPathComponent("ledger.json")))
        let today = try String(contentsOf: household.appendingPathComponent("today"), encoding: .utf8)
            .trimmingCharacters(in: .whitespacesAndNewlines)
        return (plan, ledger, today)
    }

    @Test func readForwardFromTodayAsTheComputerWould() throws {
        let k = try kept()
        let got = try HouseholdOffline.project(rawPlan: k.plan, rawLedger: k.ledger, today: k.today, readOnly: false)
        guard FinanceProjection.available else {
            #expect(got == nil, "a build without the framework works nothing out")
            return
        }
        let read = try #require(got)
        let want = try JSONDecoder.homelab().decode(FinancesPlanView.self, from: Data(contentsOf: household.appendingPathComponent("view.json")))
        #expect(read.view.todayText == k.today)
        #expect(read.view.periods == want.periods)
        #expect(read.view.start == want.start)
        // The rev goes back with the plan, so a change made from it is checked against the computer's newest.
        #expect(read.rawPlan["rev"] == .string("r42"))
        #expect(read.view.readOnly == false)
    }

    @Test func aDayLaterIsADayLater() throws {
        guard FinanceProjection.available else { return }
        let k = try kept()
        let next = try #require(LocalDay.parse(k.today)).addingTimeInterval(86_400)
        let later = try #require(try HouseholdOffline.project(rawPlan: k.plan, rawLedger: k.ledger,
                                                               today: FinancePlanEdit.todayString(next), readOnly: true))
        #expect(later.view.todayText == FinancePlanEdit.todayString(next))
        #expect(later.view.readOnly)
    }

    @Test func noLedgerKeptStillReads() throws {
        guard FinanceProjection.available else { return }
        let k = try kept()
        #expect(try HouseholdOffline.project(rawPlan: k.plan, rawLedger: nil, today: k.today, readOnly: true) != nil)
    }
}
