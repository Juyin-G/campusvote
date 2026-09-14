import Foundation

/// Rúbrica de la feria (GET /fairs/:id/rubric).
struct Rubric: Decodable, Hashable {
    let id: String
    let name: String
    let criteria: [Criterion]

    /// Criterios en el orden que definió el admin.
    var orderedCriteria: [Criterion] {
        criteria.sorted { $0.position < $1.position }
    }
}

/// Un criterio con su rango de notas. El rango lo define el admin de la feria.
struct Criterion: Decodable, Hashable, Identifiable {
    let id: String
    let name: String
    let description: String?
    let minScore: Double
    let maxScore: Double
    let position: Int
}
