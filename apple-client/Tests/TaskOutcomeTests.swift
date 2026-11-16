import Testing
@testable import HomelabClient

/// A job that didn't finish says why first (the owner's Back Up Now, Nov 16:
/// titled "exit status 1", "It didn't work", and the one stopped app at the
/// bottom of the whole log). The computer's own warning (!) and failure (✗)
/// lines lead, in its words, under a title that says which job.
@Suite("A job's outcome")
struct TaskOutcomeTests {
    static let backup = [
        "$ homelab backup --apply", "", "Backup",
        "  • dump nginx-proxy-manager → recovery-staging/databases/nginx-proxy-manager",
        "  • homarr (not installed, skipped)",
        "  • dump navidrome → recovery-staging/databases/navidrome",
        "  ! mealie is not running: not backed up",
        "  • copy .env → recovery-staging/secrets/homelab.env",
        "[3/9] Copying Navidrome's database",
    ]

    @Test func aStoppedAppLeadsAndTheRestWasBackedUp() {
        let o = TaskOutcome(task: .backup, message: "exit status 1", lines: Self.backup)
        #expect(o.title == "Backup Didn't Finish")
        #expect(o.problems == ["mealie is not running: not backed up"])
        #expect(o.lead == "Everything else was backed up. This wasn't:")
    }

    @Test func aStepThatFailedIsSaidSo() {
        let lines = Self.backup + ["  ✗ dump navidrome: no space left on device"]
        let o = TaskOutcome(task: .backup, message: "exit status 1", lines: lines)
        #expect(o.problems == ["mealie is not running: not backed up", "dump navidrome: no space left on device"])
        #expect(o.lead == "These went wrong:")
    }

    @Test func theComputersOwnWordsAreKeptAsTheTitle() {
        let o = TaskOutcome(task: .restoreTest, message: "The newest backup is older than a day", lines: [])
        #expect(o.title == "The newest backup is older than a day")
        #expect(o.problems.isEmpty && o.lead == nil)
        #expect(TaskOutcome(task: .fix, message: "", lines: []).title == "Look for Problems Didn't Finish")
        #expect(TaskOutcome(task: .restoreTest, message: "exit status 2", lines: []).title == "The Restore Test Didn't Finish")
    }
}
