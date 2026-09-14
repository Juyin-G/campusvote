import SwiftUI

enum FairCardStatus {
    case open
    case scheduled
    case closed
}

struct FairRowCard: View {
    let title: String
    let subtitle: String
    let status: FairCardStatus
    let iconName: String
    let progress: Double?

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: iconName)
                .font(.title2)
                .foregroundColor(Color.appPrimary)
                .frame(width: 42, height: 42)
                .background(Color.appPrimaryLight)
                .cornerRadius(10)

            VStack(alignment: .leading, spacing: 4) {
                Text(title)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(subtitle)
                    .font(.subheadline)
                    .foregroundColor(.secondary)

                if let progress {
                    ProgressView(value: progress)
                        .tint(Color.appPrimary)
                }
            }

            Spacer()

            statusBadge
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .cornerRadius(14)
    }

    // Se cambió de 'View' a 'some View' para solucionar el error de compilación
    @ViewBuilder
    private var statusBadge: some View {
        switch status {
        case .open:
            Text("En Vivo")
                .font(.caption2).bold()
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.green.opacity(0.15))
                .foregroundColor(.green)
                .cornerRadius(6)
        case .scheduled:
            Text("Programada")
                .font(.caption2).bold()
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.orange.opacity(0.15))
                .foregroundColor(.orange)
                .cornerRadius(6)
        case .closed:
            Text("Cerrada")
                .font(.caption2).bold()
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(Color.gray.opacity(0.15))
                .foregroundColor(.gray)
                .cornerRadius(6)
        }
    }
}
