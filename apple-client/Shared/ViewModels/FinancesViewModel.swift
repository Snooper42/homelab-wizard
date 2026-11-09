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

    init(
        api: APIClient,
        device: @escaping @MainActor () -> DeviceInfo?,
        authorize: @escaping @MainActor (String) async -> Bool
    ) {
        self.api = api
        self.device = device
        self.authorize = authorize
    }

    /// The edit level, and a plan the computer didn't mark read-only.
    var canEdit: Bool { level >= .edit && plan?.readOnly == false && rawPlan != nil }

    /// Marks a paycheck or payment as not in the balances yet, or back.
    func setWaiting(_ past: FinancePast, waiting: Bool) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan, let plan, past.waiting != waiting else { return false }
        guard let edited = FinancePlanEdit.settingWaiting(past.key, waiting: waiting, current: plan.waitingKeys, in: raw) else {
            saveError = "That can't be marked."
            return false
        }
        return await savePlan(edited, reason: waiting ? "Mark it as not in the balances yet." : "Mark it as in the balances.")
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
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.settingGoal(id: goal.id, target: target, in: raw) else {
            saveError = "A goal needs an amount more than nothing."
            return false
        }
        return await savePlan(edited, reason: "Change the \(goal.name) goal.")
    }

    /// Changes what a planned payment costs each time. Returns whether it saved.
    func setPayment(_ payment: FinancePayment, to amount: Double) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        guard payment.canChangeAmount,
              let edited = FinancePlanEdit.settingPayment(id: payment.id, to: amount, in: raw)
        else {
            saveError = payment.canChangeAmount ? "A payment needs an amount more than nothing." : "A card payoff is changed on the computer."
            return false
        }
        return await savePlan(edited, reason: "Change what \(payment.name) costs.")
    }

    /// Changes the least checking should hold (0 turns the warning off). Returns whether it saved.
    func setCushion(_ amount: Double) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.settingCushion(amount, in: raw) else {
            saveError = "The cushion is an amount, or nothing."
            return false
        }
        return await savePlan(edited, reason: "Change the cushion.")
    }

    /// Adds an account to the plan: a member's own, or the household's.
    /// Returns whether it saved.
    func addAccount(name: String, kind: String, balance: Double) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        let today = plan.map(\.todayText).flatMap { $0.isEmpty ? nil : $0 } ?? FinancePlanEdit.todayString()
        guard let edited = FinancePlanEdit.addingAccount(name: name, kind: kind, balance: balance, today: today, in: raw) else {
            saveError = "An account needs a name, and a balance that's an amount."
            return false
        }
        return await savePlan(edited, reason: "Add \(name.trimmingCharacters(in: .whitespaces)) to Finances.")
    }

    /// Changes a budget's amount. Returns whether it saved.
    func setBudget(_ budget: FinanceBudget, to amount: Double) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.settingBudget(category: budget.category, to: amount, in: raw) else {
            saveError = "A budget is an amount more than nothing."
            return false
        }
        return await savePlan(edited, reason: "Change the \(budget.category) budget.")
    }

    private func savePlan(_ edited: JSONValue, reason: String) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        guard await authorize(reason) else { return false }
        do {
            let read = try await api.saveFinances(edited)
            plan = read.view
            rawPlan = read.rawPlan
            saveError = nil
            savedCount += 1
            return true
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("SaveFinances failed: \(apiError.logName, privacy: .public)")
            saveError = apiError.errorDescription
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

    /// What Ghostfolio finds for a ticker or a name.
    func findSymbols(_ query: String) async throws -> [InvestmentSymbol] {
        guard canEdit else { return [] }
        return try await api.financesFindSymbol(query)
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

    private func apply(_ r: InvestmentsReadResult) {
        plan = r.read.view
        rawPlan = r.read.rawPlan
        investmentsSaid = r.words()
        investmentsProblem = nil
        investmentsUnmatched = r.unmatched
    }

    /// Types in an account's balance, as on the computer. Returns whether it saved.
    func setBalance(of account: FinanceAccount, to value: Double) async -> Bool {
        guard canEdit, !isSaving, let raw = rawPlan else { return false }
        guard let edited = FinancePlanEdit.settingBalance(of: account.id, to: value, today: FinancePlanEdit.todayString(), in: raw) else {
            saveError = "That isn't an amount the plan can take."
            return false
        }
        return await savePlan(edited, reason: "Update \(account.name)'s balance.")
    }

    var level: FinancesLevel { FinancesLevel(device()?.finances) }
    var canSeeMoney: Bool { level >= .card }
    var canSeePlan: Bool { level >= .view }

    /// Hide amounts in the plan: every device follows it.
    var amountsHiddenByPlan: Bool { plan?.plan.hideAmounts ?? money?.hidden ?? false }

    func loadLedger() async {
        guard canSeePlan, !isLoadingLedger else { return }
        isLoadingLedger = true
        defer { isLoadingLedger = false }
        do {
            let read = try await api.financesLedger()
            ledger = read.ledger
            rawLedger = read.raw
            ledgerError = nil
            noteSeen(in: read.ledger)
        } catch {
            let apiError = APIError.from(error)
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
        return await saveLedger(edited, reason: "Add a transaction to your Finances.")
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
        return await saveLedger(edited, reason: "Change a transaction in your Finances.")
    }

    /// Sets a transaction's category and marks it reviewed. Returns whether it saved.
    func setCategory(_ t: FinanceTransaction, to category: String) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger else { return false }
        guard let edited = LedgerEdit.settingCategory(id: t.id, to: category, in: raw) else {
            saveError = "This transaction is changed on the computer."
            return false
        }
        let saved = await saveLedger(edited, reason: "Change a transaction's category in your Finances.")
        if saved { markReviewed([t]) }
        return saved
    }

    /// Removes a transaction. Returns whether it saved.
    func delete(_ t: FinanceTransaction) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger else { return false }
        guard let edited = LedgerEdit.removing(id: t.id, from: raw) else {
            saveError = "That transaction isn't in the ledger any more."
            await loadLedger()
            return false
        }
        return await saveLedger(edited, reason: "Delete a transaction from your Finances.")
    }

    private func saveLedger(_ edited: JSONValue, reason: String) async -> Bool {
        isSaving = true
        defer { isSaving = false }
        guard await authorize(reason) else { return false }
        do {
            let read = try await api.saveFinancesLedger(edited)
            ledger = read.ledger
            rawLedger = read.raw
            saveError = nil
            savedCount += 1
            return true
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("SaveFinancesLedger failed: \(apiError.logName, privacy: .public)")
            saveError = apiError.errorDescription
            await loadLedger()
            return false
        }
    }

    /// A receipt to show, read when asked and kept only while shown.
    func openReceipt(_ name: String) async -> ReceiptCodec.Content? {
        guard canSeePlan else { return nil }
        do {
            let url = try await api.receipt(named: name)
            return await Task.detached(priority: .userInitiated) { ReceiptCodec.content(fromDataURL: url) }.value
        } catch {
            saveError = APIError.from(error).errorDescription
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
            return try await api.saveReceipt(dataURL: url)
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("SaveFinancesReceipt failed: \(apiError.logName, privacy: .public)")
            saveError = apiError.errorDescription
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
        do {
            let read = try await api.financesPlan()
            plan = read.view
            rawPlan = read.rawPlan
            planError = nil
        } catch {
            let apiError = APIError.from(error)
            if case .forbidden = apiError {
                plan = nil
                rawPlan = nil
            }
            Log.ui.error("Finances failed: \(apiError.logName, privacy: .public)")
            planError = apiError.errorDescription
        }
    }

    /// A household member's phone: their own plan is the one shown, and
    /// the household's shows only as much as the owner shares.
    var isMember: Bool { device()?.isMember == true }

    func loadShared() async {
        guard isMember, canSeePlan else { return }
        do {
            shared = try await api.financesShared()
        } catch {
            Log.ui.error("Shared Finances failed: \(APIError.from(error).logName, privacy: .public)")
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
            Log.ui.error("Money card failed: \(apiError.logName, privacy: .public)")
            self.error = apiError.errorDescription
        }
    }
}
