import Foundation
import LocalAuthentication

/// Asks the device owner to prove they're present: Face ID, Touch ID,
/// Optic ID, or the device passcode / Mac password.
///
/// - The policy is `.deviceOwnerAuthentication`. Biometrics fall back to the
///   passcode or account password, so a biometric lockout doesn't lock the
///   owner out.
/// - Each attempt uses a new `LAContext`, invalidated afterwards. A context
///   that already succeeded is never reused, and no reuse window is allowed
///   (`touchIDAuthenticationAllowableReuseDuration = 0`).
/// - It fails closed. A device with no passcode at all can't be
///   authenticated, so the app stays locked.
///
/// It holds no state. Each `LAContext` is created, used and invalidated
/// inside one nonisolated call, so the context never crosses an actor
/// boundary under Swift 6 strict concurrency.
struct BiometricAuthManager: Sendable {
    enum Method: Equatable, Sendable {
        case faceID, touchID, opticID
        /// The passcode or account password only (no biometrics enrolled).
        case passcode
        /// No passcode is set, so nothing can unlock the app.
        case unavailable

        var unlockLabel: String {
            switch self {
            case .faceID: "Unlock with Face ID"
            case .touchID: "Unlock with Touch ID"
            case .opticID: "Unlock with Optic ID"
            #if os(macOS)
            case .passcode: "Unlock with Password"
            #else
            case .passcode: "Unlock with Passcode"
            #endif
            case .unavailable: "Unlock"
            }
        }

        var systemImage: String {
            switch self {
            case .faceID: "faceid"
            case .touchID: "touchid"
            case .opticID: "opticid"
            case .passcode, .unavailable: "lock.fill"
            }
        }
    }

    enum AuthError: LocalizedError, Equatable, Sendable {
        /// The person, the app or the system dismissed the prompt. Not an error worth showing.
        case cancelled
        case noPasscode
        case failed
        case unavailable

        var errorDescription: String? {
            switch self {
            case .cancelled:
                nil
            case .noPasscode:
                #if os(macOS)
                "Set a login password for this Mac to use Homelab. It won't open without one."
                #else
                "Set a passcode in Settings to use Homelab. Without one, anyone holding this device could control your servers, so the app won't open."
                #endif
            case .failed:
                "That didn't work. Try again."
            case .unavailable:
                "Device authentication isn't available right now. Try again."
            }
        }
    }

    /// What `authenticate` will ask for, as the lock screen should label it.
    func availableMethod() -> Method {
        let context = LAContext()
        defer { context.invalidate() }
        // canEvaluatePolicy also sets biometryType, which is .none when
        // nothing is enrolled; the policy then asks for the passcode.
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: nil) else {
            return .unavailable
        }
        switch context.biometryType {
        case .faceID: return .faceID
        case .touchID: return .touchID
        case .opticID: return .opticID
        default: return .passcode
        }
    }

    /// Returns once the owner has authenticated. Otherwise throws `AuthError`.
    func authenticate(reason: String) async throws {
        let context = LAContext()
        context.touchIDAuthenticationAllowableReuseDuration = 0
        context.localizedCancelTitle = "Cancel"
        defer { context.invalidate() }

        var canError: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthentication, error: &canError) else {
            let mapped = Self.map(canError)
            Log.security.error("Device authentication unavailable: \(String(describing: mapped), privacy: .public)")
            throw mapped
        }

        let ok: Bool
        do {
            ok = try await context.evaluatePolicy(.deviceOwnerAuthentication, localizedReason: reason)
        } catch {
            let mapped = Self.map(error as NSError)
            if mapped != .cancelled {
                Log.security.error("Device authentication failed: \(String(describing: mapped), privacy: .public)")
            }
            throw mapped
        }
        guard ok else { throw AuthError.failed }
        Log.security.notice("Device owner authenticated")
    }

    private static func map(_ error: NSError?) -> AuthError {
        guard let error, error.domain == LAError.errorDomain else { return .unavailable }
        switch LAError.Code(rawValue: error.code) {
        case .userCancel, .appCancel, .systemCancel, .userFallback:
            return .cancelled
        case .passcodeNotSet:
            return .noPasscode
        case .authenticationFailed:
            return .failed
        default:
            return .unavailable
        }
    }
}
