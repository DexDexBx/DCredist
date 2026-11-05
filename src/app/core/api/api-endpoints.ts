/**
 * CONTRATO DE API DE DCREDITS.
 *
 * Refleja los endpoints reales que expone el backend NestJS (prefijo global
 * `/api`). Las URLs son relativas a proposito: el proxy de desarrollo las
 * reenvia a `http://localhost:3000` y en produccion las resuelve el reverse
 * proxy, de modo que no hay que hornear el host en el bundle.
 *
 *   POST   /auth/login                       (credenciales contra users)
 *
 *   Cabecera obligatoria en todo el API salvo el login:
 *     X-User-Id: <id del usuario autenticado>
 *
 *   GET    /users?search=&role=&status=
 *   GET    /users/:id
 *   POST   /users                            (contraseña inicial obligatoria)
 *   PATCH  /users/:id                        (datos, estado o contraseña)
 *   GET    /users/:id/permissions            (matriz de accesos)
 *   PUT    /users/:id/permissions            (reemplaza la matriz)
 *
 *   GET    /modules                          (catalogo de modulos)
 *
 *   GET    /professional-schools?search=&status=&includeGeneral=
 *   POST   /professional-schools
 *   PATCH  /professional-schools/:id
 *   DELETE /professional-schools/:id
 *   GET    /locations?search=&status=
 *   POST   /locations
 *   PATCH  /locations/:id
 *   DELETE /locations/:id
 *   GET    /organizers?search=&status=
 *   POST   /organizers
 *   PATCH  /organizers/:id
 *   DELETE /organizers/:id
 *
 *   GET    /students?search=&professionalSchoolId=&locationId=&status=
 *   GET    /students/facets
 *   POST   /students
 *   PATCH  /students/:id
 *   GET    /students/:id
 *   GET    /students/:id/participations
 *   GET    /students/:id/credits
 *   POST   /students/import                  (carga incremental, no destructiva)
 *
 *   GET    /events
 *   POST   /events
 *   PATCH  /events/:id
 *   GET    /events/:id
 *   GET    /events/:id/summary
 *   GET    /events/:id/participations
 *
 *   GET    /participations?eventId=&studentId=&status=&search=
 *   POST   /participations
 *   PATCH  /participations/:id
 *   POST   /participations/import            (codigos universitarios)
 *
 *   GET    /verification/:code               (validacion de participacion)
 *   GET    /verification?q=&limit=           (sugerencias)
 *
 *   GET    /reports/dashboard
 *   GET    /reports/schools/credits
 *   GET    /reports/credits/progress
 */
export const API_BASE_URL = '/api';

export const API_ENDPOINTS = {
  authLogin: `${API_BASE_URL}/auth/login`,

  users: `${API_BASE_URL}/users`,
  user: (id: number) => `${API_BASE_URL}/users/${id}`,
  userPermissions: (id: number) => `${API_BASE_URL}/users/${id}/permissions`,

  modules: `${API_BASE_URL}/modules`,

  professionalSchools: `${API_BASE_URL}/professional-schools`,
  professionalSchool: (id: number) => `${API_BASE_URL}/professional-schools/${id}`,
  locations: `${API_BASE_URL}/locations`,
  location: (id: number) => `${API_BASE_URL}/locations/${id}`,
  organizers: `${API_BASE_URL}/organizers`,
  organizer: (id: number) => `${API_BASE_URL}/organizers/${id}`,

  students: `${API_BASE_URL}/students`,
  student: (id: number) => `${API_BASE_URL}/students/${id}`,
  studentFacets: `${API_BASE_URL}/students/facets`,
  studentParticipations: (id: number) => `${API_BASE_URL}/students/${id}/participations`,
  studentCredits: (id: number) => `${API_BASE_URL}/students/${id}/credits`,
  studentImport: `${API_BASE_URL}/students/import`,

  events: `${API_BASE_URL}/events`,
  event: (id: number) => `${API_BASE_URL}/events/${id}`,
  eventSummary: (id: number) => `${API_BASE_URL}/events/${id}/summary`,
  eventParticipations: (id: number) => `${API_BASE_URL}/events/${id}/participations`,
  eventTypes: `${API_BASE_URL}/event-types`,

  participations: `${API_BASE_URL}/participations`,
  eligibleStudents: `${API_BASE_URL}/participations/eligible-students`,
  participationStudents: `${API_BASE_URL}/participations/students`,
  participation: (id: number) => `${API_BASE_URL}/participations/${id}`,
  participationImport: `${API_BASE_URL}/participations/import`,

  verification: (code: string) => `${API_BASE_URL}/verification/${encodeURIComponent(code)}`,
  verificationBase: `${API_BASE_URL}/verification`,

  reportsDashboard: `${API_BASE_URL}/reports/dashboard`,
  reportsSchoolCredits: `${API_BASE_URL}/reports/schools/credits`,
  reportsCreditsProgress: `${API_BASE_URL}/reports/credits/progress`,
} as const;

/** Alias heredado del contrato anterior. */
export const schoolCreditsEndpoint = API_ENDPOINTS.reportsSchoolCredits;
