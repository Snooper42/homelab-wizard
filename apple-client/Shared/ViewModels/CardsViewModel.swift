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
    /// Analytics' own reads of the usage card alone, numbered apart from the board's.
    @ObservationIgnored private var usageBoard = 1_000_000
    /// The apps' processor and memory together each time the usage card came, the last hour, oldest first:
    /// Analytics' timeline.
    private(set) var usageSamples: [UsageSample] = []

    init(api: APIClient, liveEvents: LiveEventManager) {
        self.api = api
        self.liveEvents = liveEvents
    }

    /// The cards to show, in the screens' order. A card the phone isn't
    /// allowed to read is left out.
    var shown: [StatusCard] {
        StatusCard.phoneCards.compactMap { cards[$0] }.filter { !$0.isNotHere }
    }

    /// Status's Storage card: what each app keeps (`StorageCard`), nil while there's nothing to show.
    var storage: StorageCard? {
        if case .other(let v)? = cards["storage"]?.data { return StorageCard.from(v) }
        return nil
    }

    /// The cards in the screens' order, Storage among them where the computer has it.
    enum Slot: Identifiable {
        case card(StatusCard)
        case storage(StorageCard)
        var id: String {
            switch self {
            case .card(let c): c.name
            case .storage: "storage"
            }
        }
    }

    var slots: [Slot] {
        var out = shown.map(Slot.card)
        if let storage {
            out.insert(.storage(storage), at: StorageCard.place(among: shown.map(\.name)))
        }
        return out
    }

    /// The computer's free space and power, for Status's This Machine card; nil before it's
    /// read, or from a computer that doesn't send it.
    var machine: MachineFacts? {
        if case .other(let v)? = cards["machine"]?.data { return MachineFacts.from(v) }
        return nil
    }

    var watchdog: WatchdogSummary? {
        if case .watchdog(let w)? = cards["watchdog"]?.data { return w }
        return nil
    }

    /// A card's data as it came, for the cards read whole (usage, storage, machine); nil before it's read.
    func json(_ name: String) -> JSONValue? {
        if case .other(let v)? = cards[name]?.data { return v }
        return nil
    }

    /// What an app takes on the computer: memory and processor now, and its folder.
    func resources(of id: AppStatus.ID) -> AppResources {
        AppResources.of(id, usage: json("usage"), storage: json("storage"))
    }

    var protection: Protection? {
        if case .protection(let p)? = cards["protection"]?.data { return p }
        return nil
    }

    func load() async {
        board += 1
        let mine = board
        isLoading = true
        defer { if mine == board { isLoading = false } }
        do {
            let stream = try await api.statusBoard(board: mine, cards: StatusCard.phoneCards + StatusCard.appCards)
            for try await update in stream {
                guard mine == board else { return }
                switch update {
                case .status(let status):
                    liveEvents.ingest(status)
                case .card(let card):
                    guard card.board == mine else { continue }
                    take(card)
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

    /// The usage card alone, for Analytics while it's open: what each app uses now, and one more sample.
    func readUsage() async {
        usageBoard += 1
        let mine = usageBoard
        do {
            let stream = try await api.statusBoard(board: mine, cards: ["usage"])
            for try await update in stream {
                guard mine == usageBoard else { return }
                switch update {
                case .status(let status):
                    liveEvents.ingest(status)
                case .card(let card):
                    guard card.board == mine else { continue }
                    take(card)
                }
            }
        } catch is CancellationError {
            return
        } catch {
            Log.network.error("Usage failed: \(APIError.from(error).logName, privacy: .public)")
        }
    }

    private func take(_ card: StatusCard) {
        cards[card.name] = card
        guard card.name == "usage" else { return }
        var usage: JSONValue?
        if case .other(let v)? = card.data { usage = v }
        let now = Date()
        guard let sample = UsageNow.from(usage: usage, storage: nil, apps: []).sample(at: now) else { return }
        usageSamples = Self.keeping(usageSamples + [sample], now: now)
    }

    /// The samples of the last hour.
    nonisolated static func keeping(_ samples: [UsageSample], now: Date) -> [UsageSample] {
        samples.filter { now.timeIntervalSince($0.at) <= 3600 }
    }
}
