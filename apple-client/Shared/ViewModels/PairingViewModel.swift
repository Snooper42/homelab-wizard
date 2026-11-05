import Foundation
import Observation
#if canImport(UIKit)
import UIKit
#endif

@MainActor
@Observable
final class PairingViewModel {
    private(set) var serverAddress = ""
    /// Always sanitized: upper case, only the code alphabet, at most 8 characters.
    private(set) var code = ""
    var deviceName: String
    /// A wall screen or TV: the computer makes it look-only for good.
    var isWallScreen = false
    private(set) var isPairing = false
    private(set) var errorMessage: String?
    /// These go up by one per outcome, to trigger haptics.
    private(set) var successCount = 0
    private(set) var failureCount = 0

    @ObservationIgnored private let api: APIClient
    @ObservationIgnored private let onPaired: @MainActor (DeviceInfo) -> Void

    init(api: APIClient, onPaired: @escaping @MainActor (DeviceInfo) -> Void) {
        self.api = api
        self.onPaired = onPaired
        deviceName = Self.defaultDeviceName()
    }

    var isCodeComplete: Bool { code.count == PairingCode.length }

    var canSubmit: Bool {
        !isPairing && isCodeComplete && !serverAddress.trimmingCharacters(in: .whitespaces).isEmpty
    }

    /// The code split in two, as the computer shows it ("ABCD EFGH").
    var formattedCode: String {
        guard code.count > 4 else { return code }
        return "\(code.prefix(4)) \(code.dropFirst(4))"
    }

    func setServerAddress(_ text: String) {
        errorMessage = nil
        // A pasted pairing link carries both the address and the code.
        if let parsed = try? ServerEndpoint.parse(text), let linkCode = parsed.code {
            serverAddress = parsed.endpoint.baseURL.absoluteString
            code = linkCode.value
            return
        }
        serverAddress = text
    }

    /// What a scanned QR code said. Only a pairing link with an https
    /// address and a code is taken; anything else says why.
    func scanned(_ text: String) {
        errorMessage = nil
        do {
            let parsed = try ServerEndpoint.parse(text)
            guard let code = parsed.code else {
                fail("That QR code isn't a pairing code. On the computer, run homelab phone pair.")
                return
            }
            serverAddress = parsed.endpoint.baseURL.absoluteString
            self.code = code.value
        } catch ServerEndpoint.ValidationError.insecureScheme {
            fail("That QR code is for the home Wi-Fi link (http). Use the Tailscale or homelab-domain link instead: on the computer, Settings › Phones.")
        } catch {
            fail(error.localizedDescription)
        }
    }

    func setCode(_ text: String) {
        errorMessage = nil
        code = PairingCode.sanitize(text)
    }

    func pair() async {
        guard canSubmit else { return }
        errorMessage = nil

        let endpoint: ServerEndpoint
        do {
            endpoint = try ServerEndpoint.parse(serverAddress).endpoint
        } catch {
            fail(error.localizedDescription)
            return
        }
        guard let pairingCode = PairingCode(code) else {
            fail("Enter all \(PairingCode.length) characters of the code.")
            return
        }

        isPairing = true
        defer { isPairing = false }
        do {
            let device = try await api.pair(code: pairingCode, deviceName: deviceName, at: endpoint, kiosk: isWallScreen)
            code = "" // it's spent now; don't keep it
            successCount += 1
            onPaired(device)
        } catch {
            let apiError = APIError.from(error)
            fail(apiError.errorDescription ?? "Pairing failed.")
        }
    }

    private func fail(_ message: String) {
        errorMessage = message
        failureCount += 1
    }

    private static func defaultDeviceName() -> String {
        #if os(macOS)
        return Host.current().localizedName ?? "Mac"
        #else
        return UIDevice.current.name
        #endif
    }
}
