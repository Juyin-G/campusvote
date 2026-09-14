import Foundation

struct APIResponse<T: Decodable>: Decodable {
    let success: Bool
    let message: String?
    let data: T
}

struct FairAssignment: Codable, Identifiable, Hashable {
    var id: String { fair.id }
    let assignedAt: String?
    let fair: Fair

    enum CodingKeys: String, CodingKey {
        case fair
        case assignedAt = "assigned_at"
    }

    static func == (lhs: FairAssignment, rhs: FairAssignment) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}

struct Fair: Codable, Identifiable, Hashable {
    let id: String
    let name: String
    let description: String?
    let status: String
    let startsAt: String?
    let endsAt: String?

    enum CodingKeys: String, CodingKey {
        case id, name, description, status
        case startsAt = "starts_at"
        case endsAt = "ends_at"
    }

    static func == (lhs: Fair, rhs: Fair) -> Bool {
        lhs.id == rhs.id
    }

    func hash(into hasher: inout Hasher) {
        hasher.combine(id)
    }
}
