import Foundation

/// A setup step as the computer's `Setup` sends it to the owner's phone (the
/// owner's yes, Nov 19): what it is and why, whether it's done, and whether
/// the phone may do it (`forYou`: the homelab runs it by itself).
struct SetupStepInfo: Decodable, Sendable, Equatable, Identifiable {
    let id: String
    let title: String
    let why: String
    /// done, todo, or waiting.
    let state: String
    /// It can wait through the first week.
    let later: Bool
    let forYou: Bool

    enum CodingKeys: String, CodingKey { case id, title, why, state, later, forYou }

    init(from decoder: Decoder) throws {
        let c = try decoder.container(keyedBy: CodingKeys.self)
        id = try c.decode(String.self, forKey: .id)
        title = try c.decode(String.self, forKey: .title)
        why = try c.decodeIfPresent(String.self, forKey: .why) ?? ""
        state = try c.decodeIfPresent(String.self, forKey: .state) ?? "todo"
        later = try c.decodeIfPresent(Bool.self, forKey: .later) ?? false
        forYou = try c.decodeIfPresent(Bool.self, forKey: .forYou) ?? false
    }

    var isDone: Bool { state == "done" }
    /// It can wait and isn't done: not counted as left to do (the computer's `waits`).
    var waits: Bool { later && !isDone }
}

/// The checklist's words and counts, as the computer's Setup says them
/// (web/src/setup/Checklist.tsx's `progress`, setup.ts's title and count).
enum SetupChecklist {
    struct Progress: Equatable, Sendable {
        let done: Int
        let total: Int
        let wait: Int
        var left: Int { total - done }
        var allDone: Bool { left == 0 && wait == 0 }
    }

    static func progress(_ steps: [SetupStepInfo]) -> Progress {
        let counted = steps.filter { !$0.waits }
        return Progress(done: counted.filter(\.isDone).count, total: counted.count, wait: steps.count - counted.count)
    }

    static func title(_ steps: [SetupStepInfo]) -> String {
        progress(steps).allDone ? "Everything is set up" : "Finish setting up"
    }

    /// "9 of 13 done · 1 can wait"; nothing when all is done.
    static func count(_ steps: [SetupStepInfo]) -> String {
        let p = progress(steps)
        guard !p.allDone else { return "" }
        return "\(p.done) of \(p.total) done" + (p.wait > 0 ? " · \(p.wait) can wait" : "")
    }

    /// What the phone can do, in the computer's order.
    static func forYou(_ steps: [SetupStepInfo]) -> [SetupStepInfo] { steps.filter(\.forYou) }

    /// "Do the 2 I Can Do for You", "Do It for Me" for one; nil for none.
    static func buttonTitle(_ steps: [SetupStepInfo]) -> String? {
        switch forYou(steps).count {
        case 0: nil
        case 1: "Do It for Me"
        case let n: "Do the \(n) I Can Do for You"
        }
    }
}
