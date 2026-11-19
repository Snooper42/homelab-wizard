import Foundation
import Testing
@testable import HomelabClient

/// The app's own version on Settings › About (scripts/app-version.sh makes it).
@Suite("The app's version")
struct AppVersionTests {
    @Test func versionAndBuild() throws {
        let v = try #require(AppVersion.from(["CFBundleShortVersionString": "0.4.3", "CFBundleVersion": "118"]))
        #expect(v == AppVersion(version: "0.4.3", build: "118"))
        #expect(v.text == "0.4.3 (118)")
    }

    @Test func withoutTheHistoryOnlyTheVersion() throws {
        // app-version.sh prints build 0 when it can't count the changes.
        let buildZero = try #require(AppVersion.from(["CFBundleShortVersionString": "0.4.0", "CFBundleVersion": "0"]))
        #expect(buildZero.text == "0.4.0")
        let noBuild = try #require(AppVersion.from(["CFBundleShortVersionString": "0.4.0"]))
        #expect(noBuild.text == "0.4.0")
    }

    @Test func nothingToShow() {
        #expect(AppVersion.from(nil) == nil)
        #expect(AppVersion.from([:]) == nil)
        #expect(AppVersion.from(["CFBundleShortVersionString": "  "]) == nil)
        #expect(AppVersion.from(["CFBundleShortVersionString": 4]) == nil)
    }
}
