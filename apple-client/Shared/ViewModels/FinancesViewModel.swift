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
    private(set) var ledger: FinanceLedger?
    @ObservationIgnored private var rawLedger: JSONValue?
    private(set) var ledgerError: String?
    private(set) var isLoadingLedger = false
    /// Amounts show only after a tap, and hide again on lock.
    var amountsShown = false

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
