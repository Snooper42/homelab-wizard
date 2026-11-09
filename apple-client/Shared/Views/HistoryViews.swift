import SwiftUI

/// Recently done, on an app's page: the newest few things done to it, from
/// the computer's record of what was done, and the way to everything.
struct RecentlyDoneSection: View {
    let app: AppStatus
    @Environment(DashboardViewModel.self) private var dashboard
    @State private var entries: [HistoryEntry]?
    @State private var problem: String?

    var body: some View {
        Section {
            if let problem {
                Text(verbatim: problem).foregroundStyle(.secondary)
            } else if let entries {
                if entries.isEmpty {
                    Text("Nothing done to it yet that's kept here. Its starts, stops, restarts and updates, and the watchdog's, are kept for 90 days.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(entries.prefix(6)) { entry in
                        HistoryRow(entry: entry)
                    }
                }
            } else {
                ProgressView()
            }
            NavigationLink {
                HistoryListView()
            } label: {
                Text("Everything That Was Done")
            }
        } header: {
            Text("Recently Done")
        }
        .task {
            do {
                entries = try await dashboard.history(appID: app.id)
            } catch {
                problem = APIError.from(error).errorDescription
            }
        }
    }
}

/// One line of what was done: the line, then when and who did it.
struct HistoryRow: View {
    let entry: HistoryEntry

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(verbatim: entry.text)
            HStack(spacing: 4) {
                if let at = entry.at {
                    Text(at, format: .relative(presentation: .named))
                }
                if !entry.byWho.isEmpty {
                    Text(verbatim: entry.byWho)
                }
            }
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
        .accessibilityElement(children: .combine)
    }
}

/// Everything that was done in the last 90 days, searchable by app, phone or word.
struct HistoryListView: View {
    @Environment(DashboardViewModel.self) private var dashboard
    @State private var search = ""
    @State private var entries: [HistoryEntry]?
    @State private var problem: String?

    var body: some View {
        List {
            if let problem {
                Text(verbatim: problem).foregroundStyle(.secondary)
            } else if let entries {
                if entries.isEmpty {
                    let typed = search.trimmingCharacters(in: .whitespacesAndNewlines)
                    Text(typed.isEmpty ? "Nothing done yet that's kept here." : "Nothing done matches “\(typed)”.")
                        .foregroundStyle(.secondary)
                } else {
                    ForEach(entries) { entry in
                        HistoryRow(entry: entry)
                    }
                }
            } else {
                ProgressView()
            }
        }
        .searchable(text: $search, prompt: "An app, a phone, restarted…")
        .navigationTitle("Everything That Was Done")
        // Again as the search changes, a moment after the last letter.
        .task(id: search) {
            if !search.isEmpty { try? await Task.sleep(for: .milliseconds(250)) }
            if Task.isCancelled { return }
            do {
                entries = try await dashboard.history(search: search)
                problem = nil
            } catch {
                if !Task.isCancelled { problem = APIError.from(error).errorDescription }
            }
        }
    }
}
