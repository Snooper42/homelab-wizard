import Foundation

/// The Homelab app's own version, as `scripts/app-version.sh` worked it out
/// when the Xcode project was made: "0.4.3", and the build, "118".
/// Settings › About shows it, so it's plain which version is on the phone.
struct AppVersion: Sendable, Equatable {
    let version: String
    let build: String

    /// From an Info.plist's keys. Nil when there's no version to show, as in
    /// `swift test` and previews, which have no Info.plist of the app's.
    nonisolated static func from(_ info: [String: Any]?) -> AppVersion? {
        guard let version = (info?["CFBundleShortVersionString"] as? String)?
            .trimmingCharacters(in: .whitespaces), !version.isEmpty else { return nil }
        let build = (info?["CFBundleVersion"] as? String)?.trimmingCharacters(in: .whitespaces) ?? ""
        return AppVersion(version: version, build: build)
    }

    /// This copy of the app's.
    nonisolated static var current: AppVersion? { from(Bundle.main.infoDictionary) }

    /// "0.4.3 (118)"; just "0.4.3" when the project was made without the
    /// history to count builds from (build 0), or with none at all.
    var text: String {
        build.isEmpty || build == "0" ? version : "\(version) (\(build))"
    }
}
