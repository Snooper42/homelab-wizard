import Foundation

/// What can go wrong talking to the companion, in words a person can act on.
///
/// The cases carry no request URLs, headers or bodies, so nothing secret
/// can reach the UI or a log through an error. Server messages are
/// shortened and control characters removed before they're kept.
enum APIError: LocalizedError, Equatable, Sendable {
    /// No credential is stored. Pair first.
    case notPaired
    /// 401: the computer doesn't know this device any more (`homelab phone remove`).
    case unauthorized
    /// 403, with the computer's explanation (for example, look-only devices).
    case forbidden(String)
    /// 429: too many wrong pairing codes.
    case rateLimited(String)
    case server(status: Int, message: String?)
    /// The server tried to send the request elsewhere. Redirects are never
    /// followed, because the Authorization header could go with them.
    case redirectRefused
    /// The answer came from a different origin than the one asked.
    case originMismatch
    case transport(URLError.Code)
    case invalidResponse
    case responseTooLarge
    case decoding
    case invalidMethodName
    /// An app id with characters a catalog id never has. It isn't sent.
    case invalidAppID
    /// A change ran on the computer and failed. `log` is what the command
    /// printed (Docker's output), already cleaned up for display.
    case actionFailed(message: String, log: [String])
    case keychain(KeychainManager.KeychainError)

    var errorDescription: String? {
        switch self {
        case .notPaired:
            "This device isn't paired yet."
        case .unauthorized:
            "The computer doesn't recognize this device any more. Pair it again."
        case .forbidden(let message), .rateLimited(let message):
            message
        case .server(let status, let message):
            message ?? "The computer answered with an error (\(status))."
        case .redirectRefused:
            "The computer tried to redirect this request. For safety, it wasn't followed. Check the address."
        case .originMismatch:
            "The answer came from a different server than the one asked."
        case .transport(let code):
            Self.describe(code)
        case .invalidResponse:
            "The computer's answer didn't make sense. Is this the Homelab companion?"
        case .responseTooLarge:
            "The computer's answer was too large."
        case .decoding:
            "The computer's answer couldn't be read. The app and the computer may be different versions."
        case .invalidMethodName, .invalidAppID:
            "That action isn't available."
        case .actionFailed(let message, _):
            message
        case .keychain(let error):
            error.errorDescription
        }
    }

    /// The case name with no payload, safe to log as `.public`. Server
    /// messages can name devices or hosts, so they never go in it.
    var logName: String {
        switch self {
        case .notPaired: "notPaired"
        case .unauthorized: "unauthorized"
        case .forbidden: "forbidden"
        case .rateLimited: "rateLimited"
        case .server(let status, _): "server(\(status))"
        case .redirectRefused: "redirectRefused"
        case .originMismatch: "originMismatch"
        case .transport(let code): "transport(\(code.rawValue))"
        case .invalidResponse: "invalidResponse"
        case .responseTooLarge: "responseTooLarge"
        case .decoding: "decoding"
        case .invalidMethodName: "invalidMethodName"
        case .invalidAppID: "invalidAppID"
        case .actionFailed: "actionFailed"
        case .keychain: "keychain"
        }
    }

    /// Whether trying again later could help.
    var isTransient: Bool {
        switch self {
        case .transport, .server, .invalidResponse: true
        default: false
        }
    }

    static func from(_ error: Error) -> APIError {
        if let api = error as? APIError { return api }
        if let keychain = error as? KeychainManager.KeychainError { return .keychain(keychain) }
        if let url = error as? URLError { return .transport(url.code) }
        if error is DecodingError { return .decoding }
        return .invalidResponse
    }

    /// Cleans up a message from the server before it's shown: no control
    /// characters, at most 300 characters.
    static func sanitize(_ message: String?) -> String? {
        guard let message else { return nil }
        let cleaned = String(message.unicodeScalars.filter { !CharacterSet.controlCharacters.contains($0) })
            .trimmingCharacters(in: .whitespacesAndNewlines)
        guard !cleaned.isEmpty else { return nil }
        return String(cleaned.prefix(300))
    }

    /// Cleans up a command's output before it's kept or shown: the last
    /// 400 lines, no control characters, at most 1000 characters per line.
    static func sanitizeLog(_ lines: [String]?) -> [String] {
        guard let lines else { return [] }
        return lines.suffix(400).map { line in
            let cleaned = String(line.unicodeScalars.filter { $0 == "\t" || !CharacterSet.controlCharacters.contains($0) })
            return String(cleaned.prefix(1000))
        }
    }

    private static func describe(_ code: URLError.Code) -> String {
        switch code {
        case .notConnectedToInternet, .networkConnectionLost:
            "No network connection."
        case .timedOut:
            "The computer didn't answer in time."
        case .cannotFindHost, .dnsLookupFailed:
            "The computer's address couldn't be found. Is this device at home (or on Tailscale, if you use it)? A VPN can hide the home network's names."
        case .cannotConnectToHost:
            "The computer didn't accept the connection. Is `homelab serve` running?"
        case .serverCertificateUntrusted, .serverCertificateHasBadDate,
             .serverCertificateNotYetValid, .serverCertificateHasUnknownRoot,
             .clientCertificateRejected, .secureConnectionFailed:
            "The secure connection couldn't be verified. Nothing was sent."
        case .appTransportSecurityRequiresSecureConnection:
            "Only https connections are allowed."
        case .cancelled:
            "Cancelled."
        default:
            "The connection failed."
        }
    }
}
