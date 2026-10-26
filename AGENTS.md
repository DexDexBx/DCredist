Ahora vamos a iniciar la transformación real de este proyecto en DCredits.

IMPORTANTE:
No hagas todavía la limpieza completa.
No elimines las carpetas demo todavía.
Primero reemplaza completamente el AGENTS.md actual, porque actualmente contiene documentación de TailAdmin.

Crea un nuevo AGENTS.md en la raíz del proyecto.

El sistema se llama oficialmente:

DCredits

Descripción:
DCredits es un sistema web para gestionar la participación de personas en eventos académicos y generar un código único de participación asociado a cada registro.

ALCANCE DE V1:
La V1 se enfocará exclusivamente en:

- Eventos académicos.
- Registro de eventos.
- Gestión de participantes.
- Registro de participación.
- Código único de participación.
- Consulta de la participación mediante ese código.
- Calendario de eventos.
- Visualización de información y estadísticas básicas relacionadas con participación.

IMPORTANTE:
La V1 NO incluye todavía:
- generación de certificados PDF;
- firma digital;
- pagos;
- facturación;
- ecommerce;
- gestión académica completa;
- aulas virtuales;
- cursos;
- LMS;
- RRHH;
- proyectos institucionales;
- módulos administrativos que no estén relacionados con eventos y participación.

TECNOLOGÍA ACTUAL:
- Angular 22.
- TypeScript.
- Standalone Components.
- Angular Control Flow (@if, @for, @switch).
- Tailwind CSS v4.
- FullCalendar v7 para el calendario.
- Arquitectura preparada para consumir una API posteriormente.
- Backend se implementará posteriormente y no debe simularse como una funcionalidad real en frontend.

ARQUITECTURA OBJETIVO:

src/app/
├── core/
│   ├── guards/
│   ├── interceptors/
│   └── services/
│
├── layout/
│   ├── app-layout/
│   ├── app-header/
│   ├── app-sidebar/
│   ├── backdrop/
│   └── auth-page-layout/
│
├── features/
│   ├── auth/
│   ├── events/
│   ├── participants/
│   └── attendance/
│
├── shared/
│   ├── components/
│   ├── form/
│   ├── ui/
│   └── pipes/
│
└── models/

REGLAS GENERALES:

1. El nombre del producto siempre será DCredits.
2. No utilizar TailAdmin como nombre de producto.
3. No agregar referencias innecesarias a TailAdmin.
4. No volver a introducir componentes demo de TailAdmin.
5. No introducir código de ejemplo si no tiene utilidad para DCredits.
6. No agregar dependencias npm sin justificar su necesidad.
7. Preferir las capacidades nativas de Angular antes de instalar librerías.
8. Mantener TypeScript estricto.
9. Mantener componentes standalone.
10. Mantener una arquitectura modular por funcionalidades.
11. Evitar componentes gigantes.
12. Separar presentación, lógica y acceso a datos cuando corresponda.
13. No colocar lógica de negocio dentro de componentes puramente visuales.
14. Los modelos de dominio deben vivir en models/ o dentro de la feature correspondiente cuando sea estrictamente local.
15. Los servicios singleton deben estar en core/services.
16. Los componentes reutilizables deben estar en shared.
17. Las funcionalidades de negocio deben estar en features.
18. No usar datos ficticios como si fueran datos reales.
19. Los mocks deben estar claramente identificados como mocks.
20. No implementar autenticación falsa como si fuera autenticación real.
21. Preparar la aplicación para consumir API mediante HttpClient.
22. No crear directamente lógica de base de datos en el frontend.
23. Mantener las rutas organizadas por feature.
24. Mantener nombres de archivos y clases claros y consistentes.

TAILWIND:

- Usar Tailwind CSS v4.
- Mantener los tokens de diseño centralizados.
- Evitar CSS duplicado.
- Evitar estilos inline salvo casos realmente necesarios.
- No crear una configuración Tailwind antigua si no es necesaria.
- Mantener responsive design.
- Mantener soporte para dark mode si ya forma parte de la base visual.

IDENTIDAD VISUAL:

Producto:
DCredits

La interfaz debe sentirse como un producto propio y no como TailAdmin.

Debe evitar:
- logos de TailAdmin;
- textos de TailAdmin;
- enlaces a TailAdmin;
- banners promocionales;
- referencias a ecommerce;
- referencias a dashboards genéricos;
- contenido ficticio innecesario.

CALENDARIO:

FullCalendar es una pieza importante de DCredits.

Debe conservarse:
- vista mensual;
- vista semanal;
- vista diaria;
- vista anual/multimes;
- responsive;
- dark mode;
- selección/visualización de eventos.

Posteriormente será adaptado al dominio de eventos académicos.

EVENTOS:

Los eventos serán una funcionalidad principal.

La arquitectura debe permitir posteriormente:

Event
- id
- código
- nombre
- descripción
- fecha de inicio
- fecha de fin
- hora
- modalidad
- ubicación
- estado
- capacidad
- organizador

Los nombres definitivos de campos pueden cambiar cuando se diseñe el modelo de dominio real.

PARTICIPANTES:

Debe permitir posteriormente gestionar:

Participant
- id
- nombres
- apellidos
- documento
- email
- teléfono
- institución
- estado

No implementar todavía el modelo definitivo si no se ha diseñado formalmente.

PARTICIPACIÓN:

La participación debe relacionar:

Evento + Participante

Y posteriormente generar un código único de participación.

El código debe ser un identificador que permita consultar la participación.

NO confundir:
- código de participación;
- certificado;
- documento PDF.

DCredits V1 manejará el código de participación, no certificados PDF.

CÓDIGO DE PARTICIPACIÓN:

Debe diseñarse posteriormente como un identificador único, estable y consultable.

No inventar todavía el algoritmo definitivo.

BACKEND:

DCredits tendrá backend.

Por ahora el frontend debe quedar preparado para una API.

No crear un backend ficticio dentro de Angular.

Cuando se implemente la API se utilizarán servicios específicos y tipados.

CALIDAD:

Después de modificaciones importantes:

- ejecutar npm run build;
- revisar errores TypeScript;
- revisar errores de Angular;
- revisar rutas;
- revisar imports;
- revisar referencias a archivos eliminados.

No considerar una tarea terminada si el proyecto deja de compilar.

GIT:

Trabajar con cambios pequeños y verificables.

No hacer commits automáticos sin indicación explícita.

Antes de eliminar archivos importantes, verificar referencias.

No borrar archivos únicamente porque su nombre parezca innecesario.

DOCUMENTACIÓN:

README.md debe documentar DCredits, no TailAdmin.

No copiar documentación extensa del template original.

LICENCIA:

Si existen archivos de licencia del template original, no eliminarlos sin revisar sus obligaciones.

La licencia original debe conservarse cuando corresponda.

REGLA FUNDAMENTAL:

DCredits debe evolucionar desde una base técnica reutilizada, pero el código final debe sentirse y estructurarse como un sistema propio.

No quiero un "TailAdmin personalizado".

Quiero un sistema llamado DCredits que utiliza Angular + Tailwind como tecnología base.
No quiero que ejecutes el api yo lo voy a hacer