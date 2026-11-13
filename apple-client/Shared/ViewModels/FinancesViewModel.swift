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
    /// The computer's latest answers, to keep.
    @ObservationIgnored private var answers: (plan: Data?, ledger: Data?, shared: Data?) = (nil, nil, nil)
    /// The last keep or forget, so each runs after the one before: a slow
    /// keep can't bring back what a forget dropped.
    @ObservationIgnored private var keeping: Task<Void, Never>?

    init(
        api: APIClient,
        device: @escaping @MainActor () -> DeviceInfo?,
        authorize: @escaping @MainActor (String) async -> Bool,
        offline: OfflineFinances = .onThisDevice
    ) {
        self.api = api
        self.device = device
        self.authorize = authorize
        self.offline = offline
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
        guard let plan = answers.plan, level >= .view else { return }
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

    /// Shows the kept Finances in place of the live ones, to look at only.
    private func showKept() async -> Bool {
        guard let kept = await readKept() else { return false }
        ownLogos = OwnLogos(kept.plan.view.plan.logos)
        plan = kept.plan.view
        rawPlan = nil
        planError = nil
        if ledger == nil, let kept = kept.ledger {
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
            ownLogos = OwnLogos(read.view.plan.logos)
            plan = read.view
            rawPlan = read.rawPlan
            answers.plan = read.answer
            keepAnswers()
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

    private func apply(_ r: InvestmentsReadResult) {
        ownLogos = OwnLogos(r.read.view.plan.logos)
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

    /// A loan's page: `t` linked to the planned payment `payment`, after
    /// Face ID. Returns whether it saved.
    func link(_ t: FinanceTransaction, to payment: String) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger,
              let edited = LedgerEdit.settingLink(id: t.id, payment: payment, in: raw) else { return false }
        return await saveLedger(edited, reason: "Link a payment to your loan.")
    }

    /// A loan's page: `t` pays none of the plan's payments (Not this one).
    func notThisOne(_ t: FinanceTransaction) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger,
              let edited = LedgerEdit.settingLink(id: t.id, payment: nil, in: raw) else { return false }
        return await saveLedger(edited, reason: "Take a payment off your loan.")
    }

    /// A loan's page: all of `t`, paid over its planned payment, counted (Count it).
    func countInFull(_ t: FinanceTransaction) async -> Bool {
        guard canAddTransactions, !isSaving, let raw = rawLedger, let payment = t.payment,
              let edited = LedgerEdit.settingLink(id: t.id, payment: payment, extra: true, in: raw) else { return false }
        return await saveLedger(edited, reason: "Count all of a payment towards your loan.")
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
            answers.ledger = read.answer
            keepAnswers()
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
            ownLogos = OwnLogos(read.view.plan.logos)
            plan = read.view
            rawPlan = read.rawPlan
            planError = nil
            offlineAsOf = nil
            answers.plan = read.answer
            keepAnswers()
        } catch {
            let apiError = APIError.from(error)
            Log.ui.error("Finances failed: \(apiError.logName, privacy: .public)")
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
            Log.ui.error("Money card failed: \(apiError.logName, privacy: .public)")
            self.error = apiError.errorDescription
        }
    }
}
