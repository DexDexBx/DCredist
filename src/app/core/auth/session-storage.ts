/**
 * ALMACENAMIENTO DE LA SESION.
 *
 * Vive fuera de `AuthService` para que el interceptor HTTP pueda leer el id del
 * usuario sin inyectar el servicio de autenticacion (que a su vez depende de
 * `HttpClient`, y eso crearia un ciclo de inyeccion).
 */
export const SESSION_STORAGE_KEY = 'dcredits-session';

interface StoredSession {
  id?: unknown;
}

/** Id del usuario guardado en la sesion, o null si no hay sesion valida. */
export function readSessionUserId(): number | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }

  const stored = localStorage.getItem(SESSION_STORAGE_KEY);
  if (!stored) {
    return null;
  }

  try {
    const profile = JSON.parse(stored) as StoredSession;
    const id = Number(profile?.id);
    return Number.isInteger(id) && id > 0 ? id : null;
  } catch {
    return null;
  }
}
