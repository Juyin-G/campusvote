Write-Host "Ejecutando migraciones SQL..." -ForegroundColor Cyan

# Get database credentials from environment variables
$dbUser = if ($env:POSTGRES_SUPERUSER) { $env:POSTGRES_SUPERUSER } else { "postgres" }
$dbName = if ($env:POSTGRES_DB) { $env:POSTGRES_DB } else { "campusvote_db" }

Write-Host "Usando usuario de base de datos: $dbUser" -ForegroundColor Gray
Write-Host "Base de datos: $dbName" -ForegroundColor Gray
Write-Host ""

$migrationOrder = @(
    # 1. Extensiones y funciones base
    @{ Path = "database/sql/000_extensions.sql"; Label = "Extensiones" },
    @{ Path = "database/sql/005_base_functions.sql"; Label = "Funciones base" },

    # 2. Organizations - Base
    @{ Path = "database/sql/organizations/001_enums.sql"; Label = "Org - Enums" },
    @{ Path = "database/sql/organizations/002_organizations.sql"; Label = "Org - Tabla" },

    # 3. Users (Depende de organizations)
    @{ Path = "database/sql/user/001_enums.sql"; Label = "User - Enums" },
    @{ Path = "database/sql/user/002_users_table.sql"; Label = "User - Tabla" },
    @{ Path = "database/sql/user/003_users_indexes.sql"; Label = "User - Índices" },
    @{ Path = "database/sql/user/004_users_triggers.sql"; Label = "User - Triggers" },
    @{ Path = "database/sql/user/005_password_reset.sql"; Label = "User - Password Reset" },
    @{ Path = "database/sql/user/006_email_verification.sql"; Label = "User - Email Verification" },
    @{ Path = "database/sql/user/007_login_security.sql"; Label = "User - Login Security" },
    @{ Path = "database/sql/user/008_cleanup_tokens.sql"; Label = "User - Cleanup" },

    # 4. Organizations - Solicitudes y Aprobaciones (Depende de users)
    @{ Path = "database/sql/organizations/003_organization_requests.sql"; Label = "Org - Requests" },
    @{ Path = "database/sql/organizations/004_approval_functions.sql"; Label = "Org - Funciones" },

    # 5. Academic
    @{ Path = "database/sql/academic/001_faculties.sql"; Label = "Academic - Faculties" },
    @{ Path = "database/sql/academic/002_programs.sql"; Label = "Academic - Programs" },
    @{ Path = "database/sql/academic/003_academic_periods.sql"; Label = "Academic - Periods" },
    @{ Path = "database/sql/academic/004_voter_registries.sql"; Label = "Academic - Voter Registry" },
    @{ Path = "database/sql/academic/005_voter_validation.sql"; Label = "Academic - Validation" },
    @{ Path = "database/sql/academic/006_views.sql"; Label = "Academic - Views" },
    @{ Path = "database/sql/academic/007_functions.sql"; Label = "Academic - Functions" },

    # 6. Elections
    @{ Path = "database/sql/elections/001_enums.sql"; Label = "Elections - Enums" },
    @{ Path = "database/sql/elections/002_elections.sql"; Label = "Elections - Tabla" },
    @{ Path = "database/sql/elections/003_positions.sql"; Label = "Elections - Positions" },
    @{ Path = "database/sql/elections/004_candidate_lists.sql"; Label = "Elections - Lists" },
    @{ Path = "database/sql/elections/005_candidacies.sql"; Label = "Elections - Candidacies" },
    @{ Path = "database/sql/elections/006_election_rules.sql"; Label = "Elections - Rules" },
    @{ Path = "database/sql/elections/008_vote_validation.sql"; Label = "Elections - Validation" },

    # 7. Ballots
    @{ Path = "database/sql/ballots/001_enums.sql"; Label = "Ballots - Enums" },
    @{ Path = "database/sql/ballots/002_ballots.sql"; Label = "Ballots - Tabla" },
    @{ Path = "database/sql/ballots/003_ballot_positions.sql"; Label = "Ballots - Positions" },
    @{ Path = "database/sql/ballots/004_ballot_options.sql"; Label = "Ballots - Options" },
    @{ Path = "database/sql/ballots/005_views.sql"; Label = "Ballots - Views" },
    @{ Path = "database/sql/ballots/006_functions.sql"; Label = "Ballots - Functions" },

    # 8. Audit
    @{ Path = "database/sql/audit/001_enums.sql"; Label = "Audit - Enums" },
    @{ Path = "database/sql/audit/002_audit_logs.sql"; Label = "Audit - Logs" },
    @{ Path = "database/sql/audit/003_audit_protection.sql"; Label = "Audit - Protection" },
    @{ Path = "database/sql/audit/004_one_time_tokens.sql"; Label = "Audit - Tokens" },
    @{ Path = "database/sql/audit/005_token_consumption.sql"; Label = "Audit - Consumption" },

    # 9. Results
    @{ Path = "database/sql/results/001_tallies.sql"; Label = "Results - Tallies" },
    @{ Path = "database/sql/results/002_election_results.sql"; Label = "Results - Results" },
    @{ Path = "database/sql/results/003_turnout_trigger.sql"; Label = "Results - Turnout" },
    @{ Path = "database/sql/results/004_certify_election.sql"; Label = "Results - Certify" },

    # 10. Voting
    @{ Path = "database/sql/voting/001_voting_sessions.sql"; Label = "Voting - Sessions" },
    @{ Path = "database/sql/voting/002_votes.sql"; Label = "Voting - Votes" },
    @{ Path = "database/sql/voting/003_vote_selections.sql"; Label = "Voting - Selections" },
    @{ Path = "database/sql/voting/004_start_session.sql"; Label = "Voting - Start Session" },
    @{ Path = "database/sql/voting/005_cast_vote.sql"; Label = "Voting - Cast Vote" }
)

$errors = 0

foreach ($migration in $migrationOrder) {
    $file = $migration.Path
    $label = $migration.Label

    if (-not (Test-Path $file)) {
        Write-Host "  No encontrado: $file" -ForegroundColor Yellow
        continue
    }

    Write-Host "  Ejecutando: $label" -ForegroundColor White -NoNewline
    Write-Host " ($file)" -ForegroundColor DarkGray

    docker cp $file campusvote_db:/tmp/migration.sql
    $result = docker exec -i campusvote_db psql -U $dbUser -d $dbName -f /tmp/migration.sql 2>&1

    if ($LASTEXITCODE -ne 0 -or $result -match "ERROR") {
        Write-Host "    [ERROR] $label" -ForegroundColor Red
        Write-Host $result -ForegroundColor Red
        $errors++
        break
    } else {
        Write-Host "    [OK]" -ForegroundColor Green
    }
}

if ($errors -eq 0) {
    Write-Host "`nTodas las migraciones ejecutadas correctamente" -ForegroundColor Green
} else {
    Write-Host "`nSe encontraron $errors errores" -ForegroundColor Red
    exit 1
}