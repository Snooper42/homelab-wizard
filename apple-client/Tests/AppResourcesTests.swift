import Foundation
import Testing
@testable import HomelabClient

/// What an app takes, from the computer's "usage" and "storage" cards (made-up figures).
@Suite("What an app takes")
struct AppResourcesTests {
    private let usage = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    [{"name":"immich-server","cpu":12.5,"mem":"512MiB"},{"name":"immich-machine-learning","cpu":30,"mem":"1.5GiB"},
     {"name":"vikunja","cpu":0.4,"mem":"48.2MiB"},{"name":"immichfake","cpu":99,"mem":"9GiB"}]
    """#.utf8))
    private let storage = try! JSONDecoder().decode(JSONValue.self, from: Data(#"""
    {"when":"2026-11-15T03:00:00Z","apps":[{"app":"immich","bytes":12884901888},{"app":"vikunja","bytes":41943040}]}
    """#.utf8))

    @Test func anAppOfSeveralContainersCountsThemAll() {
        let r = AppResources.of("immich", usage: usage, storage: storage)
        #expect(r.memory == 512 * 1_048_576 + 1_610_612_736)
        #expect(r.processor == 42.5)
        #expect(r.disk == 12_884_901_888)
        #expect(r.diskMeasured == ISO8601DateFormatter().date(from: "2026-11-15T03:00:00Z"))
    }

    @Test func oneContainerAndNothingElsesByName() {
        let r = AppResources.of("vikunja", usage: usage, storage: storage)
        #expect(r.memory == Int64((48.2 * 1_048_576).rounded()))
        #expect(r.processor == 0.4)
        #expect(r.disk == 41_943_040)
        // Not running, not measured: nothing, rather than zeros.
        let none = AppResources.of("ntfy", usage: usage, storage: storage)
        #expect(none.isEmpty)
        // An older computer that sends neither card.
        #expect(AppResources.of("vikunja", usage: nil, storage: nil).isEmpty)
    }

    @Test func dockersMemoryWords() {
        #expect(AppResources.bytes("800B") == 800)
        #expect(AppResources.bytes("12.5kB") == 12_500)
        #expect(AppResources.bytes("1GiB") == 1_073_741_824)
        #expect(AppResources.bytes("--") == nil)
        #expect(AppResources.bytes("") == nil)
        // Too big for a byte count: nothing, rather than a crash.
        #expect(AppResources.bytes("1e30TiB") == nil)
    }
}
