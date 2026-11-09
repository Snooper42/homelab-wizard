import Foundation
import Testing
@testable import HomelabClient

// A household member's phone: whose it is, and what the household shares.
@Suite("A household member's phone")
struct MemberTests {
    @Test func whoseThePhoneIs() throws {
        let owner = try JSONDecoder.homelab().decode(DeviceInfo.self, from: Data(#"{"id":"p1","name":"Kait's iPhone","canChange":true}"#.utf8))
        #expect(!owner.isMember)
        let hers = try JSONDecoder.homelab().decode(DeviceInfo.self, from: Data(#"{"id":"p2","name":"Sam's iPhone","canChange":false,"person":"sam","personName":"Sam"}"#.utf8))
        #expect(hers.isMember)
        #expect(hers.personName == "Sam")
        // Kept and read back as it was.
        let again = try JSONDecoder.homelab().decode(DeviceInfo.self, from: try JSONEncoder().encode(hers))
        #expect(again.person == "sam" && again.isMember)
        let blank = try JSONDecoder.homelab().decode(DeviceInfo.self, from: Data(#"{"id":"p3","name":"x","person":""}"#.utf8))
        #expect(!blank.isMember)
    }

    @Test func whatTheHouseholdShares() throws {
        let shared = try JSONDecoder.homelab().decode(HouseholdShared.self, from: Data(#"""
        {"currency":"usd","shares":["bills","budgets"],
         "bills":[{"name":"Rent","kind":"home","amount":1200,"date":"2026-12-01","every":"month"}],
         "budgets":[{"category":"Groceries","amount":600,"spent":450,"left":150}]}
        """#.utf8))
        #expect(shared.currency == "USD")
        #expect(shared.bills.first?.name == "Rent")
        #expect(shared.bills.first?.date != nil)
        #expect(shared.subscriptions.isEmpty)
        #expect(shared.budgets.first?.share == 0.75)
        #expect(!shared.isEmpty)
        let none = try JSONDecoder.homelab().decode(HouseholdShared.self, from: Data(#"{"currency":"USD","shares":[]}"#.utf8))
        #expect(none.isEmpty)
    }
}
