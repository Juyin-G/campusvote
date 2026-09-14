import SwiftUI
import Foundation

extension Color {
    static let appPrimary = Color(hex: "#004D40")
    static let appSecondary = Color(hex: "#00695C")
    static let appTertiary = Color(hex: "#D4AF37")
    static let appNeutral = Color(hex: "#8E8E93")
    static let appPrimaryLight = Color(hex: "#004D40").opacity(0.12)
    static let appTertiaryLight = Color(hex: "#D4AF37").opacity(0.20)
}

extension Color {
    init(hex: String) {
        // Se corrigió a .alphanumerics
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let a, r, g, b: UInt64
        switch hex.count {
        case 3:
            (a, r, g, b) = (255, (int >> 8) * 17, (int >> 4 & 0xF) * 17, (int & 0xF) * 17)
        case 6:
            (a, r, g, b) = (255, int >> 16, int >> 8 & 0xFF, int & 0xFF)
        case 8:
            (a, r, g, b) = (int >> 24, int >> 16 & 0xFF, int >> 8 & 0xFF, int & 0xFF)
        default:
            (a, r, g, b) = (1, 1, 1, 1)
        }

        self.init(
            .sRGB,
            red: Double(r) / 255,
            green: Double(g) / 255,
            blue: Double(b) / 255,
            opacity: Double(a) / 255
        )
    }
}
