import CryptoKit
import Foundation
import Testing
@testable import HomelabClient

/// The Dashboard's prompts on Finances' home, as the computer's
/// (widgets/Prices.tsx's newPrices, Averages.tsx's averages, Missing.tsx's
/// missingBills), on a made-up view: the expected answers are the
/// computer's own for the same view (run through esbuild).
@Suite("Finance prompts")
struct FinancePromptsTests {
    static let view: JSONValue = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"today":"2026-11-15",
     "plan":{"payments":[
      {"id":"netflix","name":"Netflix","kind":"subscriptions","amount":15.49},
      {"id":"spotify","name":"Spotify","kind":"subscriptions","amount":11.99},
      {"id":"gym","name":"Gym","kind":"subscriptions","amount":30,"card":"visa"},
      {"id":"elec","name":"Electric","kind":"utilities","amount":140,"estimate":true},
      {"id":"water","name":"Water","kind":"utilities","amount":60,"estimate":true},
      {"id":"gas","name":"Gas","kind":"utilities","amount":50,"estimate":true},
      {"id":"rent","name":"Rent","kind":"housing","amount":1800},
      {"id":"lodger","name":"Lodger","kind":"other","amount":450,"payer":"Example Lodger"},
      {"id":"phone","name":"Phone","kind":"utilities","amount":45}]},
     "paid":[
      {"payment":"netflix","due":"2026-10-03","date":"2026-10-03","amount":17.99},
      {"payment":"netflix","due":"2026-11-03","date":"2026-11-03","amount":17.99},
      {"payment":"netflix","due":"2026-09-03","date":"2026-09-03","amount":15.49},
      {"payment":"spotify","due":"2026-10-08","date":"2026-10-08","amount":12.99},
      {"payment":"spotify","due":"2026-11-08","date":"2026-11-08","amount":11.99},
      {"payment":"elec","due":"2026-06-01","date":"2026-06-01","amount":150},
      {"payment":"elec","due":"2026-08-01","date":"2026-08-02","amount":160},
      {"payment":"elec","due":"2026-10-01","date":"2026-10-01","amount":146.5},
      {"payment":"elec","due":"2026-03-01","date":"2026-03-01","amount":300},
      {"payment":"water","due":"2026-07-01","date":"2026-07-01","amount":61},
      {"payment":"water","due":"2026-09-01","date":"2026-09-01","amount":60},
      {"payment":"water","due":"2026-11-01","date":"2026-11-01","amount":60.5},
      {"payment":"gas","due":"2026-10-20","date":"2026-10-20","amount":80},
      {"payment":"rent","due":"2026-10-01","date":"2026-10-01","amount":1800},
      {"payment":"phone","due":"2026-10-10","date":"2026-10-10","amount":45},
      {"payment":"phone","due":"2026-11-10","date":"2026-11-10","amount":45}],
     "last":{"rent":"2026-11-01","phone":"2026-11-10","netflix":"2026-11-03","lodger":"2026-11-05","gym":"2026-11-02","elec":"2026-11-01","water":"2026-11-12"}}
    """#.utf8))

    @Test func aSubscriptionsNewPrice() {
        // Netflix's last two came to $17.99, not the plan's $15.49; Spotify's two differ; the gym is on a card.
        #expect(FinancePrompts.newPrices(Self.view) == [.init(payment: "netflix", was: 15.49, now: 17.99, last: "2026-11-03")])
    }

    @Test func aBillsAverage() {
        // Electric's three in the last six months (March's is older) average $152.17, 3% or more off $140;
        // Water's is under 3% off; Gas was paid once.
        #expect(FinancePrompts.averages(Self.view) == [.init(payment: "elec", planned: 140, average: 152.17, months: 5, times: 3)])
    }

    @Test func billsNotSeenYet() {
        // Paid before, nothing for their last day, three days to two weeks ago; the phone's paid on its day,
        // the lodger's money comes in, the gym is on a card.
        #expect(FinancePrompts.missingBills(Self.view) == [
            .init(payment: "elec", due: "2026-11-01"), .init(payment: "rent", due: "2026-11-01"), .init(payment: "water", due: "2026-11-12"),
        ])
    }

    @Test func keptOnThisPhoneForThatAmount() {
        let price = FinancePrompts.NewPrice(payment: "netflix", was: 15.49, now: 17.99, last: "2026-11-03")
        #expect(FinancePrompts.keptKey(price) == "homelab.finances.keptPrice.netflix.17.99")
        let average = FinancePrompts.Average(payment: "elec", planned: 140, average: 152.17, months: 5, times: 3)
        #expect(FinancePrompts.keptKey(average) == "homelab.finances.keptAverage.elec.152.17")
        // A whole number as JavaScript writes it: no ".0".
        #expect(FinancePrompts.keptKey(FinancePrompts.Average(payment: "gas", planned: 50, average: 80, months: 1, times: 3)) == "homelab.finances.keptAverage.gas.80")
    }

    /// Keep is remembered on this phone as only an HMAC under its own key:
    /// no payment's name or amount is readable in what's stored.
    @Test func keptIsAnHMACOnly() throws {
        let defaults = try #require(UserDefaults(suiteName: "FinancePromptsTests.\(UUID().uuidString)"))
        let key = SymmetricKey(size: .bits256)
        var kept = PromptsKept.load(defaults)
        let price = "homelab.finances.keptPrice.netflix.17.99"
        #expect(!kept.has(price, key: key))
        kept.keep(price, key: key)
        kept.save(to: defaults)
        let again = PromptsKept.load(defaults)
        #expect(again.has(price, key: key))
        #expect(!again.has("homelab.finances.keptPrice.netflix.18.99", key: key))
        let stored = String(decoding: try #require(defaults.data(forKey: PromptsKept.storeKey)), as: UTF8.self)
        #expect(!stored.contains("netflix") && !stored.contains("17.99"))
        // Another phone's key reads nothing as kept.
        #expect(!again.has(price, key: SymmetricKey(size: .bits256)))
    }
}
