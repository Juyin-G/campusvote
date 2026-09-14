import Foundation

enum ProjectRoute: Hashable {
    case list(fairId: String)
    case detail(fairId: String, projectId: String)

    // Sobrecarga para compatibilidad cuando solo se provee el projectId
    static func detail(projectId: String) -> ProjectRoute {
        .detail(fairId: "", projectId: projectId)
    }

    var fair: String {
        switch self {
        case .list(let fairId), .detail(let fairId, _):
            return fairId
        }
    }

    var fairId: String { fair }

    var projectId: String {
        switch self {
        case .list:
            return ""
        case .detail(_, let projectId):
            return projectId
        }
    }

    var project: String { projectId }
}

enum EvaluateRoute: Hashable {
    case form(fairId: String, projectId: String, projectName: String)

    static func form(projectId: String) -> EvaluateRoute {
        .form(fairId: "", projectId: projectId, projectName: "")
    }

    var fair: String {
        switch self {
        case .form(let fairId, _, _): return fairId
        }
    }

    var fairId: String { fair }

    var projectId: String {
        switch self {
        case .form(_, let projectId, _): return projectId
        }
    }

    var projectName: String {
        switch self {
        case .form(_, _, let projectName): return projectName
        }
    }
}

enum ProgressRoute: Hashable {
    case summary(fairId: String)

    var fair: String {
        switch self {
        case .summary(let fairId): return fairId
        }
    }

    var fairId: String { fair }
}
