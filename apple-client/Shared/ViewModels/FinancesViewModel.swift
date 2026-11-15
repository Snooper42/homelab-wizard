import Foundation
import Observation

/// Finances, for a device the computer lets see them. It's kept apart from
/// everything else: the computer checks the level on every call, and
/// amounts stay hidden on this screen until the person shows them. Showing
/// them resets on lock, because this object belongs to the dashboard.
@MainActor
@Observable
final class FinancesViewModel {
    private(set) var money: MoneyCard?
    private(set) var error: String?
    private(set) var isLoading = false
    private(set) var plan: FinancesPlanView?
    /// The household's own pictures for a logo, from the plan, for every
    /// LogoCircle (the dashboard puts them in the environment).
    private(set) var ownLogos = OwnLogos()
    /// The plan as the computer sent it, for an edit to send back whole.
    @ObservationIgnored private var rawPlan: JSONValue?
    private(set) var isSaving = false
    private(set) var saveError: String?
    private(set) var savedCount = 0
    private(set) var planError: String?
    private(set) var isLoadingPlan = false
    /// On a household member's phone: the household's money shared with them.
    private(set) var shared: HouseholdShared?
    private(set) var ledger: FinanceLedger?
    @ObservationIgnored private var rawLedger: JSONValue?
    private(set) var ledgerError: String?
    private(set) var isLoadingLedger = false
    /// Amounts show only after a tap, and hide again on lock.
    var amountsShown = false
    /// Which transactions this phone has seen (TransactionsSeen); nil
    /// before the first look, or without this device's key.
    private(set) var seenTransactions: TransactionsSeen? = TransactionsSeen.load()
    @ObservationIgnored private let seenKey = ChangeMemory.deviceKey()

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let device: @MainActor () -> DeviceInfo?
    @ObservationIgnored private let authorize: @MainActor (String) async -> Bool

    // MARK: Offline (the owner, Nov 13)

    /// The Finances kept on this device for when the Homelab doesn't answer.
    @ObservationIgnored private let offline: OfflineFinances
    /// What was kept, read once (in memory only while unlocked, as the rest is).
    @ObservationIgnored private var kept: OfflineFinances.Kept?
    @ObservationIgnored private var keptRead = false
    /// The level the kept Finances were read at: what this device may see
    /// while the Homelab can't say (right after unlock, or offline).
    private(set) var keptLevel: FinancesLevel = .none
    /// When the Finances shown were read, while they're the kept ones
    /// because the Homelab doesn't answer; nil when they're live.
    private(set) var offlineAsOf: Date?
    // MARK: Changes made away (offline Finances 2 of 3, the owner, Nov 14)

    /// The changes made while the Homelab didn't answer, kept sealed (`AwayChanges`).
    @ObservationIgnored private let away: AwayChanges
    @ObservationIgnored private var awayRead = false
    /// What waits to be sent, in the order made: the plan's, and the ledger's.
    private(set) var awayChanges: [FinanceChange] = []
    private(set) var awayLedger: [LedgerChange] = []
    /// How many changes wait, the plan's and the ledger's.
    var awayCount: Int { awayChanges.count + awayLedger.count }
    /// The kept plan and ledger they build on: the computer's last, with their revs.
    @ObservationIgnored private var awayBase: JSONValue?
    @ObservationIgnored private var awayLedgerBase: JSONValue?
    /// Changes another device made differently meanwhile, for the person to decide.
    private(set) var awayClashes: [FinanceClash] = []
    @ObservationIgnored private var awayDecisions: [Int: Bool] = [:]
    /// What the last send did: how many went, and how many couldn't (what they changed was gone).
    private(set) var awaySent: (sent: Int, dropped: Int)?
    /// Why the changes made away couldn't go yet; they still wait.
    private(set) var awaySendError: String?

    /// The computer's latest answers, to keep.
    @ObservationIgnored private var answers: (plan: Data?, ledger: Data?, shared: Data?) = (nil, nil, nil)
    /// The last keep or forget, so each runs after the one before: a slow
    /// keep can't bring back what a forget dropped.
    @ObservationIgnored private var keeping: Task<Void, Never>?

    init(
        api: APIClient,
        device: @escaping @MainActor () -> DeviceInfo?,
        authorize: @escaping @MainActor (String) async -> Bool,
        offline: OfflineFinances = .onThisDevice,
        privateKey: PrivateFinancesKey = PrivateFinancesKey(),
        privateOffline: PrivateOffline = .onThisDevice,
        away: AwayChanges = .onThisDevice
    ) {
        self.api = api
        self.device = device
        self.authorize = authorize
        self.offline = offline
        self.privateKey = privateKey
        self.privateOffline = privateOffline
        self.away = away
        Task { _ = await readKept() }
    }

    /// Reads what was kept, once, off the main thread.
    private func readKept() async -> OfflineFinances.Kept? {
        if keptRead { return kept }
        let offline = offline
        let read = await Task.detached(priority: .userInitiated) { offline.load() }.value
        if !keptRead {
            keptRead = true
            kept = read
            keptLevel = read?.level ?? .none
        }
        return kept
    }

    /// Keeps the latest answers, off the main thread, when they changed.
    private func keepAnswers() {
        // Her private Finances are never kept in the clear (4c-3 keeps them sealed).
        guard let plan = answers.plan, level >= .view, !isPrivate else { return }
        let toKeep = OfflineFinances.Answers(at: Date(), level: level, plan: plan, ledger: answers.ledger, shared: answers.shared)
        let offline = offline
        let before = keeping
        keeping = Task.detached(priority: .utility) {
            await before?.value
            do {
                try offline.keep(toKeep)
            } catch {
                Log.ui.error("Couldn't keep Finances for offline")
            }
        }
    }

    /// Drops the kept Finances: Finances taken from this device.
    func forgetOffline() {
        awayChanges = []
        awayLedger = []
        awayBase = nil
        awayLedgerBase = nil
        awayClashes = []
        awayDecisions = [:]
        away.forget()
        kept = nil
        keptRead = true
        keptLevel = .none
        answers = (nil, nil, nil)
        offlineAsOf = nil
        let offline = offline
        let before = keeping
        keeping = Task.detached(priority: .utility) {
            await before?.value
            offline.forget()
        }
    }

    /// Shows the kept Finances in place of the live ones, to look at only:
    /// worked out from today on this phone (`HouseholdOffline`), so what's
    /// due and what's left are today's, or as they were kept in a build
    /// without the computer's Finances code.
    private func showKept() async -> Bool {
        guard let kept = await readKept() else { return false }
        ownLogos = OwnLogos(kept.plan.view.plan.logos)
        plan = kept.plan.view
        // At the change level, changes can be made away: on the kept plan, with what already waits.
        var current = kept.plan.rawPlan
        let mayChangeAway = level >= .edit && !isPrivate && !kept.plan.view.readOnly && FinanceProjection.available
        if mayChangeAway {
            await readAway()
            awayBase = kept.plan.rawPlan
            current = awayChanges.reduce(current) { $1.apply(to: $0) ?? $0 }
        }
        var currentLedger = kept.ledger?.raw
        if mayChangeAway, let keptLedger = kept.ledger?.raw {
            awayLedgerBase = keptLedger
            currentLedger = LedgerChange.replay(awayLedger, on: keptLedger, accounts: Self.accountIDs(in: current)).ledger
        }
        // Named apart from `rawPlan` and `rawLedger`, which this sets below.
        let (workingLedger, readOnly) = (currentLedger, kept.plan.view.readOnly)
        let working = current
        let day = FinancePlanEdit.todayString()
        let worked = await Task.detached(priority: .userInitiated) {
            try? HouseholdOffline.project(rawPlan: working, rawLedger: workingLedger, today: day, readOnly: readOnly)
        }.value
        if let worked { plan = worked.view }
        rawPlan = mayChangeAway && worked != nil ? current : nil
        planError = nil
        if mayChangeAway, awayLedgerBase != nil, let currentLedger, let read = Self.ledgerRead(currentLedger) {
            // Transactions change away too (offline Finances 3 of 3), on the kept ledger with what waits.
            ledger = read.ledger
            rawLedger = currentLedger
            ledgerError = nil
        } else if ledger == nil, let kept = kept.ledger {
            ledger = kept.ledger
            rawLedger = nil
            ledgerError = nil
        }
        if shared == nil { shared = kept.shared }
        offlineAsOf = kept.at
        return true
    }

