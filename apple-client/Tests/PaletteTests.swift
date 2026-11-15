import Foundation
import Testing
@testable import HomelabClient

/// The iPad's ⌘K palette finds what the computer's finds (web/src/palette/commands.ts)
/// and offers only what this device may do. Every name is made up.
@Suite("The command palette")
struct PaletteTests {
    private func app(_ id: String, _ name: String, state: String = "running") throws -> AppStatus {
        try JSONDecoder.homelab().decode(AppStatus.self, from: Data(#"{"id":"\#(id)","name":"\#(name)","state":"\#(state)"}"#.utf8))
    }

    private func groups() throws -> [AppGroup] {
        [AppGroup(label: "Media", apps: [try app("immich", "Immich"), try app("jellyfin", "Jellyfin"), try app("kavita", "Kavita", state: "stopped")]),
         AppGroup(label: "Security", apps: [try app("vaultwarden", "Vaultwarden")])]
    }

    @Test func wordsAsTheComputerMatchesThem() {
        #expect(Palette.words("Café: Open-Its Page") == ["cafe", "open", "its", "page"])
    }

    @Test func theAppTypedFirst() throws {
        let all = Palette.commands(screens: [.status(.all), .backups, .finances, .setup, .settings], groups: try groups(),
                                   can: Palette.Can(seeFinances: true, change: true, backUp: true),
                                   available: { $0.state == "running" ? [.restart, .stop] : [.start] })
        let found = Palette.match(all, "imm")
        #expect(found.map(\.label) == ["Immich: Open Its Page", "Immich: Restart", "Immich: Stop\u{2026}", "Immich: Logs"])
        // Its label's own words first, then those found by its group.
        let media = Palette.match(all, "media")
        #expect(media.first?.section == "Groups" || media.first?.label.hasPrefix("Immich") == true)
        let restartMedia = Palette.match(all, "restart media").map(\.label)
        #expect(restartMedia.prefix(2).elementsEqual(["Immich: Restart", "Jellyfin: Restart"]))
        #expect(restartMedia.contains("Restart 2 apps"))
        // A screen by its own word, or the computer's other words for it.
        #expect(Palette.match(all, "money").first?.label == "Finances")
        #expect(Palette.match(all, "Backups").first?.action == .screen(.backups))
        // Stop asks a second press.
        #expect(all.first { $0.id == "app:immich:stop" }?.asks == "stop Immich")
        #expect(all.first { $0.id == "group:Media:stop" }?.asks == "stop 2 apps in Media")
        #expect(all.contains { $0.label == "Start 1 app Stopped" })
        // Nothing typed: everything, in the list's order.
        #expect(Palette.match(all, " ").count == all.count)
    }

    @Test func onlyWhatThisDeviceMayDo() throws {
        let look = Palette.commands(screens: [.status(.all), .settings], groups: try groups(), can: Palette.Can(),
                                    available: { _ in [.restart, .stop] })
        // A device that only looks: pages and logs, no change, and no Finances.
        #expect(!look.contains { if case .app = $0.action { return true }; if case .group = $0.action { return true }; return false })
        #expect(!look.contains { $0.section == "Finances" || $0.action == .backUpNow })
        #expect(look.contains { $0.action == .logs("immich") })
        let finances = Palette.commands(screens: [], groups: [], can: Palette.Can(seeFinances: true, importFile: true, showAmounts: true),
                                        available: { _ in [] })
        #expect(Array(finances.map(\.label).prefix(3)) == ["Show Amounts", "Import a File", "Transactions"])
        #expect(finances.filter { $0.section == "Finances" }.count == DeepLink.FinancePage.menuOrder.count)
    }
}
