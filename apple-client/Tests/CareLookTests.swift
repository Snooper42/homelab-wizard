import Foundation
import Testing
@testable import HomelabClient

/// Settings' Automatic Care and Phones rows as the redesign's phone picture,
/// in the computer's words. Made-up phones.
@Suite struct CareLookTests {
    private func phones(_ rows: String) throws -> [PairedPhone] {
        try JSONDecoder().decode([PairedPhone].self, from: Data("[\(rows)]".utf8))
    }

    @Test func eachCareSettingItsSymbolAndLine() {
        let heal = CareLook.row("AUTO_HEAL", value: "true")
        #expect(heal?.title == "Restart an app that stops answering" && heal?.subtitle == "Checked every 15 minutes")
        #expect(CareLook.row("AUTO_ROLLBACK", value: "true")?.subtitle == "Puts the version before back by itself")
        #expect(CareLook.row("QUIET_HOURS", value: "22-7")?.subtitle == "10 PM – 7 AM")
        #expect(CareLook.row("DESKTOP_ALERTS", value: "true")?.subtitle == nil)
        #expect(CareLook.row("DOMAIN", value: "example.com") == nil)
    }

    @Test func quietHoursAsTheComputerSaysThem() {
        #expect(CareLook.quietWords("22-7") == "10 PM – 7 AM")
        #expect(CareLook.quietWords(" 0-12 ") == "12 AM – 12 PM")
        #expect(CareLook.quietWords("") == "Off")
        #expect(CareLook.quietWords("late") == "late")
        #expect(CareLook.quietWords("+1-7") == "+1-7")
    }

    @Test func howManyArePairedAndWhichOnlyLook() throws {
        let me = #"{"id":"me","name":"Alex's iPhone","canChange":true,"this":true}"#
        let jordan = #"{"id":"j","name":"Jordan's iPhone","canChange":false,"personName":"Jordan"}"#
        let kitchen = #"{"id":"k","name":"Kitchen iPad","canChange":false,"kiosk":true}"#
        #expect(CareLook.phones(try phones([me, jordan].joined(separator: ","))) == "2 paired · Jordan's looks only")
        #expect(CareLook.phones(try phones([me, kitchen].joined(separator: ","))) == "2 paired · Kitchen iPad looks only")
        #expect(CareLook.phones(try phones([me, jordan, kitchen].joined(separator: ","))) == "3 paired · 2 look only")
        #expect(CareLook.phones(try phones(me)) == "1 paired")
        #expect(CareLook.phones([]) == "None paired yet")
        #expect(CareLook.phones(nil) == nil)
    }
}
