#if os(iOS)
import AVFoundation
import SwiftUI
import VisionKit

/// Scans the QR code the computer shows for pairing (`homelab phone pair`).
/// It reports the first QR code's text once and stops. What the code says
/// goes through the same https-only parser as a typed address, and nothing
/// pairs until the person taps Pair, with the host in front of them: a
/// QR code stuck somewhere can't pair this device by itself.
struct QRScannerView: UIViewControllerRepresentable {
    let onScan: @MainActor (String) -> Void

    /// Whether to offer scanning: this device can (a camera, a recent chip),
    /// and the camera wasn't refused. `DataScannerViewController.isAvailable`
    /// stays false until the camera is allowed, so on a fresh install it
    /// would hide the button that asks; `requestAccess()` asks on the tap.
    @MainActor static var isAvailable: Bool {
        guard DataScannerViewController.isSupported else { return false }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .denied, .restricted: return false
        default: return true
        }
    }

    /// Asks for the camera the first time, then whether scanning can start.
    @MainActor static func requestAccess() async -> Bool {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized:
            return DataScannerViewController.isAvailable
        case .notDetermined:
            let granted = await AVCaptureDevice.requestAccess(for: .video)
            return granted && DataScannerViewController.isAvailable
        default:
            return false
        }
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
        return scanner
    }

    /// Scanning starts only once the scanner is on screen: started while
    /// it's being made, it can fail without a word and the camera never
    /// reads. SwiftUI calls this right after making it, and the start waits
    /// one turn of the main thread so the sheet has put it up.
    func updateUIViewController(_ scanner: DataScannerViewController, context: Context) {
        context.coordinator.start(scanner)
    }

    static func dismantleUIViewController(_ scanner: DataScannerViewController, coordinator: Coordinator) {
        scanner.stopScanning()
    }

    func makeCoordinator() -> Coordinator { Coordinator(onScan: onScan) }

    @MainActor
    final class Coordinator: NSObject, DataScannerViewControllerDelegate {
        private let onScan: @MainActor (String) -> Void
        private var done = false
        private var started = false

        init(onScan: @escaping @MainActor (String) -> Void) {
            self.onScan = onScan
        }

        func start(_ scanner: DataScannerViewController) {
            guard !started, !done else { return }
            started = true
            Task { @MainActor [weak self, weak scanner] in
                guard let self, let scanner, !self.done, !scanner.isScanning else { return }
                do {
                    try scanner.startScanning()
                } catch {
                    // Camera refused or in use: the Cancel button still closes it,
                    // and the address and code can be typed instead.
                    Log.ui.error("QR scanner did not start")
                    self.started = false
                }
            }
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
