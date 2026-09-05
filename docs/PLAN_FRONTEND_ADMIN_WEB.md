# Plan del frontend web administrativo

## Objetivo

Crear un panel web para administrar CampusVote sin mover reglas de negocio al navegador. El backend sigue siendo la autoridad de permisos, estados, quorums, elegibilidad y certificacion.

## Estructura recomendada

```text
src/
  app/
    router/
    providers/
  auth/
    login/
    mfa/
    session/
  layout/
    AdminShell/
    Navigation/
  modules/
    organizations/
    academic/
    elections/
    candidacies/
    challenges/
    ballots/
    jury/
    project-review/
    voting/
    results/
    audit/
  shared/
    api/
    permissions/
    tables/
    forms/
    notifications/
    errors/
```

## Rutas iniciales

- `/login`
- `/mfa`
- `/admin`
- `/admin/organizations`
- `/admin/academic/periods`
- `/admin/academic/faculties`
- `/admin/academic/programs`
- `/admin/elections`
- `/admin/elections/:id/candidacies`
- `/admin/elections/:id/challenges`
- `/admin/elections/:id/jurors`
- `/admin/elections/:id/project-review`
- `/admin/elections/:id/ballot`
- `/admin/elections/:id/results`
- `/admin/elections/:id/audit`

## Regla del switch

El switch del frontend se llama **Revision de proyectos**. Abre la cola de proyectos asignados al jurado; no cambia el rol, no cambia el usuario y no permite calificar fuera de la asignacion.

Cada tarjeta debe mostrar:

- proyecto y expositor;
- estado de documentos;
- conflicto de interes;
- criterios y ponderaciones;
- rating enviado o pendiente;
- bloqueo y motivo;
- fecha y request id cuando ocurre un error.

## Criterios de aceptacion

- Ninguna pantalla administra permisos solo ocultando botones.
- Cada accion mutante muestra confirmacion y motivo si el backend lo exige.
- La tabla de auditoria es de solo lectura.
- El panel no guarda votos ni secretos en localStorage.
- Access/refresh tokens usan cookie segura o almacenamiento apropiado, no texto plano.
- La app distingue `403`, `409`, `422`, `429` y `503` con mensajes accionables.

