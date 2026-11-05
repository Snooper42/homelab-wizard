import Foundation

/// Splits a byte stream into lines, at most `maxLineBytes` each. Accepts LF,
/// CRLF and CR endings, as the SSE spec requires.
///
/// `URLSession.AsyncBytes.lines` can't be used for SSE: it drops empty
/// lines, which are what end an event. It also has no length limit.
struct LineBuffer: Sendable {
    struct LineTooLong: Error {}

    let maxLineBytes: Int
    private var bytes: [UInt8] = []
    private var lastWasCR = false

    init(maxLineBytes: Int) {
        self.maxLineBytes = maxLineBytes
    }

    /// Adds one byte. Returns a line, without its ending, when one is complete.
    mutating func append(_ byte: UInt8) throws -> [UInt8]? {
        switch byte {
        case 0x0A: // LF
            if lastWasCR {
                lastWasCR = false
                return nil // the second half of a CRLF
            }
            return takeLine()
        case 0x0D: // CR
            lastWasCR = true
            return takeLine()
        default:
            lastWasCR = false
            guard bytes.count < maxLineBytes else { throw LineTooLong() }
            bytes.append(byte)
            return nil
        }
    }

    private mutating func takeLine() -> [UInt8] {
        defer { bytes.removeAll(keepingCapacity: true) }
        return bytes
    }
}

/// One server-sent event.
struct ServerSentEvent: Sendable, Equatable {
    var event: String
    var data: String
    var id: String?
}

/// An incremental parser for `text/event-stream`, following the WHATWG
/// rules. It's bounded: a line or an event over `maxEventBytes` throws, so
/// a broken or hostile stream can't use up memory.
struct SSEParser: Sendable {
    enum Output: Sendable, Equatable {
        case event(ServerSentEvent)
        /// A comment line (`: still here`), which the companion sends every
        /// 30 seconds as a heartbeat.
        case comment
    }

    struct EventTooLarge: Error {}

    let maxEventBytes: Int
    private var lines: LineBuffer
    private var data: [String] = []
    private var dataBytes = 0
    private var eventType = ""
    private var lastEventID: String?
    private var atStart = true

    init(maxEventBytes: Int = 4 << 20) {
        self.maxEventBytes = maxEventBytes
        self.lines = LineBuffer(maxLineBytes: maxEventBytes)
    }

    /// Adds one byte. Returns an event or a comment once one is complete.
    mutating func consume(_ byte: UInt8) throws -> Output? {
        guard var line = try lines.append(byte) else { return nil }
        if atStart {
            atStart = false
            if line.starts(with: [0xEF, 0xBB, 0xBF]) { line.removeFirst(3) } // BOM
        }
        return try process(line)
    }

    private mutating func process(_ line: [UInt8]) throws -> Output? {
        if line.isEmpty { return dispatch() }
        if line.first == UInt8(ascii: ":") { return .comment }

        let field: String
        let value: String
        if let colon = line.firstIndex(of: UInt8(ascii: ":")) {
            field = String(decoding: line[..<colon], as: UTF8.self)
            var rest = line[line.index(after: colon)...]
            if rest.first == UInt8(ascii: " ") { rest = rest.dropFirst() }
            value = String(decoding: rest, as: UTF8.self)
        } else {
            field = String(decoding: line, as: UTF8.self)
            value = ""
        }

        switch field {
        case "data":
            dataBytes += value.utf8.count + 1
            guard dataBytes <= maxEventBytes else { throw EventTooLarge() }
            data.append(value)
        case "event":
            eventType = value
        case "id":
            if !value.contains("\0") { lastEventID = value }
        default:
            // retry and unknown fields: the companion sends neither, and
            // the reconnect timing is the client's own.
            break
        }
        return nil
    }

    private mutating func dispatch() -> Output? {
        defer {
            data.removeAll(keepingCapacity: true)
            dataBytes = 0
            eventType = ""
        }
        guard !data.isEmpty else { return nil }
        return .event(ServerSentEvent(
            event: eventType.isEmpty ? "message" : eventType,
            data: data.joined(separator: "\n"),
            id: lastEventID
        ))
    }
}
