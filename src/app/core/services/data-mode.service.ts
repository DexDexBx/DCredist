import { Injectable, signal } from '@angular/core';

/** Origen vigente de los datos: el API real o el contenido mock de respaldo. */
export type DataSource = 'api' | 'mock';

/**
 * MODO DE DATOS.
 *
 * Lo fija la hidratacion inicial: si el API responde, `source` es 'api' y las
 * escrituras van contra el backend; si no responde, es 'mock' y todo se resuelve
 * en memoria como hasta ahora. Es un servicio sin dependencias para que lo puedan
 * inyectar tanto la hidratacion como los servicios de dominio sin ciclos.
 */
@Injectable({ providedIn: 'root' })
export class DataModeService {
  readonly source = signal<DataSource>('mock');

  get isApi(): boolean {
    return this.source() === 'api';
  }
}
