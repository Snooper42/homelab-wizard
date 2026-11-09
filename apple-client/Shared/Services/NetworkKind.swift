import Network

/// The kind of network the phone is on, as far as finding the computer
/// goes: whether anything answers, and through what. A change of it (Wi-Fi
/// to cellular, home again, a VPN such as Proton VPN coming on or off)
/// means home may answer again, or no longer, so `APIClient` tries home
/// first again. Never the Wi-Fi's name, which the app doesn't read.
struct NetworkKind: Equatable, Sendable {
    let reachable: Bool
    let wifi: Bool
    let cellular: Bool
    let wired: Bool
    /// A VPN's tunnel, among others.
    let other: Bool

    /// Whether going from `old` to `new` is a change of network. The first
    /// reading isn't: there was nothing to change from.
    static func isChange(from old: NetworkKind?, to new: NetworkKind) -> Bool {
        guard let old else { return false }
        return old != new
    }
}

extension NetworkKind {
    init(_ path: NWPath) {
        self.init(
            reachable: path.status == .satisfied,
            wifi: path.usesInterfaceType(.wifi),
            cellular: path.usesInterfaceType(.cellular),
            wired: path.usesInterfaceType(.wiredEthernet),
            other: path.usesInterfaceType(.other)
        )
    }
}
