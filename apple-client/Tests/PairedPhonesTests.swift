import Foundation
import Testing
@testable import HomelabClient

/// Settings › Phones: the computer's paired phones
/// read as it sends them, and only less offered from the phone, never more.
@Suite struct PairedPhonesTests {
    private func phones() throws -> [PairedPhone] {
        try JSONDecoder().decode([PairedPhone].self, from: Data(#"""
        [
          {"id":"me","name":"Alex's iPhone","canChange":true,"finances":"edit","paired":"2026-11-02T10:00:00Z","lastSeen":"2026-11-19T09:00:00Z","this":true},
          {"id":"g","name":"Guest iPhone","canChange":true,"finances":"edit","paired":"2026-11-02T10:00:00Z","until":"2026-11-19T23:00:00Z"},
          {"id":"k","name":"Kitchen iPad","canChange":false,"finances":"card","kiosk":true,"paired":"2026-10-01T10:00:00Z","lastSeen":"0001-01-01T00:00:00Z"},
          {"id":"j","name":"Jordan's iPhone","canChange":false,"personName":"Jordan","paired":"2026-10-05T10:00:00Z"}
        ]
        """#.utf8))
    }

    @Test func readsThemAsTheComputerSendsThem() throws {
        let list = try phones()
        #expect(list.map(\.id) == ["me", "g", "k", "j"])
        #expect(list[0].isThis && !list[1].isThis)
        #expect(list[1].until != nil && list[0].until == nil)
        #expect(list[2].lastSeen == nil)            // Go's zero time is never shown
        #expect(list[3].personName == "Jordan" && list[3].finances == "")
        #expect(list[2].whose == "A wall screen" && list[3].whose == "Jordan's" && list[1].whose == "Yours")
        #expect(list[3].summary == "Jordan's · looks only · no Finances")
        #expect(list[2].summary == "Wall screen · looks only · the money card only")
        #expect(list[1].summary == "Can make changes · finances to change")
    }

    @Test func onlyLessIsOffered() throws {
        let list = try phones()
        #expect(PhoneLowering.offered(for: list[0]).isEmpty)   // this phone: its own This Device
        #expect(PhoneLowering.offered(for: list[1]) == [.looksOnly, .finances("view"), .finances("card"), .finances(""), .remove])
        #expect(PhoneLowering.offered(for: list[2]) == [.finances(""), .remove])
        #expect(PhoneLowering.offered(for: list[3]) == [.remove])
    }

    /// As the computer's LowerPhone reads them (phones_test.go).
    @Test func eachAsTheComputerReadsIt() {
        #expect(PhoneLowering.looksOnly.argument == "looksOnly")
        #expect(PhoneLowering.finances("view").argument == "finances:view")
        #expect(PhoneLowering.finances("").argument == "finances:")
        #expect(PhoneLowering.remove.argument == "remove")
        #expect(PhoneLowering.finances("").title == "Hide Finances")
    }
}
