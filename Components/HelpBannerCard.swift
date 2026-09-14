import SwiftUI

struct HelpBannerCard: View {
    var onGuideTap: (() -> Void)? = nil

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: "questionmark.circle")
                .font(.title2)
                .foregroundColor(Color.appPrimary)
            
            Text("¿Tienes dudas sobre los criterios de rúbrica?")
                .font(.subheadline)
                .foregroundColor(.primary)
            
            Spacer()
            
            Button(action: {
                onGuideTap?()
            }) {
                Text("Ver Guía")
                    .font(.caption)
                    .bold()
                    .padding(.horizontal, 12)
                    .padding(.vertical, 8)
                    .background(Color.appTertiary)
                    .foregroundColor(.black)
                    .cornerRadius(8)
            }
        }
        .padding()
        .background(Color.appNeutral.opacity(0.1))
        .cornerRadius(14)
    }
}

#Preview {
    HelpBannerCard()
        .padding()
}
