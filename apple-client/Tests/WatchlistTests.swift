import Foundation
import Testing
@testable import HomelabClient

// Investments' Watchlist in the Homelab app, as on the computer: the plan's
// followed tickers read, each one's change since it was followed said, and
// Unfollow taking it off the plan, leaving the rest as they were.

struct WatchlistTests {
    @Test func thePlanKeepsItsFollowedTickers() throws {
        let json = #"{"people":[],"accounts":[],"payments":[],"watch":[{"symbol":"GLBX","name":"Globex Energy","currency":"USD","since":"2026-10-02","from":45.4,"price":48.12,"history":[{"date":"2026-10-02","amount":45.4},{"date":"2026-10-30","amount":48.12}]},{"symbol":"INIT"}]}"#
        let plan = try JSONDecoder().decode(FinancePlan.self, from: Data(json.utf8))
        #expect(plan.watch.map(\.symbol) == ["GLBX", "INIT"])
        let g = try #require(plan.watch.first)
        #expect(g.name == "Globex Energy" && g.price == 48.12 && g.history.count == 2)
        #expect(abs((g.changeSince ?? 0) - 0.0599) < 0.001)
        #expect(WatchlistCard.changeWords(g.changeSince!) == "+6.0%")
        #expect(WatchlistCard.changeWords(-0.032) == "−3.2%")
        #expect(plan.watch[1].changeSince == nil)
        #expect(WatchlistCard.sinceWords(plan.watch[1]) == "followed today")
        let none = try JSONDecoder().decode(FinancePlan.self, from: Data(#"{"people":[],"accounts":[],"payments":[]}"#.utf8))
        #expect(none.watch.isEmpty)
    }

    @Test func unfollowTakesOneOffThePlan() throws {
        let raw = try JSONDecoder().decode(JSONValue.self, from: Data(#"{"rev":"r1","cushion":500,"watch":[{"symbol":"GLBX"},{"symbol":"INIT"}]}"#.utf8))
        let edited = try #require(FinancePlanEdit.removingWatched("glbx", in: raw))
        guard case .array(let left)? = edited["watch"] else { Issue.record("no watch left"); return }
        #expect(left.count == 1)
        #expect(left.first?["symbol"] == .string("INIT"))
        #expect(edited["cushion"] == raw["cushion"] && edited["rev"] == raw["rev"])
        let last = try #require(FinancePlanEdit.removingWatched("INIT", in: edited))
        #expect(last["watch"] == nil)
        #expect(FinancePlanEdit.removingWatched("NOPE", in: raw) == nil)
    }
}
