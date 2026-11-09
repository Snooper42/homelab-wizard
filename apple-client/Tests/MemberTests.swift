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

@Suite("Add an account")
struct AddAccountTests {
    @Test func toAnEmptyPlan() throws {
        let plan = JSONValue.object(["rev": .string("new")])
        let edited = try #require(FinancePlanEdit.addingAccount(name: "  Chase Checking ", kind: "checking", balance: 1234.567, today: "2026-11-09", in: plan))
        guard case .array(let accounts)? = edited["accounts"], case .object(let a)? = accounts.first else {
            Issue.record("no accounts"); return
        }
        #expect(a["name"] == .string("Chase Checking"))
        #expect(a["kind"] == .string("checking"))
        #expect(a["balance"] == .number(1234.57))
        #expect(a["id"] == nil) // the computer gives it one
        #expect(edited["rev"] == .string("new"))
    }

    @Test func refusesWhatTheComputerWouldNot() {
        let plan = JSONValue.object([:])
        #expect(FinancePlanEdit.addingAccount(name: " ", kind: "checking", balance: 0, today: "2026-11-09", in: plan) == nil)
        #expect(FinancePlanEdit.addingAccount(name: "Piggy bank", kind: "jar", balance: 0, today: "2026-11-09", in: plan) == nil)
        #expect(FinancePlanEdit.addingAccount(name: "Visa", kind: "card", balance: .infinity, today: "2026-11-09", in: plan) == nil)
        #expect(FinancePlanEdit.addingAccount(name: "Visa", kind: "card", balance: 10, today: "soon", in: plan) == nil)
    }
}
