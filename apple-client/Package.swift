// swift-tools-version: 6.0
//
// The app's sources as a Swift package, so they can be built and tested
// without the Xcode project:
//
//     cd apple-client
//     swift build          # compiles everything for macOS, in Swift 6 mode
//     swift test           # runs Tests/ (Swift Testing)
//
// The app itself is still made from the Xcode Multiplatform project the
// README describes. This package leaves out only its @main entry point,
// since a library can't have one.
import PackageDescription

let package = Package(
    name: "HomelabClient",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [
        .library(name: "HomelabClient", targets: ["HomelabClient"]),
    ],
    targets: [
        .target(
            name: "HomelabClient",
            path: "Shared",
            exclude: ["App/HomelabClientApp.swift", "App/PrivacyInfo.xcprivacy", "Assets.xcassets"],
            // The payee logos (scripts/make-payee-logos.mjs makes it).
            resources: [.copy("Resources/PayeeLogos.json")]
        ),
        .testTarget(
            name: "HomelabClientTests",
            dependencies: ["HomelabClient"],
            path: "Tests",
            // What the computer's own functions answer, for PayeeLogoTests,
            // its sealing for the tunnel, for TunnelSealTests, and what it says
            // of itself, for ContractTests, and the page's private Finances
            // sealing, for PrivateSealTests.
            resources: [.copy("Resources/PayeeVectors.json"), .copy("Resources/TunnelVectors.json"), .copy("Resources/CompanionContract.json"), .copy("Resources/PrivateSealVectors.json")]
        ),
    ],
    swiftLanguageModes: [.v6]
)
