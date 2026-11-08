import Foundation
import Testing
@testable import HomelabClient

// The top of Status: the ring's numbers and the first app that needs a
// look, and the Backups tile's words.
@Suite("Status overview")
struct StatusOverviewTests {
    @Test func theRingCountsAsTheComputer() throws {
        let status = try JSONDecoder.homelab().decode(HomelabStatus.self, from: Data(#"""
        {"apps":[{"id":"a","name":"A","state":"running"},{"id":"b","name":"B","state":"stopped"},
                 {"id":"homelab-companion","name":"Phone companion","state":"not running"},
                 {"id":"c","name":"C","state":"missing"},{"id":"d","name":"D","state":"running"}],
         "stopped":{"b":{"since":"2026-11-05T14:00:00Z"}}}
        """#.utf8))
        let headline = StatusHeadline(status: status)
        // The companion waiting for its scheduled jobs isn't counted.
        #expect(headline.running == 2 && headline.total == 4)
        #expect(headline.share == 0.5)
        // B was stopped on purpose; C is missing: it needs the look.
        #expect(headline.attentionID == "c" && headline.attentionCount == 1)
    }

    @Test func nothingYet() {
        let headline = StatusHeadline(status: nil)
        #expect(headline.running == 0 && headline.total == 0 && headline.share == 0)
        #expect(headline.attentionID == nil)
    }

    @Test func theBackupsTile() throws {
        func o(_ json: String) throws -> BackupOverview { try JSONDecoder.homelab().decode(BackupOverview.self, from: Data(json.utf8)) }
        let fresh = StatusTiles.backups(try o(#"{"lastRun":"2026-11-05T03:12:00Z","copies":[{"id":"a","name":"A","state":"fresh"},{"id":"b","name":"B","state":"fresh"}]}"#))
        #expect(fresh.value == "All 2 fresh" && !fresh.alert && fresh.detail != nil)
        let one = StatusTiles.backups(try o(#"{"copies":[{"id":"a","name":"A","state":"fresh"}]}"#))
        #expect(one.value == "1 fresh" && one.detail == nil)
        let stale = StatusTiles.backups(try o(#"{"copies":[{"id":"a","name":"A","state":"stale"},{"id":"b","name":"B","state":"fresh"}],"stale":1,"shrank":1}"#))
        #expect(stale.value == "2 need a look" && stale.alert)
        let none = StatusTiles.backups(try o(#"{"copies":[]}"#))
        #expect(none.value == "None yet" && !none.alert)
        #expect(StatusTiles.capitalized("daily at 04:00") == "Daily at 04:00")
        #expect(StatusTiles.capitalized("") == nil)
    }
}
