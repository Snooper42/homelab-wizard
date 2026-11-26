import Foundation
import Testing
@testable import HomelabClient

// Analytics on Status (P3): what each app uses now, the totals, and the words, as the computer's Analytics.tsx.
@Suite("Analytics")
struct AnalyticsTests {
    private func status(_ json: String) throws -> HomelabStatus {
        try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(json.utf8))
    }

    @Test func eachAppHeaviestFirstWithItsHelpersAndFolder() throws {
        let usage: JSONValue = .array([
            .object(["name": .string("immich-server"), "cpu": .number(40), "mem": .string("300MiB")]),
            .object(["name": .string("immich-machine-learning"), "cpu": .number(131), "mem": .string("200MiB")]),
            .object(["name": .string("paperless-ngx"), "cpu": .number(12), "mem": .string("640MiB")]),
            .object(["name": .string("mealie"), "cpu": .number(0), "mem": .string("80MiB")]),
        ])
        let storage: JSONValue = .object(["apps": .array([
            .object(["app": .string("paperless-ngx"), "bytes": .number(18e9)]),
            .object(["app": .string("immich"), "bytes": .number(3e9)]),
        ])])
        let apps = try status(#"{"apps":[{"id":"immich","name":"Immich","state":"running"},{"id":"mealie","name":"Mealie","state":"running"},{"id":"paperless-ngx","name":"Paperless-ngx","state":"running"},{"id":"vikunja","name":"Vikunja","state":"stopped"}]}"#).apps
        let now = UsageNow.from(usage: usage, storage: storage, apps: apps)
        #expect(now.read && now.processor == 183)
        #expect(now.memory == 1220 * 1_048_576)
        // Paperless-ngx holds the most memory; Immich, its two containers together, the most processor.
        #expect(now.rows.map(\.id) == ["paperless-ngx", "immich", "mealie"])
        #expect(now.heaviest?.id == "paperless-ngx" && now.busiest?.id == "immich" && now.busiest?.processor == 171)
        #expect(now.rows[0].disk == 18_000_000_000 && now.rows[2].disk == nil)
        #expect(now.appsData == 21_000_000_000)
        #expect(now.sample(at: .now)?.processor == 183)
    }

    @Test func beforeItsReadAndWhenIdle() throws {
        let none = UsageNow.from(usage: nil, storage: nil, apps: [])
        #expect(!none.read && none.rows.isEmpty && none.busiest == nil && none.appsData == nil)
        #expect(none.sample(at: .now) == nil)
        let idle = UsageNow.from(usage: .array([.object(["name": .string("a"), "cpu": .number(0.02), "mem": .string("10MiB")])]),
                                 storage: nil, apps: try status(#"{"apps":[{"id":"a","name":"A","state":"running"}]}"#).apps)
        #expect(idle.busiest == nil && idle.heaviest?.id == "a")
    }

    @Test func theWordsAsTheComputerSaysThem() {
        #expect(UsageNow.percent(51.4) == "51" && UsageNow.percent(4.24) == "4.2" && UsageNow.percent(0) == "0")
        #expect(UsageNow.memory(1_100_000_000) == "1.1 GB" && UsageNow.memory(640_000_000) == "640 MB" && UsageNow.memory(5) == "<1 MB" && UsageNow.memory(0) == "0 MB")
        #expect(UsageNow.disk(412_000_000_000) == "412 GB" && UsageNow.disk(3_400_000_000_000) == "3.4 TB" && UsageNow.disk(500_000_000) == "500 MB")
        let t = Date(timeIntervalSince1970: 1_800_000_000)
        #expect(UsageNow.span([]) == "Now")
        #expect(UsageNow.span([UsageSample(at: t, processor: 1, memory: 1)]) == "Now")
        #expect(UsageNow.span([UsageSample(at: t, processor: 1, memory: 1), UsageSample(at: t.addingTimeInterval(45), processor: 1, memory: 1)]) == "The last minute")
        #expect(UsageNow.span([UsageSample(at: t, processor: 1, memory: 1), UsageSample(at: t.addingTimeInterval(180), processor: 1, memory: 1)]) == "The last 3 minutes")
    }

    // The timeline keeps the last hour.
    @Test func theSamplesKeepAnHour() {
        let t = Date(timeIntervalSince1970: 1_800_000_000)
        let samples = [UsageSample(at: t.addingTimeInterval(-4000), processor: 1, memory: 1), UsageSample(at: t.addingTimeInterval(-60), processor: 2, memory: 2)]
        #expect(CardsViewModel.keeping(samples, now: t).map(\.processor) == [2])
    }
}
