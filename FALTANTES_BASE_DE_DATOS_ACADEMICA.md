# Análisis: Plataforma Académica Integral (Universidades e Institutos)

Entendido. Descartamos el enfoque de "política nacional/ONPE". CampusVote es un sistema académico diseñado para la vida universitaria e institucional (elección de delegados, ferias de proyectos, evaluación docente y encuestas).

Revisando tus tipos de procesos (`election_process_type`):
`VOTE` (Elecciones), `FAIR` (Ferias), `FEEDBACK` (Evaluación), `FORM` (Formularios).

Para que la base de datos soporte AL CIEN POR CIENTO estos casos de uso académicos, faltan estos detalles:

## 1. Ferias de Proyectos (`FAIR`) - Multimedia
En una feria de ciencias o proyectos de facultad, las "listas" no son partidos políticos, son **Proyectos de Estudiantes**.
- **El problema:** Tu tabla actual `candidate_lists` solo tiene `logo` y `motto`. Un proyecto universitario necesita mostrar un póster (PDF), un video de YouTube (pitch) o múltiples imágenes para que los demás alumnos puedan ver el proyecto en la Web/App y votar.
- **La solución:** Agregar un campo `media_urls Json?` o `attachments Json?` a `candidate_lists` para soportar las galerías de los proyectos estudiantiles.

## 2. Evaluación Docente y Encuestas (`FEEDBACK` / `FORM`)
Cuando un alumno evalúa a un profesor o llena un formulario de satisfacción, no solo "elige una opción", sino que **da una calificación (estrellas) o escribe un comentario**.
- **El problema:** Tu tabla `vote_selections` asume que el voto es solo un "Check" (votar por la opción A o B). No hay dónde guardar que el alumno le puso "5 estrellas" al profesor, o el texto "Excelente clase".
- **La solución:** En `vote_selections` (o dentro de tu `encrypted_payload`), debes asegurar que el esquema soporte un campo `score Int?` (para las 5 estrellas) y `text_answer String?` (para los comentarios anónimos al docente).

## 3. Cursos y Secciones (El eslabón perdido académico)
Si vas a usar CampusVote para **Evaluación Docente**, necesitas saber qué profesor dicta qué curso, y qué alumnos están en ese salón.
- **El problema:** Tu BD tiene `faculties` -> `programs` -> `academic_periods`. Pero **NO tiene cursos ni secciones**. No hay forma de vincular una encuesta de "Feedback" a la clase de "Matemática Básica - Sección A".
- **La solución:** Crear la tabla `courses` (Cursos) y `course_sections` (Secciones/Salones). De este modo, puedes lanzar una encuesta de evaluación docente dirigida específicamente a los alumnos de esa sección.

## 4. Grupos o Tipos de Usuario Específicos
En un instituto, a veces quieres lanzar una encuesta solo para "Alumnos Invicto", "Egresados" o "Cachimbos".
- **El problema:** El Padrón (`voter_registries`) asocia al alumno al programa. Pero si haces una feria de egresados, filtrarlos será difícil sin etiquetas.
- **La solución:** Agregar `student_tags` o un campo de `academic_status` (Regular, Egresado, Suspendido) en `voter_registries` para segmentar quién puede participar en qué formulario.

---
Con estos ajustes, tu BD pasa de ser solo para "Elecciones de Delegados/Decanos", a ser una herramienta que la universidad puede usar **todo el ciclo académico** para Ferias, Evaluaciones Docentes y Formularios institucionales.

