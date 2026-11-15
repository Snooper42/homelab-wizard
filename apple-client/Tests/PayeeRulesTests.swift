import Foundation
import Testing
@testable import HomelabClient

/// The rules imports follow, kept as the computer keeps them (finance.Rule;
/// Edit.tsx's RulesForm and Always do this for…). Every name is made up.
@Suite("Rules")
struct PayeeRulesTests {
    typealias Rule = BankImport.Rule

    @Test func aRuleTheEditMakes() {
        // Renamed: for that name, its new name and category.
        #expect(PayeeRules.always(oldPayee: "Sunset Palms Eas", payee: "HOA", category: "Mortgage or rent", startingWith: nil)
                == Rule(match: "Sunset Palms Eas", payee: "HOA", category: "Mortgage or rent"))
        // The new name starts the old one: names starting so, until picked.
        #expect(PayeeRules.startsOld("Example Pest Control", old: "Example Pest Control 80"))
        #expect(!PayeeRules.startsOld("Example Pest", old: "Example Pesticide"))
        #expect(PayeeRules.always(oldPayee: "Example Pest Control 80", payee: "Example Pest Control", category: "",
                                  startingWith: "Example Pest Control")
                == Rule(match: "Example Pest Control", prefix: true, payee: "Example Pest Control"))
        // Only its capitals changed and no category: nothing to do.
        #expect(PayeeRules.always(oldPayee: "example shop", payee: "Example Shop", category: "", startingWith: nil) == nil)
    }

    @Test func oneOfEachKind() {
        let rules = [Rule(match: "Example", prefix: true, category: "A"), Rule(match: "Example", category: "B")]
        let next = PayeeRules.adding(Rule(match: " example ", category: "C"), to: rules)
        #expect(next == [Rule(match: "Example", prefix: true, category: "A"), Rule(match: "example", category: "C")])
    }

    @Test func keptAsTheComputerKeepsThem() throws {
        let plan: JSONValue = .object(["currency": .string("USD")])
        #expect(PayeeRules.problem([Rule(match: "Example")]) == "The rule for Example does nothing: give it a name or a category.")
        #expect(PayeeRules.problem([Rule(match: " ", payee: "X")]) == "Each rule needs the name it's for.")
        #expect(PayeeRules.setting([Rule(match: "Example")], in: plan) == nil)
        let kept = try #require(PayeeRules.setting([Rule(match: "Example Payroll ", payee: "Sam's pay", category: "Paycheck"),
                                                    Rule(match: "Example", prefix: true, payee: " ", category: "Shopping")], in: plan))
        #expect(kept["rules"] == .array([
            .object(["match": .string("Example Payroll"), "payee": .string("Sam's pay"), "category": .string("Paycheck")]),
            .object(["match": .string("Example"), "prefix": .bool(true), "category": .string("Shopping")]),
        ]))
        #expect(kept["currency"] == .string("USD"))
        // Read back as an import reads them.
        #expect(BankImport.rules(in: kept).map(\.match) == ["Example Payroll", "Example"])
        // None left: the key goes.
        #expect(try #require(PayeeRules.setting([], in: kept))["rules"] == nil)
    }

    @Test func theOnesAlreadyIn() throws {
        let ledger: JSONValue = .object(["transactions": .array([
            .object(["id": .string("a"), "payee": .string("Sunset Palms Eas"), "category": .string("Other"), "amount": .number(-200)]),
            .object(["id": .string("b"), "payee": .string("sunset palms eas"), "amount": .number(-200)]),
            .object(["id": .string("c"), "payee": .string("Sunset Palms Eas"), "to": .string("sav"), "amount": .number(-50)]),
            .object(["id": .string("d"), "payee": .string("Sunset Palms Eas"), "category": .string("Food"),
                     "splits": .array([.object(["category": .string("Food"), "amount": .number(-100)])]), "amount": .number(-100)]),
            .object(["id": .string("e"), "payee": .string("Example Cafe"), "amount": .number(-4)]),
        ])])
        let rule = Rule(match: "Sunset Palms Eas", payee: "HOA", category: "Mortgage or rent")
        // The one being changed isn't counted; a transfer isn't one it's for.
        #expect(PayeeRules.count(rule, in: ledger, except: "a") == 2)
        let applied = try #require(PayeeRules.applying(rule, except: "a", in: ledger))
        guard case .array(let all)? = applied["transactions"] else { Issue.record("no transactions"); return }
        #expect(all[0]["payee"] == .string("Sunset Palms Eas") && all[0]["category"] == .string("Other"))
        #expect(all[1]["payee"] == .string("HOA") && all[1]["category"] == .string("Mortgage or rent"))
        #expect(all[2]["payee"] == .string("Sunset Palms Eas"))
        // A split one takes the name and keeps its parts' category.
        #expect(all[3]["payee"] == .string("HOA") && all[3]["category"] == .string("Food"))
        #expect(all[4]["payee"] == .string("Example Cafe"))
        #expect(PayeeRules.becomes(rule) == "HOA \u{00B7} Mortgage or rent")
    }
}
