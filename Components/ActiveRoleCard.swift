import SwiftUI

struct ActiveRoleCard: View {
    let roleName: String
    let description: String

    var body: some View {
        HStack(spacing: 16) {
            Image(systemName: "person.badge.shield.checkmark.fill")
                .font(.system(size: 32))
                .foregroundColor(Color.appPrimary)

            VStack(alignment: .leading, spacing: 4) {
                Text(roleName)
                    .font(.headline)
                    .foregroundColor(.primary)

                Text(description)
                    .font(.caption)
                    .foregroundColor(.secondary)
            }

            Spacer()
        }
        .padding()
        .background(Color.appPrimary.opacity(0.1))
        .cornerRadius(12)
    }
}
