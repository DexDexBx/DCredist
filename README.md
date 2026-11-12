# DCredits

DCredits es una plataforma web para gestionar eventos académicos, estudiantes,
participaciones y créditos, además de emitir y verificar constancias de créditos.

El sistema está compuesto por un frontend Angular y un API NestJS con PostgreSQL
y Prisma.

## Estado actual

El frontend consume el API real de `api/`. La información de estudiantes,
eventos, participaciones, usuarios y catálogos vive en PostgreSQL.

Funcionalidades principales:

- **Portal público de bienvenida** con acceso para estudiantes y administrativos.
- **Portal del estudiante** para validar su código universitario y escuela,
  consultar créditos, historial de participaciones y constancia.
- **Dashboard** con estadísticas de participación y créditos.
- **Eventos académicos**: listado, filtros por origen, detalle, alta, edición,
  calendario e importación masiva actual/histórica.
- **Estudiantes**: padrón, ficha, créditos, constancia, historial, importación
  masiva y eliminación controlada.
- **Participaciones**: registro actual e histórico, importación masiva, edición
  de nota, anulación y reactivación con motivo.
- **Constancias de créditos** persistidas en base de datos, con código único e
  inmutable y estado activo/inactivo según los créditos vigentes.
- **Verificación** de códigos de participación y de constancias.
- **Usuarios, roles y permisos** por módulo.
- **Catálogos** de escuelas profesionales, sedes, organizadores y tipos de evento.

## Stack

### Frontend

- Angular 22
- TypeScript
- Standalone Components
- Angular Control Flow (`@if`, `@for`, `@switch`)
- Tailwind CSS v4
- FullCalendar v7

### Backend

- NestJS 11
- Prisma 7
- PostgreSQL
- Swagger en `/docs`

## Requisitos

- Node.js compatible con Angular 22
- PostgreSQL
- npm

## Estructura

```text
.
├── src/app/                 # Frontend Angular
│   ├── core/                # API, guards, interceptores y servicios singleton
│   ├── layout/              # Layout administrativo y de autenticación
│   ├── features/
│   │   ├── auth/
│   │   ├── catalogs/
│   │   ├── dashboard/
│   │   ├── events/
│   │   ├── participations/
│   │   ├── student-portal/  # Consulta pública de créditos
│   │   ├── students/
│   │   ├── users/
│   │   ├── verification/
│   │   └── welcome/         # Página pública de bienvenida
│   ├── models/
│   └── shared/
│
└── api/                     # Backend NestJS
    ├── prisma/
    │   ├── schema.prisma
    │   ├── migrations/
    │   ├── seed-demo.ts
    │   └── demo-data.ts
    └── src/
        ├── common/
        └── modules/
```

## Puesta en marcha local

### 1. Instalar dependencias

```bash
npm install
cd api
npm install
```

### 2. Configurar la base de datos

Copia `api/.env.example` como `api/.env` y ajusta:

```env
DATABASE_URL="postgresql://USUARIO:CONTRASEÑA@localhost:5432/dcredits?schema=public"
PORT=3000
```

### 3. Aplicar migraciones y generar el cliente Prisma

```bash
cd api
npm run prisma:deploy
npm run prisma:generate
```

### 4. Cargar datos de demostración

```bash
npm run seed:demo
```

Esto crea catálogos, roles, permisos y una cuenta administradora de desarrollo:

```text
Correo: admin@dcredits.com
Contraseña: admin123
```

> No usar estas credenciales en producción.

### 5. Levantar el API

```bash
npm start
```

- API: `http://localhost:3000/api`
- Swagger: `http://localhost:3000/docs`

### 6. Levantar el frontend

Desde la raíz del proyecto:

```bash
npm start
```

El frontend usa `proxy.conf.json` para enviar `/api/*` a `http://localhost:3000`.

## Migraciones y producción

El proyecto usa **una sola migración base**:

```text
api/prisma/migrations/20261107140000_init_dcredits/migration.sql
```

Incluye el esquema completo y los catálogos iniciales:

- Módulos.
- Tipos de evento, incluido `Unspecified`.
- Roles: `ADMIN`, `COORDINATOR`, `ORGANIZER`, `OPERATOR`, `VIEWER`.

### Despliegue en una base nueva

```bash
cd api
npm ci
npx prisma migrate deploy
npx prisma generate
npm run build
npm run start:prod
```

Reglas:

- Usar `prisma migrate deploy`; nunca `prisma migrate dev` en producción.
- No usar `prisma migrate reset` en producción.
- La migración base crea catálogos, pero **no crea el usuario administrador ni la
  escuela `general`**. Eso debe hacerlo el proceso de aprovisionamiento o un seed
  de producción.

### Base de desarrollo existente

Si ya tienes una base de desarrollo con historial de migraciones anterior, no
ejecutes `migrate deploy` directamente: la línea base intentaría crear tablas que
ya existen. Puedes:

- reiniciar la base con `npm run prisma:reset`, o
- conservar los datos adoptando la línea base en el historial de migraciones.

## Rutas del frontend

