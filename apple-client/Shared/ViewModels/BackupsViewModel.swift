import Foundation
import Observation

/// Backups, read-only: the nightly backup's copies and restore tests
/// (`Backups`), and Duplicati's jobs (`DuplicatiJobs`), read side by side.
/// Each has its own error, because Duplicati can be down while the files
/// are fine.
@MainActor
@Observable
final class BackupsViewModel {
    private(set) var overview: BackupOverview?
    private(set) var jobs: [DuplicatiJob]?
    private(set) var overviewError: String?
    private(set) var jobsError: String?
    private(set) var isLoading = false

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private var generation = 0

    init(api: APIClient) {
        self.api = api
    }

    /// Something to look at: a stale copy, one that shrank, a failed job, a due restore
    /// test or vault export, or a plain export lying around.
    var needsAttention: Int {
        guard let overview else { return 0 }
        var n = overview.stale + overview.shrank + (jobs ?? []).filter { $0.state == "failed" }.count
        if overview.restoreDue { n += 1 }
        if overview.vaultDue { n += 1 }
        n += overview.plainExports.count
        if !overview.destinationOK { n += 1 }
        return n
    }

    func load() async {
        generation += 1
        let mine = generation
        isLoading = true
        defer { if mine == generation { isLoading = false } }

        let api = self.api
        async let overviewResult = Self.capture { try await api.call("Backups", as: BackupOverview.self) }
        async let jobsResult = Self.capture { try await api.call("DuplicatiJobs", as: [DuplicatiJob]?.self) }
        let (o, j) = await (overviewResult, jobsResult)
        guard mine == generation else { return }

        switch o {
        case .success(let value): overview = value; overviewError = nil
        case .failure(let error): overviewError = error.errorDescription
        }
        switch j {
        case .success(let value): jobs = value ?? []; jobsError = nil
        case .failure(let error): jobsError = error.errorDescription
        }
    }

    private nonisolated static func capture<T: Sendable>(_ body: @Sendable () async throws -> T) async -> Result<T, APIError> {
        do {
            return .success(try await body())
        } catch {
            let apiError = APIError.from(error)
            Log.network.error("Backups read failed: \(apiError.logName, privacy: .public)")
            return .failure(apiError)
        }
    }
}
