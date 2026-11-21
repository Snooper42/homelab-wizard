import Foundation

/// What Transactions is sorted by, as the computer's column headers
/// (Transactions.tsx's `TxSort`): a column, and whether up (oldest first,
/// A to Z, most out first). Kept on this iPhone or iPad, as the computer
/// keeps its own in each browser.
struct TransactionSort: Codable, Equatable, Sendable {
    enum Column: String, Codable, CaseIterable, Sendable {
        case date, payee, category, account, amount

        var title: String {
            switch self {
            case .date: "Date"
            case .payee: "Payee"
            case .category: "Category"
            case .account: "Account"
            case .amount: "Amount"
            }
        }

        /// Which way it sorts when first picked: a date newest first, words
        /// A to Z, amounts most out first (the computer's `columns`).
        var firstUp: Bool { self != .date }

        /// Each way in words, as the menu says it.
        func way(up: Bool) -> String {
            switch self {
            case .date: up ? "Oldest First" : "Newest First"
            case .amount: up ? "Most Out First" : "Most In First"
            case .payee, .category, .account: up ? "A to Z" : "Z to A"
            }
        }
    }

    var by: Column
    var up: Bool

    static let newestFirst = TransactionSort(by: .date, up: false)
    /// How many rows are drawn at first, and more each time Show More is
    /// tapped (the computer's `txPage`): a year of bank files is thousands.
    static let page = 200
    /// Where this device keeps it (the computer's own key).
    static let key = "homelab.finances.txSort"

    var isNewestFirst: Bool { self == .newestFirst }
    /// By date the list stays in months; by anything else it's one list.
    var byDay: Bool { by == .date }

    /// A column picked from the menu: its first way, or as it is when it's
    /// the column already sorted by.
    func picking(_ column: Column) -> TransactionSort {
        column == by ? self : TransactionSort(by: column, up: column.firstUp)
    }

    /// The heading over the list.
    var heading: String {
        switch (by, up) {
        case (.date, false): "Latest Transactions"
        case (.date, true): "Oldest First"
        default: "By \(by.title)"
        }
    }

    /// The order in the words under Show More: "most out first", "by payee, A to Z".
    var orderWords: String {
        switch by {
        case .date, .amount: by.way(up: up).lowercased()
        case .payee, .category, .account: "by \(by.title.lowercased()), \(by.way(up: up))"
        }
    }

    /// How many the next Show More adds.
    static func nextPage(drawn: Int, of total: Int) -> Int {
        max(0, min(page, total - drawn))
    }

    /// Under Show More: "200 of 450 shown, most out first".
    func moreWords(drawn: Int, of total: Int) -> String {
        "\(min(drawn, total).formatted()) of \(total.formatted()) shown, \(orderWords)"
    }

    /// The transactions (newest first, as the ledger's `newestFirst`) in
    /// this order. Among the same, newest first, as the computer's. `payee`
    /// is the row's title; `accountName` an account's name by id.
    func sorted(_ newestFirst: [FinanceTransaction],
                payee: (FinanceTransaction) -> String,
                accountName: (String) -> String) -> [FinanceTransaction] {
        switch by {
        case .date:
            return up ? Array(newestFirst.reversed()) : newestFirst
        case .amount:
            return Self.ordered(newestFirst, up: up, keys: newestFirst.map(\.amount)) { $0 < $1 }
        case .payee:
            return Self.ordered(newestFirst, up: up, keys: newestFirst.map(payee), by: Self.wordsBefore)
        case .category:
            return Self.ordered(newestFirst, up: up, keys: newestFirst.map(Self.category), by: Self.wordsBefore)
        case .account:
            let keys = newestFirst.map { t in
                guard let to = t.to, !to.isEmpty else { return accountName(t.account) }
                return "\(accountName(t.account)) → \(accountName(to))"
            }
            return Self.ordered(newestFirst, up: up, keys: keys, by: Self.wordsBefore)
        }
    }

    /// What a row's category column says (the computer's `catOf`): a split's
    /// parts together, else its category, a transfer, or no category.
    static func category(_ t: FinanceTransaction) -> String {
        if !t.splits.isEmpty { return t.splits.map(\.category).joined(separator: ", ") }
        if !t.category.isEmpty { return t.category }
        if let to = t.to, !to.isEmpty { return "Transfer" }
        return "No category"
    }

    /// The day under a row of one list: as Transactions says it, with the
    /// year when it isn't this year's (sorted by amount, two Rents a year
    /// apart would both read "Oct 1").
    static func dayWords(_ date: Date?, now: Date = Date(), calendar: Calendar = .current) -> String {
        guard let date else { return "" }
        if calendar.component(.year, from: date) == calendar.component(.year, from: now) {
            return TransactionsView.dayWords(date, now: now, calendar: calendar)
        }
        var style = Date.FormatStyle.dateTime.month(.abbreviated).day().year()
        style.calendar = calendar
        style.timeZone = calendar.timeZone
        return date.formatted(style)
    }

    // MARK: Kept on this device

    /// The sort this device keeps; newest first when none, or none can be read.
    static func kept(_ defaults: UserDefaults = .standard) -> TransactionSort {
        guard let data = defaults.data(forKey: key),
              let sort = try? JSONDecoder().decode(TransactionSort.self, from: data) else { return .newestFirst }
        return sort
    }

    func keep(_ defaults: UserDefaults = .standard) {
        guard let data = try? JSONEncoder().encode(self) else { return }
        defaults.set(data, forKey: Self.key)
    }

    // MARK: Ordering

    /// Words compared as the computer's `localeCompare` with base
    /// sensitivity: letter case and accents don't count.
    private static func wordsBefore(_ a: String, _ b: String) -> Bool {
        a.compare(b, options: [.caseInsensitive, .diacriticInsensitive, .numeric]) == .orderedAscending
    }

    /// `list` ordered by each one's key, up or down; the same keys keep
    /// `list`'s order. Keys are worked out once each, not on every compare.
    private static func ordered<Key>(_ list: [FinanceTransaction], up: Bool, keys: [Key],
                                     by before: (Key, Key) -> Bool) -> [FinanceTransaction] {
        let order = list.indices.sorted { i, j in
            let (a, b) = (keys[i], keys[j])
            if before(a, b) { return up }
            if before(b, a) { return !up }
            return i < j
        }
        return order.map { list[$0] }
    }
}