| Ruta | Descripción |
| --- | --- |
| `/welcome` | Bienvenida pública |
| `/student` | Portal público del estudiante |
| `/` | Dashboard administrativo |
| `/signin` | Inicio de sesión |
| `/no-access` | Cuenta sin módulos habilitados |
| `/events` | Listado de eventos |
| `/events/new` | Nuevo evento |
| `/events/calendar` | Calendario de eventos |
| `/events/:id` | Detalle del evento |
| `/events/:id/edit` | Editar evento |
| `/students` | Padrón de estudiantes |
| `/students/new` | Nuevo estudiante |
| `/students/:id` | Ficha del estudiante |
| `/students/:id/edit` | Editar estudiante |
| `/students/:id/constancy` | Constancia de avance |
| `/students/:id/certificate` | Constancia de créditos |
| `/participations` | Listado de participaciones |
| `/participations/register` | Registrar participación |
| `/verify` | Verificar códigos de participación y constancia |
| `/users` | Usuarios, roles y permisos |
| `/users/new` | Nuevo usuario |
| `/users/:id` | Ficha del usuario |
| `/catalogs/:kind` | Catálogos del sistema |

## Flujo del portal estudiantil

1. El estudiante entra a `/student`.
2. Ingresa su código universitario y selecciona su escuela profesional.
3. El API valida que el código exista y que pertenezca a esa escuela.
4. Si es correcto, muestra:
   - créditos acumulados,
   - participaciones válidas y canceladas,
   - historial de participaciones,
   - código de constancia, si alcanzó la meta.
5. Si alcanza los 21 créditos, aparece una celebración con el código de
   constancia y se registra la constancia en la base de datos.

## Constancias de créditos

La tabla `constancies` tiene relación 1:1 con `students`:

- `code`: código único e inmutable.
- `studentId`: estudiante.
- `issuedAt`: fecha de emisión.
- `creditsAtIssue`: créditos al momento de emitir.
- `currentCredits`: créditos actuales.
- `status`: `ACTIVE` o `INACTIVE`.

Reglas:

- La constancia se crea una sola vez, cuando el estudiante alcanza la meta.
- El código nunca cambia.
- Si los créditos bajan, la constancia pasa a `INACTIVE` y se actualiza
  `currentCredits`.
- Si los créditos vuelven a subir, se reactiva con el mismo código.
- La verificación administrativa consulta el código persistido en la base de
  datos, no una fórmula del frontend.

## Reglas de negocio principales

- Los créditos de una participación provienen del evento.
- Al cambiar los créditos de un evento, se actualizan sus participaciones y se
  recalculan las constancias afectadas.
- Solo las participaciones `VALID` suman créditos.
- Un estudiante no puede registrarse dos veces en el mismo evento.
- Un evento no puede repetir nombre, sin distinguir mayúsculas ni espacios
  sobrantes. La regla aplica a eventos actuales e históricos.
- El código de participación generado por DCredits (`CURRENT`) es único y estable.
- En registros históricos se conserva el código original tal cual llegó: puede
  repetirse, incluso dentro del mismo evento. La identidad de esas
  participaciones es su `id`, no el código.
- Anular o reactivar una participación exige un motivo.
- Los eventos actuales usan fechas completas; los históricos pueden usar fecha
  completa o solo mes/año.
- La eliminación de eventos y estudiantes se bloquea si tienen participaciones.

## Roles y permisos

Roles disponibles:

- `ADMIN`
- `COORDINATOR`
- `ORGANIZER`
- `OPERATOR`
- `VIEWER`

Cada usuario tiene un `roleId` y una matriz propia de permisos por módulo:

- `NONE`: sin acceso.
- `VIEW`: solo consulta.
- `MANAGE`: crear, editar y eliminar.

Los permisos por módulo viven en `user_module_permissions`.

## Autenticación

El login se valida contra la tabla `users` con contraseña hasheada mediante
scrypt.

El frontend conserva la sesión y envía la cabecera:

```text
X-User-Id: <id del usuario>
```

El API usa esa cabecera para resolver el usuario y su alcance por escuela. Es un
mecanismo de la V1; no es JWT ni autenticación fuerte.

Cuando un administrador crea una cuenta o restablece su contraseña, la clave es
temporal: `mustChangePassword` queda en `true`. La persona debe cambiarla con
`POST /auth/change-password` antes de usar el resto del sistema. Mientras ese
indicador siga activo, el API rechaza las demás peticiones y el frontend la
redirige a `/change-password`.

## API principal

Todas las rutas cuelgan de `/api`, excepto Swagger.

Endpoints públicos:

```text
POST /auth/login
GET  /students/portal/schools
POST /students/portal/consult
```

Requieren `X-User-Id`:

```text
GET    /students
GET    /students/:id
POST   /students
PATCH  /students/:id
DELETE /students/:id
GET    /students/:id/constancy
GET    /students/:id/credits
POST   /students/import

GET    /events
POST   /events
PATCH  /events/:id
DELETE /events/:id
POST   /events/import

GET    /participations
POST   /participations
PATCH  /participations/:id
DELETE /participations/:id
POST   /participations/import

GET    /verification/:code
GET    /verification/constancies/:code

GET    /users
POST   /users
PATCH  /users/:id
GET    /users/:id/permissions
PUT    /users/:id/permissions
```

## Calidad y builds

Frontend:

```bash
npm run build
```

API:

```bash
cd api
npm run build
npx tsc --noEmit
```

## Licencia

Este proyecto se desarrolló sobre una base técnica de terceros. Revisa el
archivo de licencia en la raíz del repositorio antes de distribuir.
