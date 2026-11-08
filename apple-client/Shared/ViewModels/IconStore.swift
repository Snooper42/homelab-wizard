import Foundation
import Observation

/// App icons as the computer kept them (the `AppIcon` call; the phone never
/// makes the computer ask the app). Each icon is fetched once per unlock,
/// a few at a time, and kept in memory only, for at most 300 apps.
@MainActor
@Observable
final class IconStore {
    private enum Entry {
        case loading
        case missing
        case icon(DecodedIcon)
    }

    private var entries: [AppStatus.ID: Entry] = [:]

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private var queue: [AppStatus.ID] = []
    @ObservationIgnored private var workers = 0

    static let maxEntries = 300
    static let maxWorkers = 3

    init(api: APIClient) {
        self.api = api
    }

    /// The app's icon, starting a fetch the first time one is asked for.
    func icon(for app: AppStatus) -> DecodedIcon? {
        switch entries[app.id] {
        case .icon(let icon): return icon
        case .loading, .missing: return nil
        case nil:
            request(app.id)
            return nil
        }
    }

    private func request(_ id: AppStatus.ID) {
        guard AppStatus.isValidID(id), entries.count < Self.maxEntries else { return }
        // Mark it before the view's body finishes; the change applies on the next pass.
        Task { @MainActor in
            guard self.entries[id] == nil else { return }
            self.entries[id] = .loading
            self.queue.append(id)
            self.pump()
        }
    }

    private func pump() {
        while workers < Self.maxWorkers, !queue.isEmpty {
            let id = queue.removeFirst()
            workers += 1
            Task { [api] in
                let decoded = await Self.fetch(id, api: api)
                self.entries[id] = decoded.map(Entry.icon) ?? .missing
                self.workers -= 1
                self.pump()
            }
        }
    }

    private nonisolated static func fetch(_ id: String, api: APIClient) async -> DecodedIcon? {
        guard let url = try? await api.call("AppIcon", [.string(id)], as: String.self), !url.isEmpty else { return nil }
        // Decode off the main actor.
        return await Task.detached(priority: .utility) {
            guard let payload = IconDecoder.payload(fromDataURL: url),
                  let image = IconDecoder.thumbnail(from: payload.data)
            else { return nil }
            return DecodedIcon(image: image)
        }.value
    }
}
