import Foundation
import Testing
@testable import HomelabClient

/// Setup's checklist on the owner's phone: counted
/// and worded as the computer's Setup counts and words it, and only the steps
/// the computer marks the phone's to do offered.
@Suite struct SetupChecklistTests {
    private func steps(_ json: String) throws -> [SetupStepInfo] {
        try JSONDecoder().decode([SetupStepInfo].self, from: Data(json.utf8))
    }

    @Test func countsAsTheComputerDoes() throws {
        let list = try steps(#"""
        [{"id":"started","title":"The homelab is started","why":"w","state":"done"},
         {"id":"jobs","title":"Scheduled jobs","why":"w","state":"todo","forYou":true},
         {"id":"adguard","title":"Home DNS answers","why":"w","state":"todo","forYou":true},
         {"id":"backups","title":"Backups leave this machine","why":"w","state":"todo"},
         {"id":"heartbeat","title":"Alerts when this machine is down","why":"w","state":"todo","later":true},
         {"id":"tunnel","title":"Access away from home","why":"w","state":"done","later":true}]
        """#)
        let p = SetupChecklist.progress(list)
        #expect(p.done == 2 && p.total == 5 && p.wait == 1 && p.left == 3)
        #expect(SetupChecklist.title(list) == "Finish setting up")
        #expect(SetupChecklist.count(list) == "2 of 5 done · 1 can wait")
        #expect(SetupChecklist.forYou(list).map(\.id) == ["jobs", "adguard"])
        #expect(SetupChecklist.buttonTitle(list) == "Do the 2 I Can Do for You")
    }

    @Test func allDoneAndOneLeft() throws {
        let done = try steps(#"[{"id":"started","title":"t","why":"w","state":"done"},{"id":"heartbeat","title":"t","why":"w","state":"done","later":true}]"#)
        #expect(SetupChecklist.title(done) == "Everything is set up")
        #expect(SetupChecklist.count(done) == "")
        #expect(SetupChecklist.buttonTitle(done) == nil)
        let one = try steps(#"[{"id":"jobs","title":"t","why":"w","state":"todo","forYou":true}]"#)
        #expect(SetupChecklist.buttonTitle(one) == "Do It for Me")
    }
}
