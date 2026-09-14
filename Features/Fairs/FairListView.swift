import SwiftUI

struct FairListView: View {
    @Environment(FairsStore.self) private var fairsStore

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    
                    // Sede y Estado
                    HStack {
                        Image(systemName: "location.fill")
                            .foregroundColor(.secondary)
                        Text("Tecsup · Trujillo")
                            .font(.subheadline)
                            .foregroundColor(.secondary)
                        Spacer()
                        
                        HStack(spacing: 4) {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 8, height: 8)
                            Text("En vivo")
                                .font(.caption).bold()
                                .foregroundColor(.green)
                        }
                        .padding(.horizontal, 10)
                        .padding(.vertical, 4)
                        .background(Color.green.opacity(0.15))
                        .clipShape(Capsule())
                    }

                    // Rol Activo Card
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 12) {
                            Image(systemName: "checkmark.shield.fill")
                                .font(.title)
                                .foregroundColor(.teal)
                            
                            VStack(alignment: .leading) {
                                Text("Rol activo: Jurado Calificador")
                                    .font(.headline)
                                Text("Mesa 04 · Pabellón C - Laboratorio 3")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }
                        }
                        
                        Divider()
                        
                        HStack(spacing: 8) {
                            Image(systemName: "icloud.and.arrow.down")
                                .foregroundColor(.secondary)
                            Text("Tus calificaciones se sincronizan automáticamente al tener conexión.")
                                .font(.caption)
                                .foregroundColor(.secondary)
                        }
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(16)

                    // Sección: EN CURSO
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Text("EN CURSO")
                                .font(.caption).bold()
                                .foregroundColor(.secondary)
                            Spacer()
                            Text("\(fairsStore.activeFairs.count) activa")
                                .font(.caption)
                                .foregroundColor(.teal)
                        }

                        if fairsStore.isLoading {
                            ProgressView("Cargando ferias...")
                                .frame(maxWidth: .infinity, alignment: .center)
                                .padding()
                        } else if fairsStore.activeFairs.isEmpty {
                            Text("No tienes ferias activas asignadas.")
                                .font(.subheadline)
                                .foregroundColor(.secondary)
                                .padding()
                        } else {
                            ForEach(fairsStore.activeFairs) { assignment in
                                FairItemRow(fair: assignment.fair)
                            }
                        }
                    }

                    // Sección: CERRADAS
                    if !fairsStore.closedFairs.isEmpty {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Text("CERRADAS")
                                    .font(.caption).bold()
                                    .foregroundColor(.secondary)
                                Spacer()
                                Text("Histórico")
                                    .font(.caption)
                                    .foregroundColor(.secondary)
                            }

                            ForEach(fairsStore.closedFairs) { assignment in
                                FairItemRow(fair: assignment.fair)
                            }
                        }
                    }

                    // Banner Banner Guía
                    HStack {
                        Image(systemName: "questionmark.circle")
                            .font(.title2)
                            .foregroundColor(.teal)
                        Text("¿Tienes dudas sobre los criterios de rúbrica?")
                            .font(.caption)
                            .foregroundColor(.primary)
                        Spacer()
                        Button("Ver Guía") {}
                            .font(.caption).bold()
                            .padding(.horizontal, 12)
                            .padding(.vertical, 6)
                            .background(Color(.systemBackground))
                            .cornerRadius(8)
                    }
                    .padding()
                    .background(Color(.secondarySystemBackground))
                    .cornerRadius(12)
                }
                .padding()
            }
            .navigationTitle("Ferias")
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Image(systemName: "person.circle")
                        .font(.title2)
                }
            }
            .task {
                await fairsStore.fetchMyAssignments()
            }
        }
    }
}

struct FairItemRow: View {
    let fair: Fair

    var body: some View {
        HStack(spacing: 12) {
            Image(systemName: fair.status.uppercased() == "CLOSED" ? "flask.fill" : "app.badge.fill")
                .font(.title2)
                .foregroundColor(.teal)
                .frame(width: 44, height: 44)
                .background(Color.teal.opacity(0.1))
                .cornerRadius(10)

            VStack(alignment: .leading, spacing: 4) {
                Text(fair.name)
                    .font(.headline)
                    .lineLimit(1)
                
                Text(fair.description ?? "Sin descripción")
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(1)
            }

            Spacer()

            Text(fair.status.uppercased() == "OPEN" ? "Abierta" : (fair.status.uppercased() == "CLOSED" ? "Cerrada" : "Programada"))
                .font(.caption).bold()
                .padding(.horizontal, 8)
                .padding(.vertical, 4)
                .background(fair.status.uppercased() == "OPEN" ? Color.green.opacity(0.15) : Color.gray.opacity(0.15))
                .foregroundColor(fair.status.uppercased() == "OPEN" ? .green : .gray)
                .cornerRadius(8)

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.05), radius: 4, x: 0, y: 2)
    }
}
