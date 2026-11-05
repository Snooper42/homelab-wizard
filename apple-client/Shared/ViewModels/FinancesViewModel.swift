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
