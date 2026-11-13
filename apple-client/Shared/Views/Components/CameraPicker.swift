#if os(iOS)
import AVFoundation
import SwiftUI
import UIKit

/// Takes one photo with the camera (Add a Card's Take a Photo) and hands
/// back its bytes; nothing is kept on this device or added to Photos. The
/// photo is shrunk and stripped of its details before it's sent
/// (`ReceiptCodec.preparePhoto`).
struct CameraPicker: UIViewControllerRepresentable {
    /// The photo's bytes, or nil when it was cancelled; either way the
    /// camera is done and its cover is closed by the caller.
    let onDone: @MainActor (Data?) -> Void

    /// Whether to offer the camera: this device has one, and it wasn't
    /// refused (the first tap asks).
    @MainActor static var isAvailable: Bool {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else { return false }
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .denied, .restricted: return false
        default: return true
        }
    }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.cameraCaptureMode = .photo
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ uiViewController: UIImagePickerController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onDone: onDone) }

    @MainActor
    final class Coordinator: NSObject, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
        private let onDone: @MainActor (Data?) -> Void

        init(onDone: @escaping @MainActor (Data?) -> Void) {
            self.onDone = onDone
        }

        func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
            let image = info[.originalImage] as? UIImage
            onDone(image?.jpegData(compressionQuality: 0.9))
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onDone(nil)
        }
    }
}
#endif
