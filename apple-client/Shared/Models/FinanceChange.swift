import Foundation

/// One change made to the household's plan on this phone, kept as what it
/// does rather than as a whole new plan (offline Finances 2 of 3, the owner's
/// "build it out", Nov 14). Made while the Homelab doesn't answer, it waits;
/// once it answers, each is replayed on the computer's newest plan, so another
/// device's changes to anything else are kept. Each is a `FinancePlanEdit`,
/// the same edit the phone sends when it's home.
///
/// A change that sets a value remembers what it was (`was`): if the
/// computer's newest has something else there and it isn't this change's own
/// value, another device changed the same thing meanwhile, and the person
/// picks which to keep (`FinanceClash`). Adding never clashes.
enum FinanceChange: Codable, Sendable, Equatable {
    case balance(account: String, to: Double, was: Double?, today: String)
    case cushion(to: Double, was: Double?)
    case budget(category: String, to: Double, was: Double?)
    case goalTarget(id: String, to: Double, was: Double?)
    case paymentAmount(id: String, to: Double, was: Double?)
    case waiting(key: String, waiting: Bool)
    case addAccount(name: String, kind: String, balance: Double, today: String)
    case addPayment(name: String, amount: Double, every: String, start: String, kind: String, from: String, estimate: Bool)
    case addGoal(name: String, target: Double, date: String?, account: String, percent: Double)
    /// Add Payment with money in, twice a month, or with each paycheck; `addPayment` stays for changes kept before it.
    case addNewPayment(NewPayment)
    /// Track from: the day the charts count from, nil for every day.
    case trackFrom(String?)
    /// Add Goal over several accounts; `addGoal` stays for changes kept before it.
    case addGoalShares(name: String, target: Double, date: String?, shares: [GoalShare])
    /// A loan's papers typed in: what it owes is read from them.
    case loanPapers(account: String, papers: LoanPapersTyped, planMonthly: Double, today: String)
    /// Add a Budget and its removal.
    case addBudget(category: String, amount: Double, perPaycheck: Bool, rollover: Bool)
    case removeBudget(category: String)
    /// Edit a Payment and its Delete.
    case editPayment(id: String, NewPayment)
    case removePayment(id: String)

    /// `plan` with this change made, or nil when it can't be (what it changes is gone).
    func apply(to plan: JSONValue) -> JSONValue? {
        switch self {
        case .balance(let account, let to, _, let today):
            FinancePlanEdit.settingBalance(of: account, to: to, today: today, in: plan)
        case .cushion(let to, _):
            FinancePlanEdit.settingCushion(to, in: plan)
        case .budget(let category, let to, _):
            FinancePlanEdit.settingBudget(category: category, to: to, in: plan)
        case .goalTarget(let id, let to, _):
            FinancePlanEdit.settingGoal(id: id, target: to, in: plan)
        case .paymentAmount(let id, let to, _):
            FinancePlanEdit.settingPayment(id: id, to: to, in: plan)
        case .waiting(let key, let waiting):
            FinancePlanEdit.settingWaiting(key, waiting: waiting, current: Self.waitingKeys(in: plan), in: plan)
        case .addAccount(let name, let kind, let balance, let today):
            FinancePlanEdit.addingAccount(name: name, kind: kind, balance: balance, today: today, in: plan)
        case .addPayment(let name, let amount, let every, let start, let kind, let from, let estimate):
            FinancePlanEdit.addingPayment(name: name, amount: amount, every: every, start: start, kind: kind,
                                          from: from, estimate: estimate, in: plan)
        case .addGoal(let name, let target, let date, let account, let percent):
            FinancePlanEdit.addingGoal(name: name, target: target, date: date, account: account, percent: percent, in: plan)
        case .addNewPayment(let p):
            FinancePlanEdit.addingPayment(p, in: plan)
        case .trackFrom(let day):
            FinancePlanEdit.settingTrackFrom(day, in: plan)
        case .addGoalShares(let name, let target, let date, let shares):
            FinancePlanEdit.addingGoal(name: name, target: target, date: date, shares: shares, in: plan)
        case .loanPapers(let account, let papers, let planMonthly, let today):
            FinancePlanEdit.settingPapers(of: account, papers, planMonthly: planMonthly, today: today, in: plan)
        case .addBudget(let category, let amount, let perPaycheck, let rollover):
            FinancePlanEdit.addingBudget(category: category, amount: amount, perPaycheck: perPaycheck, rollover: rollover, in: plan)
        case .removeBudget(let category):
            FinancePlanEdit.removingBudget(category: category, in: plan)
        case .editPayment(let id, let p):
            FinancePlanEdit.updatingPayment(id: id, with: p, in: plan)
        case .removePayment(let id):
            FinancePlanEdit.removingPayment(id: id, in: plan)
        }
    }

    /// For a change that sets a value: the value it sets, and the one it replaced.
    var setting: (to: Double, was: Double?)? {
        switch self {
        case .balance(_, let to, let was, _), .cushion(let to, let was), .budget(_, let to, let was),
             .goalTarget(_, let to, let was), .paymentAmount(_, let to, let was):
            return (to: to, was: was)
        default:
            return nil
        }
    }

