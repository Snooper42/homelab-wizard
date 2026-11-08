import SwiftUI
#if canImport(UIKit)
import UIKit
#elseif canImport(AppKit)
import AppKit
#endif

/// The app's look: a plain iPhone app, with a violet accent, a warm grey
/// canvas behind white cards (a deep blue-black behind dark ones), calm
/// status colours, and pills for states. Every colour has a light and a
/// dark value. As text, each keeps at least 4.5:1 contrast on the card and
/// on the canvas, light and dark. The shared pieces built on these are in
/// Design.swift.
///
/// The app's own look: no other product's name, logo or artwork.
enum Theme {
    /// The accent: buttons, links, the selection, the "changed" dot.
    static let accent = Color(light: 0x6A4FF0, dark: 0x8C7BFF)
    /// The accent's deeper end, for the app mark's gradient.
    static let accentDeep = Color(light: 0x4B32C3, dark: 0x5B45D6)

    /// Behind grouped lists and forms: warm grey by day, blue-black by night.
    static let canvas = Color(light: 0xF5F4F2, dark: 0x121019)
    /// A card on the canvas.
    static let surface = Color(light: 0xFFFFFF, dark: 0x1E1B27)
    /// Text on a card: near-black by day, near-white by night.
    static let ink = Color(light: 0x1C1C1E, dark: 0xF2F2F7)
    /// Quieter text on a card or the canvas: a caption, a date.
    static let secondaryInk = Color(light: 0x5E5E66, dark: 0x98989F)
    /// A hairline between rows inside a card.
    static let separator = Color(light: 0xECEAE5, dark: 0x2E2A3D)

    static let success = Color(light: 0x137A60, dark: 0x3CC79F)
    static let warning = Color(light: 0xA35700, dark: 0xFFA733)
    static let caution = Color(light: 0x846700, dark: 0xF2C94C)
    static let danger = Color(light: 0xD02B4B, dark: 0xFF6B85)
    static let info = Color(light: 0x176FA3, dark: 0x5CC0EE)

    /// The corner radius of bordered buttons and small boxes.
    static let radius: CGFloat = 10
    /// The corner radius of a card.
    static let cardRadius: CGFloat = 20
}

extension Color {
    /// A colour with its own value in light and dark appearance, as 0xRRGGBB.
    init(light: UInt32, dark: UInt32) {
        #if canImport(UIKit)
        self.init(uiColor: UIColor { traits in
            UIColor(rgb: traits.userInterfaceStyle == .dark ? dark : light)
        })
        #elseif canImport(AppKit)
        self.init(nsColor: NSColor(name: nil) { appearance in
            let isDark = appearance.bestMatch(from: [.aqua, .darkAqua]) == .darkAqua
            return NSColor(rgb: isDark ? dark : light)
        })
        #endif
    }
}

#if canImport(UIKit)
private extension UIColor {
    convenience init(rgb: UInt32) {
        self.init(red: CGFloat((rgb >> 16) & 0xFF) / 255, green: CGFloat((rgb >> 8) & 0xFF) / 255,
                  blue: CGFloat(rgb & 0xFF) / 255, alpha: 1)
    }
}
#elseif canImport(AppKit)
private extension NSColor {
    convenience init(rgb: UInt32) {
        self.init(srgbRed: CGFloat((rgb >> 16) & 0xFF) / 255, green: CGFloat((rgb >> 8) & 0xFF) / 255,
                  blue: CGFloat(rgb & 0xFF) / 255, alpha: 1)
    }
}
#endif

// MARK: - Pieces

/// A short state or count in a tinted capsule: "96% up", "3 restarts".
struct Pill: ViewModifier {
    let tint: Color

    func body(content: Content) -> some View {
        content
            .font(.caption2.weight(.semibold).monospacedDigit())
            .lineLimit(1)
            .padding(.horizontal, 7)
            .padding(.vertical, 3)
            .foregroundStyle(tint)
            .background(tint.opacity(0.14), in: Capsule())
    }
}

extension View {
    func pill(_ tint: Color) -> some View { modifier(Pill(tint: tint)) }

    /// Lists and forms on the warm canvas, their rows as white cards. On the
    /// Mac the system's own window background stays, so the window still
    /// matches the sidebar's vibrancy.
    func themedCanvas() -> some View {
        #if os(iOS)
        self
            .scrollContentBackground(.hidden)
            .background(Theme.canvas.ignoresSafeArea())
        #else
        self
        #endif
    }
}

/// The app's mark: a server rack on a violet tile, as the app's icon is. Used where the app
/// introduces itself (pairing, the lock screen, the privacy cover).
struct AppMark: View {
    var size: CGFloat = 72
    /// A small symbol in the corner, such as a lock.
    var badge: String?

    var body: some View {
        RoundedRectangle(cornerRadius: size * 0.27, style: .continuous)
            .fill(LinearGradient(colors: [Theme.accent, Theme.accentDeep],
                                 startPoint: .topLeading, endPoint: .bottomTrailing))
            .frame(width: size, height: size)
            .overlay {
                Image(systemName: "server.rack")
                    .font(.system(size: size * 0.44, weight: .semibold))
                    .foregroundStyle(.white)
            }
            .overlay(alignment: .bottomTrailing) {
                if let badge {
                    Image(systemName: badge)
                        .font(.system(size: size * 0.2, weight: .bold))
                        .foregroundStyle(Theme.accentDeep)
                        .frame(width: size * 0.38, height: size * 0.38)
                        .background(Circle().fill(.white))
                        .overlay(Circle().strokeBorder(Theme.accentDeep.opacity(0.15)))
                        .offset(x: size * 0.1, y: size * 0.1)
                }
            }
            .shadow(color: Theme.accentDeep.opacity(0.28), radius: size * 0.16, y: size * 0.08)
            .accessibilityHidden(true)
    }
}

/// The calm backdrop of the screens that stand alone (locked, the privacy
/// cover): the canvas with a soft violet glow from the top.
struct HeroBackground: View {
    var body: some View {
        ZStack {
            Theme.canvas
            RadialGradient(colors: [Theme.accent.opacity(0.16), .clear],
                           center: .top, startRadius: 0, endRadius: 520)
        }
        .ignoresSafeArea()
        .accessibilityHidden(true)
    }
}