    /// The edit level, and a plan the computer didn't mark read-only, read
    /// live: never the kept one, which is only to look at.
    var canEdit: Bool { level >= .edit && plan?.readOnly == false && rawPlan != nil && offlineAsOf == nil }

    /// Away from home: the plan's changes that wait and go once the Homelab
    /// answers (a balance, the cushion, a budget, a goal's target, what a
    /// payment costs, waiting marks, an account, a payment, a goal).
    var canEditAway: Bool { offlineAsOf != nil && awayBase != nil && rawPlan != nil && level >= .edit && plan?.readOnly == false }

    /// The plan's changes, home or away (`canEdit` is home only: transactions, Investments and the rest).
    var canEditPlan: Bool { canEdit || canEditAway }

    /// Makes one of the plan's changes: saved now when the Homelab answers,
    /// else kept on this device to go once it does.
    private func make(_ change: FinanceChange, edited: JSONValue, reason: String) async -> Bool {
        if offlineAsOf == nil { return await savePlan(edited, reason: reason) }
        return await keepAway(change, edited: edited, reason: reason)
    }

    /// Keeps a change made away (asked for with Face ID, as at home), and shows it at once.
    private func keepAway(_ change: FinanceChange, edited: JSONValue, reason: String) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        guard await authorize(reason) else { return false }
        let changes = FinanceChange.adding(change, to: awayChanges)
        do {
            try away.keep(changes, ledger: awayLedger)
        } catch {
            saveError = "This device couldn't keep the change. Try again once the Homelab answers."
            return false
        }
        awayChanges = changes
        rawPlan = edited
        await showWorked(edited)
        saveError = nil
        savedCount += 1
        return true
    }

    /// The plan worked out on this phone from `raw`, shown.
    private func showWorked(_ raw: JSONValue) async {
        let (keptLedger, readOnly, day) = (rawLedger ?? kept?.ledger?.raw, plan?.readOnly ?? false, FinancePlanEdit.todayString())
        let worked = await Task.detached(priority: .userInitiated) {
            try? HouseholdOffline.project(rawPlan: raw, rawLedger: keptLedger, today: day, readOnly: readOnly)
        }.value
        if let worked { plan = worked.view }
    }

    /// Takes back a change that waits.
    func undoAway(at index: Int) async {
        guard awayChanges.indices.contains(index), let base = awayBase else { return }
        var changes = awayChanges
        changes.remove(at: index)
        do { try away.keep(changes, ledger: awayLedger) } catch { return }
        awayChanges = changes
        let raw = changes.reduce(base) { $1.apply(to: $0) ?? $0 }
        rawPlan = raw
        await showWorked(raw)
    }

    /// Reads what waits, once.
    private func readAway() async {
        guard !awayRead else { return }
        let away = away
        let read = await Task.detached(priority: .userInitiated) { away.load() }.value
        if !awayRead {
            awayRead = true
            awayChanges = read.plan
            awayLedger = read.ledger
        }
    }

    /// Once the Homelab answers: the changes made away, replayed on its
    /// newest plan and saved once. Each was asked for with Face ID when it
    /// was made, so this doesn't ask again. A clash waits for the person;
    /// a failed save keeps them waiting.
    private func sendAway(on newest: FinancesRead) async {
        await readAway()
        guard !awayChanges.isEmpty || !awayLedger.isEmpty, level >= .edit, !isPrivate else { return }
        isSaving = true
        defer { isSaving = false }
        var sent = 0, dropped = 0
        var planRaw = newest.rawPlan
        if !awayChanges.isEmpty {
            let r = FinanceReplay.replay(awayChanges, on: newest.rawPlan, keepMine: awayDecisions)
            guard r.clashes.isEmpty else {
                awayClashes = r.clashes
                return
            }
            do {
                let read = try await api.saveFinances(r.plan)
                ownLogos = OwnLogos(read.view.plan.logos)
                plan = read.view
                rawPlan = read.rawPlan
                planRaw = read.rawPlan
                answers.plan = read.answer
                keepAnswers()
                sent += awayChanges.count - r.dropped.count
                dropped += r.dropped.count
                awayChanges = []
                awayDecisions = [:]
                awayClashes = []
                try? away.keep([], ledger: awayLedger)
            } catch {
                Log.ui.error("Sending the changes made away failed: \(APIError.from(error).logName, privacy: .public)")
                awaySendError = Self.words(error)
                return
            }
        }
        if !awayLedger.isEmpty {
            do {
                let newestLedger = try await api.financesLedger()
                let r = LedgerChange.replay(awayLedger, on: newestLedger.raw, accounts: Self.accountIDs(in: planRaw))
                let read = try await api.saveFinancesLedger(r.ledger)
                ledger = read.ledger
                rawLedger = read.raw
                answers.ledger = read.answer
                keepAnswers()
                sent += awayLedger.count - r.dropped.count
                dropped += r.dropped.count
                awayLedger = []
            } catch {
                Log.ui.error("Sending the transactions changed away failed: \(APIError.from(error).logName, privacy: .public)")
                awaySendError = Self.words(error)
                if sent > 0 { awaySent = (sent: sent, dropped: dropped) }
                return
            }
        }
        awaySent = (sent: sent, dropped: dropped)
        awaySendError = nil
        away.forget()
    }

    /// The plan's account ids, for a transaction's account.
    nonisolated static func accountIDs(in raw: JSONValue) -> Set<String> {
        guard case .array(let accounts)? = raw["accounts"] else { return [] }
        return Set(accounts.compactMap { if case .string(let id)? = $0["id"] { return id }; return nil })
    }

    /// A ledger as the computer would have answered `FinancesLedger`.
    nonisolated static func ledgerRead(_ raw: JSONValue) -> LedgerRead? {
        guard let data = try? JSONEncoder().encode(JSONValue.object(["result": raw])) else { return nil }
        return try? APIClient.ledgerRead(from: data)
    }

    /// Makes one of the ledger's changes: saved now when the Homelab answers, else kept to go once it does.
    private func makeLedger(_ change: LedgerChange, edited: JSONValue, reason: String) async -> Bool {
        await makeLedger([change], edited: edited, reason: reason)
    }

    private func makeLedger(_ made: [LedgerChange], edited: JSONValue, reason: String) async -> Bool {
        if offlineAsOf == nil { return await saveLedger(edited, reason: reason) }
        isSaving = true
        defer { isSaving = false }
        guard await authorize(reason) else { return false }
        let changes = made.reduce(awayLedger) { LedgerChange.adding($1, to: $0) }
        do {
            try away.keep(awayChanges, ledger: changes)
        } catch {
            saveError = "This device couldn't keep the change. Try again once the Homelab answers."
            return false
        }
        awayLedger = changes
        rawLedger = edited
        if let read = Self.ledgerRead(edited) { ledger = read.ledger }
        if let raw = rawPlan { await showWorked(raw) }
        saveError = nil
        savedCount += 1
        return true
    }

    /// Takes back a transaction's change that waits.
    func undoAwayLedger(at index: Int) async {
        guard awayLedger.indices.contains(index), let base = awayLedgerBase else { return }
        var changes = awayLedger
        changes.remove(at: index)
        do { try away.keep(awayChanges, ledger: changes) } catch { return }
        awayLedger = changes
        let raw = LedgerChange.replay(changes, on: base, accounts: Self.accountIDs(in: rawPlan ?? .object([:]))).ledger
        rawLedger = raw
        if let read = Self.ledgerRead(raw) { ledger = read.ledger }
        if let plan = rawPlan { await showWorked(plan) }
    }

    /// The person's pick for a clash: this device's change, or the other device's.
    func decide(_ clash: FinanceClash, keepMine: Bool) async {
        awayDecisions[clash.index] = keepMine
        awayClashes.removeAll { $0.id == clash.id }
        if awayClashes.isEmpty { await loadPlan() }
    }

    /// Done with "Sent 2 changes".
    func dismissAwaySent() { awaySent = nil }

    /// Marks a paycheck or payment as not in the balances yet, or back.
    func setWaiting(_ past: FinancePast, waiting: Bool) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan, let plan, past.waiting != waiting else { return false }
        guard let edited = FinancePlanEdit.settingWaiting(past.key, waiting: waiting, current: plan.waitingKeys, in: raw) else {
            saveError = "That can't be marked."
            return false
        }
        return await make(.waiting(key: past.key, waiting: waiting), edited: edited,
                          reason: waiting ? "Mark it as not in the balances yet." : "Mark it as in the balances.")
    }

    /// Turns Hide amounts on or off for every device. Returns whether it saved.
    func setHideAmounts(_ hide: Bool) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan,
              let edited = FinancePlanEdit.settingHideAmounts(hide, in: raw)
        else { return false }
        if hide { amountsShown = false }
        let saved = await savePlan(edited, reason: hide ? "Hide amounts on every device." : "Show amounts on every device.")
        // The money card follows the plan's setting: read it again.
        if saved { await load() }
        return saved
    }

    /// Changes a goal's target. Returns whether it saved.
    func setGoal(_ goal: FinanceGoal, target: Double) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.settingGoal(id: goal.id, target: target, in: raw) else {
            saveError = "A goal needs an amount more than nothing."
            return false
        }
        return await make(FinanceChange.goalTarget(id: goal.id, to: target, was: nil).noting(raw), edited: edited,
                          reason: "Change the \(goal.name) goal.")
    }

    /// Changes what a planned payment costs each time. Returns whether it saved.
    func setPayment(_ payment: FinancePayment, to amount: Double) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        guard payment.canChangeAmount,
              let edited = FinancePlanEdit.settingPayment(id: payment.id, to: amount, in: raw)
        else {
            saveError = payment.canChangeAmount ? "A payment needs an amount more than nothing." : "A card payoff is changed on the computer."
            return false
        }
        return await make(FinanceChange.paymentAmount(id: payment.id, to: amount, was: nil).noting(raw), edited: edited,
                          reason: "Change what \(payment.name) costs.")
    }

    /// Changes the least checking should hold (0 turns the warning off). Returns whether it saved.
    func setCushion(_ amount: Double) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.settingCushion(amount, in: raw) else {
            saveError = "The cushion is an amount, or nothing."
            return false
        }
        return await make(FinanceChange.cushion(to: amount, was: nil).noting(raw), edited: edited, reason: "Change the cushion.")
    }

    /// Adds an account to the plan: a member's own, or the household's.
    /// Returns whether it saved.
    func addAccount(name: String, kind: String, balance: Double) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        let today = plan.map(\.todayText).flatMap { $0.isEmpty ? nil : $0 } ?? FinancePlanEdit.todayString()
        guard let edited = FinancePlanEdit.addingAccount(name: name, kind: kind, balance: balance, today: today, in: raw) else {
            saveError = "An account needs a name, and a balance that's an amount."
            return false
        }
        return await make(.addAccount(name: name, kind: kind, balance: balance, today: today), edited: edited,
                          reason: "Add \(name.trimmingCharacters(in: .whitespaces)) to Finances.")
    }

    /// Adds a payment to the plan, as the computer's Add a payment does
    /// (`FinancePlanEdit.addingPayment`). Returns whether it saved.
    func addPayment(name: String, amount: Double, every: String, start: Date, kind: String,
                    from: String, estimate: Bool) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        let day = FinancePlanEdit.todayString(start)
        guard let edited = FinancePlanEdit.addingPayment(name: name, amount: amount, every: every,
                                                         start: day, kind: kind,
                                                         from: from, estimate: estimate, in: raw) else {
            saveError = "A payment needs a name, and what it costs: an amount more than nothing."
            return false
        }
        return await make(.addPayment(name: name, amount: amount, every: every, start: day, kind: kind, from: from, estimate: estimate),
                          edited: edited, reason: "Add \(name.trimmingCharacters(in: .whitespaces)) to Finances.")
    }

    /// How much of an account the plan's goals don't count yet, in percent.
    func goalShareLeft(of account: String) -> Double {
        guard let raw = rawPlan else { return 0 }
        return max(0, 100 - FinancePlanEdit.goalShareGiven(of: account, in: raw))
    }

    /// Adds a goal to the plan, as the computer's Add a goal does
    /// (`FinancePlanEdit.addingGoal`). Returns whether it saved.
    func addGoal(name: String, target: Double, by date: Date?, account: String, percent: Double) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        let day = date.map { FinancePlanEdit.todayString($0) }
        guard let edited = FinancePlanEdit.addingGoal(name: name, target: target, date: day,
                                                      account: account, percent: percent, in: raw) else {
            saveError = "A goal needs a name, what it needs, and a share of an account that's still free."
            return false
        }
        return await make(.addGoal(name: name, target: target, date: day, account: account, percent: percent),
                          edited: edited, reason: "Add \(name.trimmingCharacters(in: .whitespaces)) to Finances.")
    }

    /// Changes a budget's amount. Returns whether it saved.
    func setBudget(_ budget: FinanceBudget, to amount: Double) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.settingBudget(category: budget.category, to: amount, in: raw) else {
            saveError = "A budget is an amount more than nothing."
            return false
        }
        return await make(FinanceChange.budget(category: budget.category, to: amount, was: nil).noting(raw), edited: edited,
                          reason: "Change the \(budget.category) budget.")
    }

    private func savePlan(_ edited: JSONValue, reason: String) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        guard await authorize(reason) else { return false }
        do {
            let read: FinancesRead
            if let store = openedPrivate {
                read = try await store.saveFinances(edited)
                touchPrivate()
            } else {
                read = try await api.saveFinances(edited)
            }
            ownLogos = OwnLogos(read.view.plan.logos)
            plan = read.view
            rawPlan = read.rawPlan
            answers.plan = read.answer
            keepAnswers()
            saveError = nil
            savedCount += 1
            return true
        } catch {
            Log.ui.error("SaveFinances failed: \(APIError.from(error).logName, privacy: .public)")
            saveError = Self.words(error)
            await loadPlan()
            return false
        }
    }

    // MARK: Investments, from Ghostfolio (main #494, #498)

    /// What Read Now last said, or why it couldn't read, and Ghostfolio's
    /// accounts nothing here matched.
    private(set) var investmentsSaid: String?
    private(set) var investmentsProblem: String?
    private(set) var investmentsUnmatched: [String] = []
    private(set) var isReadingInvestments = false

    /// Reads Ghostfolio now, as the computer's Read Now does. It keeps what
    /// each account holds in the plan, so it asks first, as any change does.
    func readInvestments() async {
        guard canEdit, !isReadingInvestments, !isSaving else { return }
        guard await authorize("Read the investments from Ghostfolio.") else { return }
        isReadingInvestments = true
        defer { isReadingInvestments = false }
        do {
            apply(try await api.financesReadInvestments())
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("FinancesReadInvestments failed: \(apiError.logName, privacy: .public)")
            investmentsSaid = nil
            investmentsProblem = "Couldn't read Ghostfolio: \(apiError.errorDescription ?? "no answer")"
        }
    }

    /// What the last Update Prices said, under the Collection.
    private(set) var pricesSaid: String?
    private(set) var isUpdatingPrices = false

    /// Update Prices: the computer reads TCGplayer's prices from TCGdex. It
    /// changes the plan, so it asks first, as any change does.
    func updatePrices() async {
        guard canEdit, !isUpdatingPrices, !isSaving else { return }
        guard await authorize("Update the Collection's prices from TCGdex.") else {
            pricesSaid = "Not confirmed, so nothing was read."
            return
        }
        isUpdatingPrices = true
        defer { isUpdatingPrices = false }
        do {
            pricesSaid = try await api.updateCardPrices().words
            await loadPlan()
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("FinancesUpdatePrices failed: \(apiError.logName, privacy: .public)")
            pricesSaid = apiError.errorDescription ?? "TCGdex didn't answer, so no price changed."
        }
    }

    /// The cards' pictures read so far, by name, while the app is unlocked.
    @ObservationIgnored private var cardPictures: [String: Data] = [:]

    /// A card's picture's bytes, read from the computer once.
    func cardPicture(_ name: String) async -> Data? {
        if let kept = cardPictures[name] { return kept }
        guard canSeePlan, let url = try? await api.cardPicture(named: name), let data = FinanceCollected.pictureData(url) else { return nil }
        cardPictures[name] = data
        return data
    }

    /// Each card's prices over time, by its id; none when the computer has none.
    func cardPrices() async -> [String: [FinancePoint]] {
        guard canSeePlan else { return [:] }
        return (try? await api.cardPrices()) ?? [:]
    }

    /// Adds a card to the Collection (`id` nil) or changes one, after Face
    /// ID. Returns whether it saved.
    func saveCard(id: String?, _ draft: CardDraft) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        if let problem = FinancePlanEdit.cardProblem(draft) {
            saveError = problem
            return false
        }
        guard let edited = FinancePlanEdit.settingCard(id: id, to: draft, today: FinancePlanEdit.todayString(), in: raw) else {
            saveError = "That card is no longer in the Collection."
            return false
        }
        let name = draft.name.trimmingCharacters(in: .whitespacesAndNewlines)
        return await savePlan(edited, reason: id == nil ? "Add \(name) to the Collection." : "Change \(name) in the Collection.")
    }

    /// Takes a card out of the Collection, after Face ID. Returns whether it saved.
    func removeCard(_ card: FinanceCollected) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.removingCard(id: card.id, in: raw) else {
            saveError = "That card is no longer in the Collection."
            return false
        }
        return await savePlan(edited, reason: "Remove \(card.name) from the Collection.")
    }

    /// Keeps a card's own photo on the computer, made small here (800
    /// pixels, a JPEG with no location or camera), after Face ID. Returns
    /// the name the computer gives it, for the card to save with.
    func attachCardPhoto(_ data: Data) async -> String? {
        guard canEdit, !isSaving else { return nil }
        isSaving = true
        defer { isSaving = false }
        guard await authorize("Keep a photo of a card in your Finances.") else { return nil }
        guard let url = await Task.detached(priority: .userInitiated, operation: { ReceiptCodec.preparePhoto(data, pixels: CardDraft.photoPixels) }).value else {
            saveError = "That picture couldn't be used for the card."
            return nil
        }
        do {
            let name = try await api.saveCardPicture(dataURL: url)
            if let shown = FinanceCollected.pictureData(url) { cardPictures[name] = shown }
            return name
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("SaveFinancesCardPicture failed: \(apiError.logName, privacy: .public)")
            saveError = apiError.errorDescription
            return nil
        }
    }

    /// What Ghostfolio finds for a ticker or a name.
    func findSymbols(_ query: String) async throws -> [InvestmentSymbol] {
        guard canEdit else { return [] }
        return try await api.financesFindSymbol(query)
    }

    /// Follows a ticker (the Watchlist), after Face ID. Returns why not, in
    /// words, or nil when it was kept.
    func follow(_ symbol: InvestmentSymbol) async -> String? {
        guard canEdit, !isSaving else { return "This device can't change Finances." }
        isSaving = true
        defer { isSaving = false }
        guard await authorize("Follow \(symbol.symbol) in the Watchlist.") else { return "Not confirmed, so nothing was kept." }
        do {
            let read = try await api.financesFollow(symbol)
            ownLogos = OwnLogos(read.view.plan.logos)
            plan = read.view
            rawPlan = read.rawPlan
            savedCount += 1
            return nil
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("FinancesFollow failed: \(apiError.logName, privacy: .public)")
            return apiError.errorDescription ?? "Ghostfolio didn't take it."
        }
    }

    /// Takes a ticker off the Watchlist. Returns whether it saved.
    func unfollow(_ symbol: String) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan, let edited = FinancePlanEdit.removingWatched(symbol, in: raw) else { return false }
        return await savePlan(edited, reason: "Take \(symbol) off the Watchlist.")
    }

    /// Puts a buy or a sale into Ghostfolio and reads it again. Returns why
    /// not, in words, or nil when it was kept.
    func addInvestment(_ add: InvestmentAdd) async -> String? {
        if let problem = add.problem() { return problem }
        guard canEdit, !isSaving, let json = add.json() else { return "This device can't change Finances." }
        isSaving = true
        defer { isSaving = false }
        guard await authorize(add.sold ? "Record the sale in Ghostfolio." : "Record the buy in Ghostfolio.") else { return "Not confirmed, so nothing was kept." }
        do {
            apply(try await api.financesAddInvestment(json))
            savedCount += 1
            return nil
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("FinancesAddInvestment failed: \(apiError.logName, privacy: .public)")
            return apiError.errorDescription ?? "Ghostfolio didn't take it."
        }
    }

    // MARK: Export (Parity gap 5, the computer's F18)

    /// The plan and the year ahead, as files, from what was last read (live
    /// or kept for offline); none before Finances are read, while amounts are
    /// hidden, or for private ones (those export on their own pages).
    func exportFiles() -> [ExportFile] {
        guard !isPrivate, FinanceExport.offered(amountsShown: amountsShown, hiddenByPlan: amountsHiddenByPlan),
              let answer = answers.plan ?? kept?.plan.answer,
              let envelope = try? JSONDecoder().decode(JSONValue.self, from: answer),
              let view = envelope["result"], let plan = view["plan"]
        else { return [] }
        let today: String = { if case .string(let t)? = view["today"] { return t }; return FinancePlanEdit.todayString() }()
        var out: [ExportFile] = []
        out.append(ExportFile(title: "The Year Ahead (Spreadsheet)", name: FinanceExport.aheadName(today),
                              data: Data(FinanceExport.aheadCSV(view: view).utf8)))
        var bare = plan
        if case .object(var o) = bare { o.removeValue(forKey: "rev"); bare = .object(o) }
        if let json = FinanceExport.planJSON(bare) {
            out.append(ExportFile(title: "The Plan (JSON)", name: FinanceExport.planName(today), data: json))
        }
        return out
    }

    // MARK: A holding's buys and sales (Parity gap 5: Change or Delete a buy)

    /// The buys and sales of `symbol` in `account`, newest first, or why they couldn't be read.
    func trades(of symbol: String, in account: String) async -> Result<[InvestmentTrade], TradeProblem> {
        guard canEdit else { return .failure(TradeProblem(words: "This device can't change Finances.")) }
        do {
            return .success(try await api.financesInvestmentTrades(account: account, symbol: symbol))
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("FinancesInvestmentTrades failed: \(apiError.logName, privacy: .public)")
            return .failure(TradeProblem(words: apiError.errorDescription ?? "Ghostfolio didn't answer."))
        }
    }

    /// Puts a buy or sale right in Ghostfolio (Face ID first); nil when it was, else why not.
    func changeTrade(_ trade: InvestmentTrade) async -> String? {
        if let problem = trade.problem() { return problem }
        guard canEdit, !isSaving else { return "This device can't change Finances." }
        isSaving = true
        defer { isSaving = false }
        guard await authorize(trade.isSale ? "Change the sale in Ghostfolio." : "Change the buy in Ghostfolio.") else { return "Not confirmed, so nothing was changed." }
        do {
            apply(try await api.financesChangeInvestment(trade))
            savedCount += 1
            return nil
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("FinancesChangeInvestment failed: \(apiError.logName, privacy: .public)")
            return apiError.errorDescription ?? "Ghostfolio didn't take it."
        }
    }

    /// Deletes a buy or sale in Ghostfolio (Face ID first); nil when it was, else why not.
    func deleteTrade(_ trade: InvestmentTrade) async -> String? {
        guard canEdit, !isSaving else { return "This device can't change Finances." }
        isSaving = true
        defer { isSaving = false }
        guard await authorize(trade.isSale ? "Delete the sale in Ghostfolio." : "Delete the buy in Ghostfolio.") else { return "Not confirmed, so nothing was deleted." }
        do {
            apply(try await api.financesDeleteInvestment(account: trade.account, id: trade.id))
            savedCount += 1
            return nil
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("FinancesDeleteInvestment failed: \(apiError.logName, privacy: .public)")
            return apiError.errorDescription ?? "Ghostfolio didn't take it."
        }
    }

    struct TradeProblem: Error, Sendable { let words: String }

    private func apply(_ r: InvestmentsReadResult) {
        ownLogos = OwnLogos(r.read.view.plan.logos)
        plan = r.read.view
        rawPlan = r.read.rawPlan
        investmentsSaid = r.words()
        investmentsProblem = nil
        investmentsUnmatched = r.unmatched
    }

    // MARK: A member's private Finances (2E step 4c)

    /// Her private Finances, on a member's own phone: made once her username is known.
    @ObservationIgnored private var sealedStore: PrivateFinances?
    /// Her key, kept behind Face ID on this device once she opened them here.
    @ObservationIgnored private let privateKey: PrivateFinancesKey
    /// Her sealed Finances kept on this device for offline (never her key, never plain).
    @ObservationIgnored private let privateOffline: PrivateOffline
    /// Where her Finances are: unknown on the owner's phones and wall screens.
    private(set) var privacy: PrivateFinances.State = .unknown
    /// Why the last unlock didn't open them, in words.
    private(set) var privateError: String?
    private(set) var isUnlocking = false
    /// Whether Face ID opens them on this device (her key kept here).
    private(set) var faceIDOpens = false
    /// Whether her envelope also opens by a passphrase (made where passkeys can't lock them).
    var opensByPassphrase: Bool { sealedStore?.envelope?.kdf.passphraseSalt != nil }
    /// Locks them after 5 minutes untouched.
    @ObservationIgnored private var lockTimer: Task<Void, Never>?
    static let lockAfter: Duration = .seconds(5 * 60)

    /// Her Finances are private (locked or open) on this phone.
    var isPrivate: Bool { privacy == .locked || privacy == .open }

    private var openedPrivate: PrivateFinances? {
        guard let store = sealedStore, store.state == .open else { return nil }
        return store
    }

    /// The store for her own phone; nil on any other.
    private func privateStore() -> PrivateFinances? {
        guard let me = device(), me.isMember, let person = me.person else { return nil }
        if let store = sealedStore, store.username == person {
            store.mayChange = level >= .edit
            return store
        }
        let store = PrivateFinances(username: person, mayChange: level >= .edit, calls: api, offline: privateOffline)
        sealedStore = store
        return store
    }

    /// Her store when her Finances are private; nil while they're plain or
    /// not known (a computer from before private Finances answers plainly).
    private func privateNow() async -> PrivateFinances? {
        guard let store = privateStore() else { return nil }
        if store.state == .unknown { _ = try? await store.find() }
        syncPrivacy(store)
        return isPrivate ? store : nil
    }

    /// Asks the computer again (a plain call was refused as private).
    private func privateFound() async -> PrivateFinances? {
        guard let store = privateStore() else { return nil }
        _ = try? await store.find()
        syncPrivacy(store)
        return isPrivate ? store : nil
    }

    private func syncPrivacy(_ store: PrivateFinances) {
        let was = isPrivate
        privacy = store.state
        faceIDOpens = isPrivate && privateKey.has(for: store.username)
        // Turned private: no plain copy of hers stays on this device.
        if isPrivate, !was { forgetOffline() }
    }

    private func showPrivatePlan(_ store: PrivateFinances) {
        offlineAsOf = nil
        guard store.state == .open else {
            plan = nil
            rawPlan = nil
            ownLogos = OwnLogos()
            planError = nil
            return
        }
        do {
            let read = try store.finances()
            ownLogos = OwnLogos(read.view.plan.logos)
            plan = read.view
            rawPlan = read.rawPlan
            planError = nil
            touchPrivate()
        } catch {
            plan = nil
            rawPlan = nil
            planError = Self.words(error)
        }
    }

    private func showPrivateLedger(_ store: PrivateFinances) {
        guard store.state == .open, let read = try? store.financesLedger() else {
            ledger = nil
            rawLedger = nil
            ledgerError = nil
            return
        }
        ledger = read.ledger
        rawLedger = read.raw
        ledgerError = nil
        noteSeen(in: read.ledger)
    }

    /// Opens them with the 16 words of her recovery code; keepForFaceID
    /// keeps her key behind Face ID on this device. Returns whether they opened.
    func unlockPrivate(words: String, keepForFaceID: Bool) async -> Bool {
        await unlockPrivate(keepForFaceID: keepForFaceID) { try await $0.unlock(words: words) }
    }

    /// Opens them with her passphrase.
    func unlockPrivate(passphrase: String, keepForFaceID: Bool) async -> Bool {
        await unlockPrivate(keepForFaceID: keepForFaceID) { try await $0.unlock(passphrase: passphrase) }
    }

    /// A member's own phone that may change her Finances, while they're
    /// plain: it may make them private.
    var canMakePrivate: Bool { isMember && privacy == .plain && canEdit }

    /// Makes her Finances private (private-finances.md 3.3), once she has
    /// written her recovery code down and typed two of its words back:
    /// each plain receipt sealed and kept, then her plan and ledger sealed
    /// and kept as new, and only then her plain files removed by the
    /// computer. Her passphrase opens them too (where passkeys can't);
    /// keepForFaceID keeps her key behind Face ID on this device. After Face
    /// ID, as any change. Returns whether they're private now.
    func makePrivate(code: Data, passphrase: String, keepForFaceID: Bool) async -> Bool {
        guard canMakePrivate, !isSaving, let store = privateStore() else { return false }
        if rawLedger == nil { await loadLedger() }
        guard let rawPlan, let rawLedger else {
            privateError = "Your Finances couldn’t be read just now, so nothing was changed. Try again in a moment."
            return false
        }
        isSaving = true
        defer { isSaving = false }
        guard await authorize("Make your Finances private.") else { return false }
        let api = api
        do {
            try await store.turnOn(plan: rawPlan, ledger: rawLedger, code: code, passphrase: passphrase) { name in
                try await api.receipt(named: name)
            }
        } catch {
            Log.ui.error("Making Finances private failed: \(APIError.from(error).logName, privacy: .public)")
            privateError = Self.words(error)
            return false
        }
        privateError = nil
        if keepForFaceID, let raw = store.openedKey {
            let keeper = privateKey, who = store.username
            _ = await Task.detached(priority: .utility) { try? keeper.keep(raw, for: who) }.value
        }
        syncPrivacy(store)
        showPrivatePlan(store)
        showPrivateLedger(store)
        planPrivateReminders()
        savedCount += 1
        return true
    }

    /// Turns privacy off, once she has confirmed: her Finances kept plain on
    /// the Homelab again, her receipts with them, and her key gone from this
    /// device. After Face ID. Returns whether they're plain now.
    func turnPrivacyOff() async -> Bool {
        guard let store = openedPrivate, store.mayChange, !isSaving else { return false }
        isSaving = true
        defer { isSaving = false }
        guard await authorize("Turn privacy off for your Finances.") else { return false }
        let pictures: [String: String]
        do {
            pictures = try await store.turnOff()
        } catch {
            Log.ui.error("Turning privacy off failed: \(APIError.from(error).logName, privacy: .public)")
            saveError = Self.words(error)
            return false
        }
        privateKey.forget()
        lockTimer?.cancel()
        syncPrivacy(store)
        // The computer sends her reminders again: this device's own go.
        await PrivateReminders.cancel()
        // Her receipts, kept plain again and named by the ledger.
        if !pictures.isEmpty {
            do {
                var names: [String: String] = [:]
                for (id, url) in pictures { names[id] = try await api.saveReceipt(dataURL: url) }
                let read = try await api.financesLedger()
                if case .object(var o) = read.raw, case .array(let ts)? = o["transactions"] {
                    o["transactions"] = .array(ts.map { (t: JSONValue) -> JSONValue in
                        guard case .object(var row) = t, case .string(let id)? = row["id"], let name = names[id] else { return t }
                        row["receipt"] = .string(name)
                        return .object(row)
                    })
                    _ = try await api.saveFinancesLedger(.object(o))
                }
            } catch {
                Log.ui.error("A receipt wasn't kept again: \(APIError.from(error).logName, privacy: .public)")
                saveError = "Your Finances are plain again, but a receipt couldn’t be kept with them. Add it again from its transaction."
            }
        }
        plan = nil
        rawPlan = nil
        ledger = nil
        rawLedger = nil
        await loadPlan()
        await loadLedger()
        savedCount += 1
        return true
    }

    /// Opens them with the key kept behind Face ID on this device.
    func unlockPrivateWithFaceID() async -> Bool {
        guard let store = privateStore() else { return false }
        let keeper = privateKey, who = store.username
        let raw = await Task.detached(priority: .userInitiated) { keeper.read(for: who, reason: "Open your private Finances.") }.value
        guard let raw else {
            privateError = "Face ID didn’t open them. Use your passphrase or recovery code instead."
            return false
        }
        return await unlockPrivate(keepForFaceID: false) { store in
            do {
                try await store.unlock(key: raw)
            } catch PrivateSeal.Problem.notTheirs {
                // Made private again elsewhere, with a new key: this one goes.
                keeper.forget()
                throw Problem.faceIDStale
            }
        }
    }

    private func unlockPrivate(keepForFaceID: Bool, _ open: (PrivateFinances) async throws -> Void) async -> Bool {
        guard let store = privateStore(), !isUnlocking else { return false }
        isUnlocking = true
        defer { isUnlocking = false }
        do {
            try await open(store)
        } catch {
            privateError = Self.words(error)
            syncPrivacy(store)
            return false
        }
        privateError = nil
        if keepForFaceID, store.state == .open, let raw = store.openedKey {
            let keeper = privateKey, who = store.username
            _ = await Task.detached(priority: .utility) { try? keeper.keep(raw, for: who) }.value
        }
        syncPrivacy(store)
        showPrivatePlan(store)
        showPrivateLedger(store)
        planPrivateReminders()
        return store.state == .open
    }

    /// Locks her private Finances: the key and her plain Finances leave this
    /// phone's memory. On leaving Finances, after 5 minutes untouched, and with
    /// the app (which drops everything when it goes to the background).
    func lockPrivate() {
        lockTimer?.cancel()
        lockTimer = nil
        guard let store = openedPrivate else { return }
        store.lock()
        syncPrivacy(store)
        plan = nil
        rawPlan = nil
        ownLogos = OwnLogos()
        ledger = nil
        rawLedger = nil
        amountsShown = false
    }

    /// While the Homelab doesn't answer: when her private Finances shown were last read.
    var privateAwaySince: Date? { sealedStore?.awaySince }
    /// Her changes made away, waiting to be sent.
    var privateWaiting: Int { sealedStore?.waiting ?? 0 }
    /// What happened away, in words (another of her devices saved first).
    var privateNotice: String? { sealedStore?.notice }

    /// Tries the Homelab again for her private Finances: what waits goes, and the newest is shown.
    func privateComeHome() async {
        guard let store = sealedStore else { return }
        await store.comeHome()
        syncPrivacy(store)
        if store.state == .open {
            showPrivatePlan(store)
            showPrivateLedger(store)
        } else if !isPrivate {
            await loadPlan()
        }
    }

    /// Plans her reminders for the next two weeks as this device's own
    /// notifications, from her own Finances (PrivateReminders): the computer
    /// can't read them to send its nightly ones. Today's are shown once a day.
    func planPrivateReminders(now: Date = Date(), defaults: UserDefaults = .standard) {
        guard let store = openedPrivate, FinanceProjection.available, PrivateReminders.canNotify else { return }
        let today = FinancePlanEdit.todayString(now)
        let planned = PrivateReminders.planned(store.reminders(days: PrivateReminders.days, from: now),
                                               today: today, shownDay: defaults.string(forKey: PrivateReminders.shownKey))
        Task {
            guard !planned.isEmpty, await LocalAlerts.ask() else { return }
            await PrivateReminders.schedule(planned)
            if planned.contains(where: { $0.at == nil }) { defaults.set(today, forKey: PrivateReminders.shownKey) }
        }
    }

    /// Her private Finances were used: the 5 minutes start again.
    func touchPrivate() {
        guard openedPrivate != nil else { return }
        lockTimer?.cancel()
        lockTimer = Task { [weak self] in
            try? await Task.sleep(for: FinancesViewModel.lockAfter)
            guard !Task.isCancelled else { return }
            self?.lockPrivate()
        }
    }

    /// What the app itself says about her private Finances.
    enum Problem: Error, LocalizedError {
        case faceIDStale

        var errorDescription: String? {
            switch self {
            case .faceIDStale: "Face ID’s key no longer opens them: they were made private again on another device. Use your recovery code, and Face ID opens them again after."
            }
        }
    }

    /// An error in the words to show: her private Finances' own, or the computer's.
    nonisolated static func words(_ error: Error) -> String? {
        if let e = error as? PrivateFinances.Problem { return e.errorDescription }
        if let e = error as? PrivateSeal.Problem { return e.errorDescription }
        if let e = error as? Problem { return e.errorDescription }
        if let e = error as? FinanceProjection.Failed { return e.errorDescription }
        return APIError.from(error).errorDescription
    }

    /// The computer refusing a plain Finances call because hers are private (cmd/homelab's errPrivate).
    nonisolated static func isPrivateRefusal(_ error: APIError) -> Bool {
        if case .server(_, let message?) = error { return message.contains("Finances are private") }
        return false
    }

    /// Types in an account's balance, as on the computer. Returns whether it saved.
    func setBalance(of account: FinanceAccount, to value: Double) async -> Bool {
        guard canEditPlan, !isSaving, let raw = rawPlan else { return false }
        let today = FinancePlanEdit.todayString()
        guard let edited = FinancePlanEdit.settingBalance(of: account.id, to: value, today: today, in: raw) else {
            saveError = "That isn't an amount the plan can take."
            return false
        }
        return await make(FinanceChange.balance(account: account.id, to: value, was: nil, today: today).noting(raw), edited: edited,
                          reason: "Update \(account.name)'s balance.")
    }

    /// What the computer says this device may see; while it can't say, the
    /// level the kept Finances were read at.
    var level: FinancesLevel {
        if let device = device() { return FinancesLevel(device.finances) }
        return keptLevel
    }
    var canSeeMoney: Bool { level >= .card }
    var canSeePlan: Bool { level >= .view }

    /// Hide amounts in the plan: every device follows it.
    var amountsHiddenByPlan: Bool { plan?.plan.hideAmounts ?? money?.hidden ?? false }

    func loadLedger() async {
        guard canSeePlan, !isLoadingLedger else { return }
        isLoadingLedger = true
        defer { isLoadingLedger = false }
        if let store = await privateNow() {
            showPrivateLedger(store)
            return
        }
        do {
            let read = try await api.financesLedger()
            ledger = read.ledger
            rawLedger = read.raw
            ledgerError = nil
            noteSeen(in: read.ledger)
            answers.ledger = read.answer
            keepAnswers()
        } catch {
            let apiError = APIError.from(error)
            if OfflineFinances.showsKept(after: apiError), let kept = await readKept()?.ledger {
                ledger = kept.ledger
                rawLedger = nil
                ledgerError = nil
                return
            }
            if case .forbidden = apiError {
                ledger = nil
                rawLedger = nil
            }
            Log.ui.error("Ledger failed: \(apiError.logName, privacy: .public)")
            ledgerError = apiError.errorDescription
        }
    }

    /// Whether a transaction came in since this phone last looked, and isn't reviewed yet.
    func isNew(_ t: FinanceTransaction) -> Bool {
        #if SCREENSHOTS
        // The screenshots: the five newest, as if they came in since.
        return ledger?.newestFirst.prefix(5).contains { $0.id == t.id } ?? false
        #else
        guard let seenKey, let seenTransactions else { return false }
        return seenTransactions.isNew(t.id, key: seenKey)
        #endif
    }

    /// How many transactions are new.
    var newTransactionCount: Int { ledger?.transactions.filter { isNew($0) }.count ?? 0 }

    /// Reviewed: they lose their dot, on this phone.
    func markReviewed(_ transactions: [FinanceTransaction]) {
        guard let seenKey, !transactions.isEmpty else { return }
        var seen = seenTransactions ?? TransactionsSeen(hashes: [])
        seen.see(transactions.map(\.id), key: seenKey)
        seenTransactions = seen
        seen.save()
    }

    /// The first look marks every transaction as seen; afterwards, only
    /// those still in the ledger stay remembered.
    private func noteSeen(in ledger: FinanceLedger) {
        guard let seenKey else { return }
        let ids = ledger.transactions.map(\.id)
        var seen = seenTransactions ?? .firstLook(ids, key: seenKey)
        seen.keep(only: ids, key: seenKey)
        if seen != seenTransactions {
            seenTransactions = seen
            seen.save()
        }
    }

    /// The edit level: transactions can be added.
    var canAddTransactions: Bool { level >= .edit && rawLedger != nil && plan != nil }

    /// Adds a transaction. Returns whether it saved.
    func add(_ transaction: NewTransaction) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger, let plan else { return false }
        let accounts = Set(plan.plan.accounts.map(\.id))
        if let problem = LedgerEdit.problem(with: transaction, accounts: accounts) {
            saveError = problem
            return false
        }
        guard let edited = LedgerEdit.appending(transaction, accounts: accounts, to: raw) else {
            saveError = "The ledger couldn't take that."
            return false
        }
        return await makeLedger(.add(transaction), edited: edited, reason: "Add a transaction to your Finances.")
    }

    func clearSaveError() { saveError = nil }

    /// Changes a transaction the phone may change. Returns whether it saved.
    func update(_ original: FinanceTransaction, with t: NewTransaction) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger, let plan else { return false }
        let accounts = Set(plan.plan.accounts.map(\.id))
        if let problem = LedgerEdit.problem(with: t, accounts: accounts) {
            saveError = problem
            return false
        }
        guard let edited = LedgerEdit.updating(id: original.id, with: t, accounts: accounts, in: raw) else {
            saveError = "This transaction is changed on the computer."
            return false
        }
        return await makeLedger(.update(id: original.id, t), edited: edited, reason: "Change a transaction in your Finances.")
    }

    // MARK: Rules (Parity gap 5, import 4 of 4)

    /// The household's rules, as the plan keeps them.
    var rules: [BankImport.Rule] { BankImport.rules(in: rawPlan) }

    /// Rules change the plan for every device: only while the Homelab answers, at the edit level.
    var canChangeRules: Bool { canEdit && offlineAsOf == nil && rawPlan != nil && !isPrivate }

    /// How many already in a rule is for, but `except`.
    func alreadyIn(for rule: BankImport.Rule, except: String?) -> Int { PayeeRules.count(rule, in: rawLedger, except: except) }

    /// Keeps the rules as given. Returns whether it saved.
    func saveRules(_ rules: [BankImport.Rule]) async -> Bool {
        guard canChangeRules, !isSaving, let raw = rawPlan else { return false }
        if let problem = PayeeRules.problem(rules) {
            saveError = problem
            return false
        }
        guard let edited = PayeeRules.setting(rules, in: raw) else { return false }
        return await savePlan(edited, reason: "Change the rules imports follow.")
    }

    /// Changes a transaction and makes the rule it asks for (Always do this
    /// for its old name): the rule first, kept in the plan, then the
    /// transaction, and the ones already in that it's for when `changeAlreadyIn`.
    func update(_ original: FinanceTransaction, with t: NewTransaction, always rule: BankImport.Rule, changeAlreadyIn: Bool) async -> Bool {
        guard canChangeRules, canAddTransactions, !isSaving, let rawPlan, let plan else { return false }
        let accounts = Set(plan.plan.accounts.map(\.id))
        if let problem = LedgerEdit.problem(with: t, accounts: accounts) {
            saveError = problem
            return false
        }
        let next = PayeeRules.adding(rule, to: rules)
        if let problem = PayeeRules.problem(next) {
            saveError = problem
            return false
        }
        guard let editedPlan = PayeeRules.setting(next, in: rawPlan) else { return false }
        guard await savePlan(editedPlan, reason: "Always do this for \u{201C}\(rule.match)\u{201D}.") else { return false }
        guard let raw = rawLedger, var edited = LedgerEdit.updating(id: original.id, with: t, accounts: accounts, in: raw) else {
            saveError = "The rule is kept, but this transaction is changed on the computer."
            return false
        }
        if changeAlreadyIn, let applied = PayeeRules.applying(rule, except: original.id, in: edited) { edited = applied }
        return await saveLedger(edited, reason: "Change transactions in your Finances.")
    }

    /// Sets a transaction's category and marks it reviewed. Returns whether it saved.
    func setCategory(_ t: FinanceTransaction, to category: String) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger else { return false }
        guard let edited = LedgerEdit.settingCategory(id: t.id, to: category, in: raw) else {
            saveError = "This transaction is changed on the computer."
            return false
        }
        let saved = await makeLedger(.category(id: t.id, to: category), edited: edited, reason: "Change a transaction's category in your Finances.")
        if saved { markReviewed([t]) }
        return saved
    }

    /// A loan's page: `t` linked to the planned payment `payment`, after
    /// Face ID. Returns whether it saved.
    func link(_ t: FinanceTransaction, to payment: String) async -> Bool {
        guard canAddTransactions, offlineAsOf == nil, !isSaving, let raw = rawLedger,
              let edited = LedgerEdit.settingLink(id: t.id, payment: payment, in: raw) else { return false }
        return await saveLedger(edited, reason: "Link a payment to your loan.")
    }

    /// A loan's page: `t` pays none of the plan's payments (Not this one).
    func notThisOne(_ t: FinanceTransaction) async -> Bool {
        guard canAddTransactions, offlineAsOf == nil, !isSaving, let raw = rawLedger,
              let edited = LedgerEdit.settingLink(id: t.id, payment: nil, in: raw) else { return false }
        return await saveLedger(edited, reason: "Take a payment off your loan.")
    }

    /// A loan's page: all of `t`, paid over its planned payment, counted (Count it).
    func countInFull(_ t: FinanceTransaction) async -> Bool {
        guard canAddTransactions, offlineAsOf == nil, !isSaving, let raw = rawLedger, let payment = t.payment,
              let edited = LedgerEdit.settingLink(id: t.id, payment: payment, extra: true, in: raw) else { return false }
        return await saveLedger(edited, reason: "Count all of a payment towards your loan.")
    }

    // MARK: Selected together (Parity gap 5)

    /// How many of the transactions selected the last change was made for,
    /// of how many: a transfer or split one is changed on the computer.
    private(set) var togetherDone: (done: Int, of: Int)?

    /// One category for each selected that can take one; each is marked reviewed.
    func setCategory(_ ts: [FinanceTransaction], to category: String) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger,
              let r = LedgerEdit.each(ts.map(\.id), in: raw, { LedgerEdit.settingCategory(id: $0, to: category, in: $1) })
        else {
            saveError = "These are changed on the computer."
            return false
        }
        let saved = await makeLedger(r.done.map { LedgerChange.category(id: $0, to: category) }, edited: r.ledger,
                                     reason: "Change the category of \(r.done.count) transactions in your Finances.")
        if saved {
            togetherDone = (r.done.count, ts.count)
            markReviewed(ts.filter { r.done.contains($0.id) })
        }
        return saved
    }

    /// Moves each selected to `account`, but a transfer.
    func move(_ ts: [FinanceTransaction], to account: String) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger, let plan else { return false }
        let accounts = Set(plan.plan.accounts.map(\.id))
        guard let r = LedgerEdit.each(ts.map(\.id), in: raw, { LedgerEdit.moving(id: $0, to: account, accounts: accounts, in: $1) }) else {
            saveError = "These are changed on the computer."
            return false
        }
        let name = plan.plan.accounts.first { $0.id == account }?.name ?? "another account"
        let saved = await makeLedger(r.done.map { LedgerChange.move(id: $0, to: account) }, edited: r.ledger,
                                     reason: "Move \(r.done.count) transactions to \(name).")
        if saved { togetherDone = (r.done.count, ts.count) }
        return saved
    }

    /// Deletes each selected.
    func delete(_ ts: [FinanceTransaction]) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger,
              let r = LedgerEdit.each(ts.map(\.id), in: raw, { LedgerEdit.removing(id: $0, from: $1) })
        else {
            saveError = "Those transactions aren't in the ledger any more."
            return false
        }
        let saved = await makeLedger(r.done.map { LedgerChange.delete(id: $0) }, edited: r.ledger,
                                     reason: "Delete \(r.done.count) transactions from your Finances.")
        if saved { togetherDone = (r.done.count, ts.count) }
        return saved
    }

    func dismissTogetherDone() { togetherDone = nil }

    // MARK: Import a bank's file (Parity gap 5, import 1 of 3)

    /// What `rows` of a bank's file would bring into `account`, against the
    /// ledger and the plan's rules as last read.
    /// `picked`: links chosen by hand, by row ("" for none).
    func importing(_ rows: [BankFile.Row], into account: String, picked: [Int: String] = [:]) -> [BankImport.Found] {
        let logos = PayeeLogos.shared
        let ledger = BankImport.kept(in: rawLedger)
        let found = BankImport.found(rows, account: account, ledger: ledger, rules: BankImport.rules(in: rawPlan)) {
            logos.cleanPayee(logos.withoutTown($0, town: $1))
        }
        return BankImport.guessing(found, account: account, ledger: ledger, plan: rawPlan, view: lastView(),
                                   checking: plan?.checking ?? "", picked: picked, logos: logos)
    }

    /// The computer's view as last read (live or kept for offline): its dues and categories.
    private func lastView() -> JSONValue? {
        guard let answer = answers.plan ?? kept?.plan.answer,
              let envelope = try? JSONDecoder().decode(JSONValue.self, from: answer) else { return nil }
        return envelope["result"]
    }

    /// What a bank's file changes on rows brought in before (import 3 of 4):
    /// payees for CREDIT or DEBIT ones, clearer names, and categories.
    func importFixes(_ found: [BankImport.Found], into account: String) -> [(id: String, fix: LedgerFix)] {
        let ledger = BankImport.kept(in: rawLedger)
        let recat = BankImport.recategorized(found, account: account, ledger: ledger, plan: rawPlan, view: lastView(), logos: PayeeLogos.shared)
        return BankImport.fixes(found, recategorized: recat, ledger: ledger)
    }

    /// Brings in the rows of a bank's file that aren't in yet, and fixes the
    /// ones brought in before, in one save (or, away, as changes that wait).
    /// Returns how many came in or were fixed, or nil.
    func bringIn(_ found: [BankImport.Found], into account: String) async -> Int? {
        guard canAddTransactions, !isSaving, var raw = rawLedger, let plan else { return nil }
        let accounts = Set(plan.plan.accounts.map(\.id))
        var made: [LedgerChange] = []
        for (id, fix) in importFixes(found, into: account) {
            guard let next = LedgerEdit.fixing(id: id, with: fix, in: raw) else { continue }
            raw = next
            made.append(.fix(id: id, fix))
        }
        for t in BankImport.transactions(found, account: account) {
            guard let next = LedgerEdit.appending(t, accounts: accounts, to: raw) else { continue }
            raw = next
            made.append(.add(t))
        }
        guard !made.isEmpty else {
            saveError = "Nothing in this file can come in."
            return nil
        }
        let name = plan.plan.accounts.first { $0.id == account }?.name ?? "an account"
        let saved = await makeLedger(made, edited: raw, reason: "Bring transactions from a bank's file into \(name).")
        return saved ? made.count : nil
    }

    /// Removes a transaction. Returns whether it saved.
    func delete(_ t: FinanceTransaction) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger else { return false }
        guard let edited = LedgerEdit.removing(id: t.id, from: raw) else {
            saveError = "That transaction isn't in the ledger any more."
            await loadLedger()
            return false
        }
        return await makeLedger(.delete(id: t.id), edited: edited, reason: "Delete a transaction from your Finances.")
    }

    private func saveLedger(_ edited: JSONValue, reason: String) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        guard await authorize(reason) else { return false }
        do {
            let read: LedgerRead
            if let store = openedPrivate {
                read = try await store.saveFinancesLedger(edited)
                touchPrivate()
            } else {
                read = try await api.saveFinancesLedger(edited)
            }
            ledger = read.ledger
            rawLedger = read.raw
            answers.ledger = read.answer
            keepAnswers()
            saveError = nil
            savedCount += 1
            return true
        } catch {
            Log.ui.error("SaveFinancesLedger failed: \(APIError.from(error).logName, privacy: .public)")
            saveError = Self.words(error)
            await loadLedger()
            return false
        }
    }

    /// A receipt to show, read when asked and kept only while shown.
    func openReceipt(_ name: String) async -> ReceiptCodec.Content? {
        guard canSeePlan else { return nil }
        do {
            let url: String
            if let store = openedPrivate {
                url = try await store.receipt(named: name)
                touchPrivate()
            } else {
                url = try await api.receipt(named: name)
            }
            return await Task.detached(priority: .userInitiated) { ReceiptCodec.content(fromDataURL: url) }.value
        } catch {
            saveError = Self.words(error)
            return nil
        }
    }

    /// Prepares a picked photo and keeps it on the computer, returning its
    /// name for the new transaction.
    func attachPhoto(_ data: Data) async -> String? {
        guard level >= .edit, !isSaving else { return nil }
        isSaving = true
        defer { isSaving = false }
        // Keeping a receipt writes to the computer, so it's authenticated
        // like any save (the save that names it falls in the same grace).
        guard await authorize("Keep a receipt in your Finances.") else { return nil }
        guard let url = await Task.detached(priority: .userInitiated, operation: { ReceiptCodec.preparePhoto(data) }).value else {
            saveError = "That picture couldn't be used as a receipt."
            return nil
        }
        do {
            if let store = openedPrivate { return try await store.saveReceipt(dataURL: url) }
            return try await api.saveReceipt(dataURL: url)
        } catch {
            Log.ui.error("SaveFinancesReceipt failed: \(APIError.from(error).logName, privacy: .public)")
            saveError = Self.words(error)
            return nil
        }
    }

    func accountName(_ id: String) -> String? {
        plan?.plan.accounts.first { $0.id == id }?.name
    }

    var currency: String { plan?.plan.currency ?? money?.currency ?? "USD" }

    func loadPlan() async {
        guard canSeePlan, !isLoadingPlan else { return }
        isLoadingPlan = true
        defer { isLoadingPlan = false }
        if let store = await privateNow() {
            showPrivatePlan(store)
            return
        }
        do {
            let read = try await api.financesPlan()
            ownLogos = OwnLogos(read.view.plan.logos)
            plan = read.view
            rawPlan = read.rawPlan
            planError = nil
            offlineAsOf = nil
            awayBase = nil
            awayLedgerBase = nil
            answers.plan = read.answer
            keepAnswers()
            await sendAway(on: read)
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Finances failed: \(apiError.logName, privacy: .public)")
            // Made private on another of her devices since: they open here now.
            if Self.isPrivateRefusal(apiError), let store = await privateFound() {
                showPrivatePlan(store)
                return
            }
            if OfflineFinances.showsKept(after: apiError), await showKept() { return }
            if case .forbidden = apiError {
                plan = nil
                ownLogos = OwnLogos()
                rawPlan = nil
                forgetOffline()
            }
            planError = apiError.errorDescription
        }
    }

    /// A household member's phone: their own plan is the one shown, and
    /// the household's shows only as much as the owner shares.
    var isMember: Bool { device()?.isMember == true }

    func loadShared() async {
        guard isMember, canSeePlan else { return }
        do {
            let read = try await api.financesSharedAnswer()
            shared = read.shared
            answers.shared = read.answer
            keepAnswers()
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Shared Finances failed: \(apiError.logName, privacy: .public)")
            if OfflineFinances.showsKept(after: apiError), let kept = await readKept()?.shared {
                shared = kept
                return
            }
            shared = nil
        }
    }

    func load() async {
        guard canSeeMoney, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            money = try await api.moneyCard()
            error = nil
        } catch {
            let apiError = APIError.from(error)
            // The level changed on the computer since /api/me: drop what was shown.
            if case .forbidden = apiError { money = nil }
            // Her Finances are private: the computer can't sum them up, so there's no card.
            if Self.isPrivateRefusal(apiError) {
                money = nil
                self.error = nil
                return
            }
            Log.ui.error("Money card failed: \(apiError.logName, privacy: .public)")
            self.error = apiError.errorDescription
        }
    }
}
