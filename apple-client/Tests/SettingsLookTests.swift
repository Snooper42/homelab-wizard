import Testing
@testable import HomelabClient

// Settings' rows: each section of the computer's Settings has its own icon.
@Suite("Settings look")
struct SettingsLookTests {
    @Test func eachSectionHasItsIcon() {
        #expect(ComputerView.look(of: "This Mac").symbol == "desktopcomputer")
        #expect(ComputerView.look(of: "This Machine").symbol == "desktopcomputer")
        #expect(ComputerView.look(of: "Storage").symbol == "externaldrive.fill")
        #expect(ComputerView.look(of: "Domain").symbol == "globe")
        #expect(ComputerView.look(of: "Nginx Proxy Manager and CrowdSec").symbol == "lock.shield.fill")
        #expect(ComputerView.look(of: "AdGuard Home").symbol == "hand.raised.fill")
        #expect(ComputerView.look(of: "Notifications").symbol == "bell.fill")
        #expect(ComputerView.look(of: "Tidy Up").symbol == "sparkles")
        #expect(ComputerView.look(of: "App ports (the installer moves these if something else holds them)").symbol == "number")
        #expect(ComputerView.look(of: "App settings and secrets").symbol == "key.fill")
        #expect(ComputerView.look(of: "Something new").symbol == "gearshape.fill")
    }
}
