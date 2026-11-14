import Foundation
import Testing
@testable import HomelabClient

/// Add a Goal on the phone (Parity gap 5, apple-loop.md item 2): a new goal
/// made as the computer's own form makes one, checked as the computer checks
/// it (`cleanGoals`), everything else in the plan kept as it came.
@Suite("Adding a goal")
struct AddGoalTests {
    private let plan = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"rev":"r7","accounts":[
      {"id":"sav","name":"Example Savings","kind":"savings","balance":8000},
      {"id":"chk","name":"Example Checking","kind":"checking","balance":1500},
      {"id":"visa","name":"Example Visa","kind":"card","balance":300}
    ],"goals":[
      {"id":"trip","name":"Trip","target":3000,"shares":[{"account":"sav","percent":60}]}
    ]}
    """#.utf8))

    @Test func addsItAsTheComputersFormDoes() throws {
        let edited = try #require(FinancePlanEdit.addingGoal(
            name: " Emergency fund ", target: 12000.004, date: "2028-06-30", account: "sav", percent: 40, in: plan))
        guard case .array(let goals)? = edited["goals"] else { Issue.record("no goals"); return }
        #expect(goals.count == 2)
        #expect(goals[0]["id"] == .string("trip"))
        let added = goals[1]
        #expect(added["id"] == nil)   // the computer gives it its id
        #expect(added["name"] == .string("Emergency fund"))
        #expect(added["target"] == .number(12000))
        #expect(added["date"] == .string("2028-06-30"))
        #expect(added["shares"] == .array([.object(["account": .string("sav"), "percent": .number(40)])]))
        #expect(edited["rev"] == .string("r7"))
    }

    @Test func noDayIsWhenever() throws {
        let edited = try #require(FinancePlanEdit.addingGoal(
            name: "New laptop", target: 1500, date: nil, account: "chk", percent: 100, in: plan))
        guard case .array(let goals)? = edited["goals"] else { Issue.record("no goals"); return }
        #expect(goals[1]["date"] == nil)
    }

    @Test func refusesWhatTheComputerWould() {
        func add(name: String = "Car", target: Double = 5000, date: String? = nil,
                 account: String = "chk", percent: Double = 50) -> JSONValue? {
            FinancePlanEdit.addingGoal(name: name, target: target, date: date, account: account, percent: percent, in: plan)
        }
        #expect(add() != nil)
        #expect(add(name: "  ") == nil)
        #expect(add(target: 0) == nil)
        #expect(add(target: -1) == nil)
        #expect(add(date: "2028-02-30x") == nil)
        #expect(add(date: "2028-1-5") == nil)          // YYYY-MM-DD only, as the computer reads it
        #expect(add(account: "nope") == nil)
        #expect(add(account: "visa") == nil)           // a card holds no money to put by
        #expect(add(percent: 0) == nil)
        #expect(add(percent: 101) == nil)
        // Savings already gives 60% to Trip: 40% is what's left.
        #expect(add(account: "sav", percent: 41) == nil)
        #expect(add(account: "sav", percent: 40) != nil)
        #expect(FinancePlanEdit.goalShareGiven(of: "sav", in: plan) == 60)
        #expect(FinancePlanEdit.goalShareGiven(of: "chk", in: plan) == 0)
    }
}
