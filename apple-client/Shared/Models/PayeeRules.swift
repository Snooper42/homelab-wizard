import Foundation

/// The household's rules, as the computer keeps them (finance.Rule, Plan.Rules;
/// Edit.tsx's RulesForm and "Always do this for…"): each payee's name as it
/// comes in, or the words names start with, and the name and category it
/// becomes. Every import follows them before anything is guessed. Import 4 of
/// 4 (the owner approved the mock with the pop-up, Nov 15). They change the
/// plan for every device, so they're saved only while the Homelab answers.
enum PayeeRules {
    typealias Rule = BankImport.Rule

    /// What a rule makes of a payee: "HOA · Mortgage or rent", "Its name as it comes in · Repairs".
    static func becomes(_ rule: Rule) -> String {
        [rule.payee ?? "Its name as it comes in", rule.category ?? "no category"].joined(separator: " \u{00B7} ")
    }

    /// As many rules as a plan keeps (internal/finance's maxRules).
    static let most = 500

    /// What makes two rules the same one: the words matched, and whether names starting so count.
    static func kind(_ r: Rule) -> String {
        r.match.trimmingCharacters(in: .whitespaces).lowercased() + (r.prefix ? " …" : "")
    }

    /// Each rule as it's kept: trimmed, and with nothing empty.
    static func tidy(_ r: Rule) -> Rule {
        func t(_ s: String?) -> String? {
            let v = (s ?? "").trimmingCharacters(in: .whitespacesAndNewlines)
            return v.isEmpty ? nil : v
        }
        return Rule(match: r.match.trimmingCharacters(in: .whitespacesAndNewlines), prefix: r.prefix, payee: t(r.payee), category: t(r.category))
    }

    /// Why the rules can't be kept, in words, or nil when they can.
    static func problem(_ rules: [Rule]) -> String? {
        if rules.count > most { return "That's more rules than a plan keeps." }
        for r in rules.map(tidy) {
            if r.match.isEmpty { return "Each rule needs the name it's for." }
            if r.payee == nil && r.category == nil { return "The rule for \(r.match) does nothing: give it a name or a category." }
            if r.match.count > 200 || (r.payee?.count ?? 0) > 200 || (r.category?.count ?? 0) > 100 { return "That's too long." }
        }
        return nil
    }

    /// `rules` with `rule` in, in place of one of the same kind.
    static func adding(_ rule: Rule, to rules: [Rule]) -> [Rule] {
        rules.filter { kind($0) != kind(rule) } + [tidy(rule)]
    }

    /// Whether a new name is the start of the old one ("Example Pest Control"
    /// for "Example Pest Control 80"): then the rule is for names starting so, until picked.
    static func startsOld(_ name: String, old: String) -> Bool {
        let n = name.trimmingCharacters(in: .whitespaces)
        return !n.isEmpty && old.lowercased().hasPrefix(n.lowercased() + " ")
    }

    /// The rule a changed transaction makes (Always do this for its old
    /// name): for that name, or for names starting with `startingWith`; its
    /// new name where it's another, and its category. Nil when it would do nothing.
    static func always(oldPayee: String, payee: String, category: String, startingWith: String?) -> Rule? {
        let old = oldPayee.trimmingCharacters(in: .whitespaces)
        let name = payee.trimmingCharacters(in: .whitespaces)
        let rule = tidy(Rule(match: startingWith ?? old, prefix: startingWith != nil,
                             payee: name.lowercased() != old.lowercased() ? name : nil, category: category))
        return rule.match.isEmpty || (rule.payee == nil && rule.category == nil) ? nil : rule
    }

    /// `plan` with these rules (none: the key taken away), or nil when they can't be kept.
    static func setting(_ rules: [Rule], in plan: JSONValue) -> JSONValue? {
        guard problem(rules) == nil, case .object(var root) = plan else { return nil }
        let kept = rules.map(tidy)
        if kept.isEmpty {
            root.removeValue(forKey: "rules")
        } else {
            root["rules"] = .array(kept.map { r in
                var o: [String: JSONValue] = ["match": .string(r.match)]
                if r.prefix { o["prefix"] = .bool(true) }
                if let p = r.payee { o["payee"] = .string(p) }
                if let c = r.category { o["category"] = .string(c) }
                return .object(o)
            })
        }
        return .object(root)
    }

    /// Whether a transaction in the ledger is one a rule is for: not a transfer, nor `except`, with a payee it matches.
    private static func isFor(_ rule: Rule, _ t: JSONValue, except: String?) -> Bool {
        if case .string(let to)? = t["to"], !to.isEmpty { return false }
        if let except, t["id"] == .string(except) { return false }
        guard case .string(let payee)? = t["payee"], !payee.trimmingCharacters(in: .whitespaces).isEmpty else { return false }
        return BankImport.ruleMatches(rule, payee)
    }

    /// How many in the ledger a rule is for, but `except`.
    static func count(_ rule: Rule, in ledger: JSONValue?, except: String? = nil) -> Int {
        guard case .array(let all)? = ledger?["transactions"] else { return 0 }
        return all.filter { isFor(rule, $0, except: except) }.count
    }

    /// `ledger` with the ones already in that a rule is for taking its name
    /// and its category (a split one keeps its own), everything else kept.
    static func applying(_ rule: Rule, except: String? = nil, in ledger: JSONValue) -> JSONValue? {
        guard case .object(var root) = ledger, case .array(var all)? = root["transactions"] else { return nil }
        let rule = tidy(rule)
        for (i, t) in all.enumerated() where isFor(rule, t, except: except) {
            guard case .object(var entry) = t else { continue }
            if let p = rule.payee { entry["payee"] = .string(p) }
            let split: Bool = { if case .array(let parts)? = entry["splits"] { return !parts.isEmpty }; return false }()
            if let c = rule.category, !split { entry["category"] = .string(c) }
            all[i] = .object(entry)
        }
        root["transactions"] = .array(all)
        return .object(root)
    }
}
