import SwiftUI

/// Mensaje de error del backend, tal como llega (ya viene en español).
struct ErrorBanner: View {
    let message: String

    var body: some View {
        Label(message, systemImage: "exclamationmark.triangle.fill")
            .font(.subheadline)
            .foregroundStyle(.red)
    }
}
