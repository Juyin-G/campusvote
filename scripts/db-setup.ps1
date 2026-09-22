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

    # 0b. Rol de la aplicación (app_user) - requerido por todos los GRANT TO app_user
    @{ Path = "database/sql/user/000_roles.sql"; Label = "User - Rol app_user" },

    # 2. Organizations - Base
    @{ Path = "database/sql/organizations/001_enums.sql"; Label = "Org - Enums" },
    @{ Path = "database/sql/organizations/002_organizations.sql"; Label = "Org - Tabla" },

    # 3. Users (Depende de organizations)
    @{ Path = "database/sql/user/001_enums.sql"; Label = "User - Enums" },
    @{ Path = "database/sql/user/002_users_table.sql"; Label = "User - Tabla" },
    @{ Path = "database/sql/user/003_users_indexes.sql"; Label = "User - Índices" },
    @{ Path = "database/sql/user/004_users_triggers.sql"; Label = "User - Triggers" },
    @{ Path = "database/sql/user/005_refresh_tokens.sql"; Label = "User - Refresh Tokens" },
    @{ Path = "database/sql/user/006_password_reset.sql"; Label = "User - Password Reset" },
    @{ Path = "database/sql/user/007_email_verification.sql"; Label = "User - Email Verification" },
    @{ Path = "database/sql/user/008_login_security.sql"; Label = "User - Login Security" },
    @{ Path = "database/sql/user/009_cleanup_tokens.sql"; Label = "User - Cleanup" },

    # 4. Organizations - Solicitudes y Aprobaciones (Depende de users)
    @{ Path = "database/sql/organizations/003_organization_requests.sql"; Label = "Org - Requests" },
    @{ Path = "database/sql/organizations/004_approval_functions.sql"; Label = "Org - Funciones" },

    # 4b. Organizations - Columnas extendidas (member_limit, category_catalog, admin constraint)
    @{ Path = "database/sql/organizations/005_organization_member_limit.sql"; Label = "Org - Member Limit" },
    @{ Path = "database/sql/organizations/005_category_catalog.sql"; Label = "Org - Category Catalog" },
    @{ Path = "database/sql/organizations/006_admin_requires_organization.sql"; Label = "Org - Admin Constraint" },
    @{ Path = "database/sql/organizations/007_admin_invite.sql"; Label = "Org - Admin Invite" },

    # 4c. Deferred admin activation (usa las columnas anteriores)
    @{ Path = "database/sql/organizations/008_deferred_admin_activation.sql"; Label = "Org - Deferred Activation" },

    # 5. Academic
    @{ Path = "database/sql/academic/001_faculties.sql"; Label = "Academic - Faculties" },
    @{ Path = "database/sql/academic/002_programs.sql"; Label = "Academic - Programs" },
    @{ Path = "database/sql/academic/003_academic_periods.sql"; Label = "Academic - Periods" },
    @{ Path = "database/sql/academic/004_voter_registries.sql"; Label = "Academic - Voter Registry" },
    @{ Path = "database/sql/academic/005_voter_validation.sql"; Label = "Academic - Validation" },
    @{ Path = "database/sql/academic/006_views.sql"; Label = "Academic - Views" },
    @{ Path = "database/sql/academic/007_functions.sql"; Label = "Academic - Functions" },
    @{ Path = "database/sql/academic/008_sis_sync.sql"; Label = "Academic - SIS Sync" },

    # 6. Audit (FASE 13: dominio ELECTIONS eliminado)
    @{ Path = "database/sql/audit/001_enums.sql"; Label = "Audit - Enums" },
    @{ Path = "database/sql/audit/002_audit_logs.sql"; Label = "Audit - Logs" },
    @{ Path = "database/sql/audit/003_audit_protection.sql"; Label = "Audit - Protection" },
    @{ Path = "database/sql/audit/006_audit_permissions.sql"; Label = "Audit - Permissions" },
    @{ Path = "database/sql/audit/007_actions_peru.sql"; Label = "Audit - Fair Actions" },

    # 7. Notificaciones e i18n (dependen de users/organizations)
    @{ Path = "database/sql/notifications/001_notifications.sql"; Label = "Notifications" },
    @{ Path = "database/sql/notifications/002_channels.sql"; Label = "Notifications - Channels" },
    @{ Path = "database/sql/i18n/001_locales_and_translations.sql"; Label = "i18n" },

    # 8. Ferias y proyectos académicos
    @{ Path = "database/sql/projects/001_projects.sql"; Label = "Projects" },
    @{ Path = "database/sql/fairs/001_fairs.sql"; Label = "Fairs" },
    @{ Path = "database/sql/projects/002_projects_fair.sql"; Label = "Projects-Fair" },
    @{ Path = "database/sql/fairs/002_jury_assignments.sql"; Label = "Fairs - Jury Assignments" },
    @{ Path = "database/sql/fairs/003_fair_rubrics.sql"; Label = "Fairs - Rubrics" },
    @{ Path = "database/sql/fairs/004_fair_evaluations.sql"; Label = "Fairs - Evaluations" },
    @{ Path = "database/sql/fairs/005_fair_result_publications.sql"; Label = "Fairs - Result Publications" },
    @{ Path = "database/sql/fairs/006_fair_site.sql"; Label = "Fairs - Site" },
    @{ Path = "database/sql/fairs/007_fair_categories.sql"; Label = "Fairs - Categories" },
    @{ Path = "database/sql/fairs/008_fair_stands.sql"; Label = "Fairs - Stands" },
    @{ Path = "database/sql/projects/003_projects_category_stand.sql"; Label = "Projects - Category/Stand" },
    @{ Path = "database/sql/fairs/009_fair_jury_declarations.sql"; Label = "Fairs - Jury Declarations" },
    @{ Path = "database/sql/fairs/010_jury_assignment_integrity.sql"; Label = "Fairs - Jury Integrity" },
    @{ Path = "database/sql/fairs/011_certificates.sql"; Label = "Fairs - Certificates" },
    @{ Path = "database/sql/fairs/012a_fair_rubric_to_checklist.sql"; Label = "Fairs - Checklist" },
    @{ Path = "database/sql/fairs/012b_fair_anonymous_voting.sql"; Label = "Fairs - Anonymous Voting" },
    @{ Path = "database/sql/fairs/013_fair_engagement.sql"; Label = "Fairs - Engagement" },
    @{ Path = "database/sql/fairs/014_fair_status_transition.sql"; Label = "Fairs - Status Transition" },
    @{ Path = "database/sql/fairs/015_fair_project_fk_repair.sql"; Label = "Fairs - FK Repair" },

    # 9. Claves foraneas que cruzan modulos (deben ir al final,
    #     cuando todas las tablas ya existen)
    @{ Path = "database/sql/999_foreign_keys.sql"; Label = "Foreign Keys" }
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