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
 *   GET    /users?search=&role=&status=&professionalSchool=
 *   GET    /users/:id
 *   POST   /users                            (contraseña inicial obligatoria)
 *   PATCH  /users/:id                        (datos, estado o contraseña)
 *   GET    /users/:id/permissions            (matriz de accesos)
 *   PUT    /users/:id/permissions            (reemplaza la matriz)
 *
 *   GET    /modules                          (catalogo de modulos)
 *
 *   GET    /students?search=&professionalSchool=&headquarters=&status=
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
 *   GET    /participations?eventId=&studentId=&status=&participationType=&search=
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
  user: (id: string) => `${API_BASE_URL}/users/${id}`,
  userPermissions: (id: string) => `${API_BASE_URL}/users/${id}/permissions`,

  modules: `${API_BASE_URL}/modules`,

  students: `${API_BASE_URL}/students`,
  student: (id: string) => `${API_BASE_URL}/students/${id}`,
  studentFacets: `${API_BASE_URL}/students/facets`,
  studentParticipations: (id: string) => `${API_BASE_URL}/students/${id}/participations`,
  studentCredits: (id: string) => `${API_BASE_URL}/students/${id}/credits`,
  studentImport: `${API_BASE_URL}/students/import`,

  events: `${API_BASE_URL}/events`,
  event: (id: string) => `${API_BASE_URL}/events/${id}`,
  eventSummary: (id: string) => `${API_BASE_URL}/events/${id}/summary`,
  eventParticipations: (id: string) => `${API_BASE_URL}/events/${id}/participations`,

  participations: `${API_BASE_URL}/participations`,
  participation: (id: string) => `${API_BASE_URL}/participations/${id}`,
  participationImport: `${API_BASE_URL}/participations/import`,

  verification: (code: string) => `${API_BASE_URL}/verification/${code}`,
  verificationBase: `${API_BASE_URL}/verification`,

  reportsDashboard: `${API_BASE_URL}/reports/dashboard`,
  reportsSchoolCredits: `${API_BASE_URL}/reports/schools/credits`,
  reportsCreditsProgress: `${API_BASE_URL}/reports/credits/progress`,
} as const;

/** Alias heredado del contrato anterior. */
export const schoolCreditsEndpoint = API_ENDPOINTS.reportsSchoolCredits;
