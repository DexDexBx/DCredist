# DCredits

DCredits es un sistema web para gestionar la participacion de personas en eventos
academicos y generar un codigo unico de participacion asociado a cada registro.

## Estado actual

El frontend consume el API NestJS de `api/` cuando esta disponible: al arrancar
hidrata eventos, estudiantes y participaciones, y las escrituras (alta de eventos
y estudiantes, estado de un estudiante, registro/anulacion de participaciones e
importaciones) se envian al backend. Si el API no responde, la aplicacion arranca
igual con datos de demostracion y lo indica en la cabecera con la etiqueta
**Datos de demostración**.

Funcionalidades disponibles en la interfaz:

- Dashboard con estadisticas de participacion y creditos.
- Eventos academicos: listado con filtros, alta, detalle y calendario.
- Calendario de eventos con vistas diaria, semanal, mensual y anual.
- Padron de estudiantes: listado, alta, ficha, creditos e importacion masiva.
- Registro de participaciones (una por evento y estudiante) e importacion de
  codigos universitarios.
- Codigo unico de participacion (`DC-AAAA-XXXXXX`) y su pagina de verificacion.
- Exportacion Excel por evento en formato institucional.
- Perfiles de acceso de demostracion con navegacion y rutas restringidas por rol.

## Stack

- Angular 22
- TypeScript
- Standalone Components
- Angular Control Flow (`@if`, `@for`, `@switch`)
- Tailwind CSS v4
- FullCalendar v7

## Scripts

```bash
npm install     # instalar dependencias
npm start       # servidor de desarrollo
npm run build   # build de produccion
npm run watch   # build en modo watch
```

## Ejecutar con el API

El backend NestJS + Prisma + PostgreSQL vive en `api/`. Desde otra terminal:

```bash
cd api
npm install
npm run prisma:deploy   # aplica las migraciones
npm run seed:demo       # carga los datos de demostracion
npm start               # API en http://localhost:3000 (Swagger en /docs)
```

El frontend usa `proxy.conf.json` para enviar `/api/*` a `http://localhost:3000`,
asi que no hay que configurar ninguna URL. Si el API no esta corriendo, el
frontend arranca igual con datos de demostracion.

## Rutas

| Ruta                        | Descripcion                    |
| --------------------------- | ------------------------------ |
| `/`                         | Dashboard                      |
| `/events`                   | Listado de eventos             |
| `/events/new`               | Nuevo evento                   |
| `/events/calendar`          | Calendario de eventos          |
| `/events/:id`               | Detalle del evento             |
| `/students`                 | Padron de estudiantes           |
| `/students/new`             | Nuevo estudiante               |
| `/students/:id`             | Ficha del estudiante           |
| `/participations`           | Participaciones registradas    |
| `/participations/register`  | Registrar participacion        |
| `/verify`                   | Verificar codigo de participacion |
| `/users`                    | Usuarios y perfiles (solo admin)  |
| `/catalogs/:kind`           | Catálogos: organizadores, escuelas y sedes |
| `/signin`                   | Acceso de demostracion          |
| `/signup`                   | Crear cuenta (no habilitado)    |
| `/**`                       | Pagina no encontrada           |

## Arquitectura

```
src/app/
├── core/
│   ├── api/          # contrato de endpoints y configuracion HTTP
│   ├── interceptors/ # interceptores de HttpClient
│   └── services/     # servicios singleton y acceso a datos
│
├── layout/           # app-layout, header, sidebar, backdrop, auth-page-layout
│
├── features/
│   ├── auth/         # pantallas y formularios de acceso (prototipo)
│   ├── catalogs/     # organizadores, escuelas profesionales y sedes
│   ├── dashboard/    # resumen y estadisticas
│   ├── errors/       # pagina no encontrada
│   ├── events/       # eventos academicos y calendario
│   ├── participations/ # registro y listado de participaciones
│   ├── students/     # padron de estudiantes
│   ├── users/        # usuarios, perfiles y permisos
│   └── verification/ # consulta del codigo de participacion
│
├── models/           # modelos de dominio
└── shared/
    ├── components/   # UI reutilizable y componentes de formulario
    ├── constants/    # mapeos de estado a presentacion
    └── utils/        # formato de fechas, texto y CSV
```

## Alcance de V1

- Eventos Academicos
- Registro de eventos
- Gestion de participantes
- Registro de participacion
- Codigo unico de participacion
- Consulta de participacion mediante ese codigo
- Calendario de eventos
- Informacion y estadisticas basicas de participacion

La V1 no incluye certificados PDF, firma digital, pagos, facturacion,
ecommerce, gestion academica completa, aulas virtuales, cursos, LMS, RRHH
ni proyectos institucionales.

## Datos y autenticación

Eventos, estudiantes y participaciones provienen del API cuando este responde. La sesión se guarda en `localStorage`. Los permisos se gestionan desde el módulo `/users` (solo administrador). Los catálogos (`/catalogs/organizers`, `/catalogs/schools`, `/catalogs/headquarters`) alimentan los formularios de eventos y estudiantes.

Usuario administrador por defecto:
- Correo: `admin@dcredits.com`
- Contraseña: `admin123`

## Licencia

Este proyecto se desarrollo sobre una base tecnica de terceros.
Revisa el archivo de licencia en la raiz del repositorio antes de distribuir.
