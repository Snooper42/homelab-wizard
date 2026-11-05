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
            exclude: ["App/HomelabClientApp.swift", "App/PrivacyInfo.xcprivacy"]
        ),
        .testTarget(
            name: "HomelabClientTests",
            dependencies: ["HomelabClient"],
            path: "Tests"
        ),
    ],
    swiftLanguageModes: [.v6]
)
