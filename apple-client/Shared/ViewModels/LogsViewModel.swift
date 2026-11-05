import Foundation
import Observation

/// One app's log, as the computer sends it (already redacted there).
///
/// It's kept only in this object, which goes away with the sheet or with
/// the dashboard when the app locks, and it's never logged.
@MainActor
@Observable
final class LogsViewModel {
    struct Line: Identifiable, Equatable {
        let id: Int
        let text: String
    }

    static let lineChoices = [200, 1000, 5000]

    let app: AppStatus
    private(set) var lineCount = 200
    var filter = ""
    private(set) var lines: [Line] = []
    private(set) var isLoading = false
    private(set) var error: String?
    private(set) var loadedAt: Date?

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private var generation = 0

    init(app: AppStatus, api: APIClient) {
        self.app = app
        self.api = api
    }

    /// Reads the log again with another number of lines.
    func setLineCount(_ count: Int) {
        guard count != lineCount else { return }
        lineCount = count
        Task { await load() }
    }

    var shownLines: [Line] {
        let needle = filter.trimmingCharacters(in: .whitespaces)
        guard !needle.isEmpty else { return lines }
        return lines.filter { $0.text.localizedCaseInsensitiveContains(needle) }
    }

    func load() async {
        generation += 1
        let mine = generation
        isLoading = true
        defer { if mine == generation { isLoading = false } }
        do {
            let text = try await api.logs(appID: app.id, lines: lineCount)
            // A newer load (a different line count) wins.
            guard mine == generation else { return }
            lines = Self.split(text)
            loadedAt = Date()
            error = nil
        } catch {
            guard mine == generation else { return }
            let apiError = APIError.from(error)
            Log.ui.error("Logs failed: \(apiError.logName, privacy: .public)")
            self.error = apiError.errorDescription
        }
    }

    /// Splits the log into lines for display. Control characters are
    /// removed (tabs stay), and each line is cut to 2000 characters.
    nonisolated static func split(_ text: String) -> [Line] {
        var text = Substring(text)
        while text.hasSuffix("\n") { text = text.dropLast() }
        guard !text.isEmpty else { return [] }
        return text.split(separator: "\n", omittingEmptySubsequences: false)
            .enumerated()
            .map { index, raw in
                let cleaned = String(raw.unicodeScalars.filter { $0 == "\t" || !CharacterSet.controlCharacters.contains($0) })
                return Line(id: index, text: String(cleaned.prefix(2000)))
            }
    }
}
