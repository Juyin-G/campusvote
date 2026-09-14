import Foundation

/// Evaluación de un proyecto hecha por este jurado.
struct Evaluation: Decodable, Hashable, Identifiable {
    let id: String
    let projectId: String
    /// Suma de las notas de todos los criterios.
    let totalScore: Double
    let comment: String?
    let project: ProjectSummary?
    let details: [EvaluationDetail]
}

struct ProjectSummary: Decodable, Hashable {
    let id: String
    let name: String
}

struct EvaluationDetail: Decodable, Hashable {
    let criterionId: String
    let criterionName: String?
    let score: Double
}

/// Cuerpo de POST /fairs/:id/evaluations. Las claves van en snake_case.
struct EvaluationInput: Encodable, Hashable {
    let projectId: String
    /// Una nota por CADA criterio de la rúbrica, dentro de su rango.
    let scores: [ScoreInput]
    let comment: String?

    enum CodingKeys: String, CodingKey {
        case projectId = "project_id"
        case scores
        case comment
    }
}

struct ScoreInput: Encodable, Hashable {
    let criterionId: String
    let score: Double

    enum CodingKeys: String, CodingKey {
        case criterionId = "criterion_id"
        case score
    }
}

/// Avance del jurado en la feria (GET /fairs/my-progress/:fairId).
/// No se llama Progress porque ese nombre ya existe en Foundation.
struct JuryProgress: Decodable {
    let totalProjects: Int
    let evaluatedProjects: Int
    let remaining: Int
    let progressPercentage: Double
    let declaration: Declaration?
    let evaluations: [Evaluation]
}
