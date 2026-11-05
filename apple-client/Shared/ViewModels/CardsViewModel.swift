import Foundation
import Observation

/// The cards beside Status, read together with it in one `StatusBoard`
/// request. Each card shows as soon as it's read.
///
/// The cards belong to the dashboard, so locking drops them.
@MainActor
@Observable
final class CardsViewModel {
    private(set) var cards: [String: StatusCard] = [:]
    private(set) var isLoading = false
    private(set) var error: String?

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let liveEvents: LiveEventManager
    /// The request number. A card from an older request is dropped.
    @ObservationIgnored private var board = 0

    init(api: APIClient, liveEvents: LiveEventManager) {
        self.api = api
        self.liveEvents = liveEvents
    }

    /// The cards to show, in the screens' order. A card the phone isn't
    /// allowed to read is left out.
    var shown: [StatusCard] {
        StatusCard.phoneCards.compactMap { cards[$0] }.filter { !$0.isNotHere }
    }

    var watchdog: WatchdogSummary? {
        if case .watchdog(let w)? = cards["watchdog"]?.data { return w }
        return nil
    }

    func load() async {
        board += 1
        let mine = board
        isLoading = true
        defer { if mine == board { isLoading = false } }
        do {
            let stream = try await api.statusBoard(board: mine, cards: StatusCard.phoneCards)
            for try await update in stream {
                guard mine == board else { return }
                switch update {
                case .status(let status):
                    liveEvents.ingest(status)
                case .card(let card):
                    guard card.board == mine else { continue }
                    cards[card.name] = card
                }
            }
            error = nil
        } catch is CancellationError {
            return
        } catch {
            guard mine == board else { return }
            let apiError = APIError.from(error)
            Log.network.error("Cards failed: \(apiError.logName, privacy: .public)")
            self.error = apiError.errorDescription
        }
    }
}