    /// What `plan` holds where this change sets its value; nil for a change that adds.
    func current(in plan: JSONValue) -> Double? {
        func number(_ v: JSONValue?) -> Double? { if case .number(let n)? = v { return n }; return nil }
        func item(_ list: String, where match: (JSONValue) -> Bool) -> JSONValue? {
            guard case .array(let items)? = plan[list] else { return nil }
            return items.first(where: match)
        }
        switch self {
        case .balance(let account, _, _, _):
            return number(item("accounts") { $0["id"] == .string(account) }?["balance"])
        case .cushion:
            return number(plan["cushion"]) ?? 0
        case .budget(let category, _, _):
            let wanted = category.trimmingCharacters(in: .whitespaces).lowercased()
            return number(item("budgets") {
                if case .string(let c)? = $0["category"] { return c.trimmingCharacters(in: .whitespaces).lowercased() == wanted }
                return false
            }?["amount"])
        case .goalTarget(let id, _, _):
            return number(item("goals") { $0["id"] == .string(id) }?["target"])
        case .paymentAmount(let id, _, _):
            return number(item("payments") { $0["id"] == .string(id) }?["amount"])
        default:
            return nil
        }
    }

    /// What a change that sets a value sets: one place in the plan. Nil for one that adds.
    var target: String? {
        switch self {
        case .balance(let account, _, _, _): "balance:\(account)"
        case .cushion: "cushion"
        case .budget(let category, _, _): "budget:\(category.trimmingCharacters(in: .whitespaces).lowercased())"
        case .goalTarget(let id, _, _): "goal:\(id)"
        case .paymentAmount(let id, _, _): "payment:\(id)"
        case .waiting(let key, _): "waiting:\(key)"
        case .trackFrom: "trackFrom"
        case .loanPapers(let account, _, _, _): "papers:\(account)"
        // A removal takes the place of a change to the same budget's amount.
        case .removeBudget(let category): "budget:\(category.trimmingCharacters(in: .whitespaces).lowercased())"
        // An edit or a delete takes the place of a change to the same payment's amount.
        case .editPayment(let id, _), .removePayment(let id): "payment:\(id)"
        default: nil
        }
    }

    /// The same change, remembering `was` as what it replaced.
    func with(was: Double?) -> FinanceChange {
        switch self {
        case .balance(let account, let to, _, let today): .balance(account: account, to: to, was: was, today: today)
        case .cushion(let to, _): .cushion(to: to, was: was)
        case .budget(let category, let to, _): .budget(category: category, to: to, was: was)
        case .goalTarget(let id, let to, _): .goalTarget(id: id, to: to, was: was)
        case .paymentAmount(let id, let to, _): .paymentAmount(id: id, to: to, was: was)
        default: self
        }
    }

    /// The same change, remembering what `plan` held there before it.
    func noting(_ plan: JSONValue) -> FinanceChange { with(was: current(in: plan)) }

    /// `changes` with `change` made after them. A change to what an earlier
    /// one already changed takes its place, keeping what was there before
    /// either, so the two are one change, never a clash with itself.
    static func adding(_ change: FinanceChange, to changes: [FinanceChange]) -> [FinanceChange] {
        var out = changes
        if let target = change.target, let i = out.firstIndex(where: { $0.target == target }) {
            out[i] = change.setting == nil ? change : change.with(was: out[i].setting?.was)
        } else {
            out.append(change)
        }
        return out
    }

    /// The keys waiting now in a plan as the computer keeps it (`waiting`).
    static func waitingKeys(in plan: JSONValue) -> [String] {
        guard case .array(let keys)? = plan["waiting"] else { return [] }
        return keys.compactMap { if case .string(let k) = $0 { return k }; return nil }
    }

    static func same(_ a: Double?, _ b: Double?) -> Bool {
        switch (a, b) {
        case (nil, nil): true
        case (let x?, let y?): abs(x - y) < 0.005
        default: false
        }
    }
}

/// A change made away that another device also made, to the same thing,
/// differently: which to keep is the person's.
struct FinanceClash: Sendable, Equatable, Identifiable {
    /// Its place among the changes that waited.
    let index: Int
    let change: FinanceChange
    /// What the computer's newest has there.
    let theirs: Double?
    var id: Int { index }
}

/// The changes made away, replayed on the computer's newest plan.
enum FinanceReplay {
    struct Result: Sendable, Equatable {
        /// The newest plan with the changes made (all of them, but a clash not yet decided, and any that can't be made).
        let plan: JSONValue
        /// Changes another device made differently, not decided yet.
        let clashes: [FinanceClash]
        /// Changes that couldn't be made: what they change is gone on the computer.
        let dropped: [Int]
    }

    /// `changes` made in order on `newest`. A clash is made only where
    /// `keepMine` says so, and left out where it says to keep theirs.
    static func replay(_ changes: [FinanceChange], on newest: JSONValue, keepMine: [Int: Bool] = [:]) -> Result {
        var plan = newest
        var clashes: [FinanceClash] = []
        var dropped: [Int] = []
        for (i, change) in changes.enumerated() {
            if let set = change.setting {
                let now = change.current(in: newest)
                // Gone there (deleted on another device) is no clash: it can't be made, and is left out below.
                let changedThere = now != nil && !FinanceChange.same(now, set.was) && !FinanceChange.same(now, set.to)
                if changedThere {
                    switch keepMine[i] {
                    case nil: clashes.append(FinanceClash(index: i, change: change, theirs: now)); continue
                    case false?: continue
                    case true?: break
                    }
                }
            }
            if let next = change.apply(to: plan) { plan = next } else { dropped.append(i) }
        }
        return Result(plan: plan, clashes: clashes, dropped: dropped)
    }
}
