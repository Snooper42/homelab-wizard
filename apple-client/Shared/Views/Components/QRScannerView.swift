#if os(iOS)
import SwiftUI
import VisionKit

/// Scans the QR code the computer shows for pairing (`homelab phone pair`).
/// It reports the first QR code's text once and stops. What the code says
/// goes through the same https-only parser as a typed address, and nothing
/// pairs until the person taps Pair, with the host in front of them: a
/// QR code stuck somewhere can't pair this device by itself.
struct QRScannerView: UIViewControllerRepresentable {
    let onScan: @MainActor (String) -> Void

    /// Whether this device can scan (a camera, a recent chip, permission not refused).
    @MainActor static var isAvailable: Bool {
        DataScannerViewController.isSupported && DataScannerViewController.isAvailable
    }

    func makeUIViewController(context: Context) -> DataScannerViewController {
        let scanner = DataScannerViewController(
            recognizedDataTypes: [.barcode(symbologies: [.qr])],
            qualityLevel: .balanced,
            recognizesMultipleItems: false,
            isHighFrameRateTrackingEnabled: false,
            isHighlightingEnabled: true
        )
        scanner.delegate = context.coordinator
        try? scanner.startScanning()
        return scanner
    }

    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {}

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    @MainActor
    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        private let onScan: @MainActor (String) -> Void
        private var done = false

        init(onScan: @escaping @MainActor (String) -> Void) {
            self.onScan = onScan
        }

        func dataScanner(_ scanner: DataScannerViewController, didAdd addedItems: [RecognizedItem], allItems: [RecognizedItem]) {
            guard !done else { return }
            for item in addedItems {
                if case .barcode(let code) = item, let text = code.payloadStringValue, text.utf8.count <= 2048 {
                    done = true
                    scanner.stopScanning()
                    onScan(text)
                    return
                }
            }
        }
    }
}
#endif
