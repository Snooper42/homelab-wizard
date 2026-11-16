import Foundation
import Testing

/// The iPad's split view publishes focused values the menus read (ScreenChoice,
/// PaletteFocus): closures, so never equal to the last. A view that also
/// reads one (`@FocusedValue`) is drawn again each time any changes, which
/// publishes new ones, which draws it again: the iPad stuck on its first
/// frame from #720 to its fix (`SplitDashboard` read `\.transactions`). So
/// only the menus (`Shared/App`, `Commands`) read focused values; a view
/// that needs one gets it passed in when a command runs.
@Suite("Focused values")
struct FocusedValueTests {
    @Test func noViewReadsAFocusedValue() throws {
        let views = URL(fileURLWithPath: #filePath).deletingLastPathComponent().deletingLastPathComponent()
            .appendingPathComponent("Shared").appendingPathComponent("Views")
        let files = try #require(FileManager.default.enumerator(at: views, includingPropertiesForKeys: nil))
        var checked = 0
        var readers: [String] = []
        for case let file as URL in files where file.pathExtension == "swift" {
            checked += 1
            let text = try String(contentsOf: file, encoding: .utf8)
            if ["@FocusedValue", "@FocusedBinding", "@FocusedObject"].contains(where: text.contains) {
                readers.append(file.lastPathComponent)
            }
        }
        #expect(checked > 10, "the views weren't found under \(views.path)")
        #expect(readers.isEmpty, "these views read a focused value, which redraws them forever: \(readers)")
    }
}
