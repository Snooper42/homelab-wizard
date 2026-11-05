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
    private(set) var planError: String?
    private(set) var isLoadingPlan = false
    /// Amounts show only after a tap, and hide again on lock.
    var amountsShown = false

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let device: @MainActor () -> DeviceInfo?

    init(api: APIClient, device: @escaping @MainActor () -> DeviceInfo?) {
        self.api = api
        self.device = device
    }

    var level: FinancesLevel { FinancesLevel(device()?.finances) }
    var canSeeMoney: Bool { level >= .card }
    var canSeePlan: Bool { level >= .view }

    /// Hide amounts in the plan: every device follows it.
    var amountsHiddenByPlan: Bool { plan?.plan.hideAmounts ?? money?.hidden ?? false }

    func loadPlan() async {
        guard canSeePlan, !isLoadingPlan else { return }
        isLoadingPlan = true
        defer { isLoadingPlan = false }
        do {
            plan = try await api.financesPlan()
            planError = nil
        } catch {
            let apiError = APIError.from(error)
            if case .forbidden = apiError { plan = nil }
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
