import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { ParticipationService } from './src/app/core/services/participation.service';
import { EventService } from './src/app/core/services/event.service';
import { StudentService } from './src/app/core/services/student.service';

// El padron completo se activa con ?padron=260000 en la URL.
(globalThis as { window?: unknown }).window = {
  location: { search: '?padron=260000' },
};

const injector = Injector.create({
  providers: [ParticipationService, EventService, StudentService],
});
const service = runInInjectionContext(injector, () => injector.get(ParticipationService));

const mem = () => Math.round(process.memoryUsage().heapUsed / 1024 / 1024);
let t = performance.now();
const all = service.participations();
console.log(`arranque: ${service.participations().length.toLocaleString('es-PE')} participaciones`,
  `| ${(performance.now() - t).toFixed(0)} ms | heap ${mem()} MB`);

const studentService = injector.get(StudentService);
console.log('estudiantes:', studentService.totalCount().toLocaleString('es-PE'));

function time(label: string, fn: () => void): void {
  const start = performance.now();
  fn();
  console.log(`${label}: ${(performance.now() - start).toFixed(0)} ms`);
}

time('pagina 1 (indice por fecha, corte temprano)', () => {
  const p = service.getParticipationsPage({});
  console.log('   ', p.items.length, 'filas | total', p.total.toLocaleString('es-PE'),
    '|', p.pageCount.toLocaleString('es-PE'), 'paginas');
});

time('ultima pagina', () => {
  const p = service.getParticipationsPage({ page: 24_000 });
  console.log('   ', p.items.length, 'filas | pagina', p.page, 'de', p.pageCount);
});

time('busqueda por codigo de estudiante', () => {
  const p = service.getParticipationsPage({ search: '2213271' });
  console.log('   ', p.total, 'resultados');
});

time('MISMA busqueda de nuevo (indice ya caliente)', () => {
  const p = service.getParticipationsPage({ search: '2213271' });
  console.log('   ', p.total, 'resultados');
});

time('busqueda distinta (PEREZ), ya caliente', () => {
  const p = service.getParticipationsPage({ search: 'PEREZ' });
  console.log('   ', p.total, 'resultados');
});

time('busqueda por fragmento (ya caliente)', () => {
  const p = service.getParticipationsPage({ search: 'Y6S8' });
  console.log('   ', p.total, 'resultados');
});

time('filtro por evento', () => {
  const eventId = all[0].eventId;
  const p = service.getParticipationsPage({ eventId });
  console.log('   ', p.total.toLocaleString('es-PE'), 'participaciones del evento');
});

time('resumen global (recorre todo)', () => {
  const s = service.summarize({});
  console.log('   ', JSON.stringify(s));
});

time('orden por estudiante', () => {
  const eventId = all[0].eventId;
  const p = service.getParticipationsPage({ eventId, sort: 'student' });
  console.log('   ', p.items.length, 'filas');
});

time('reemision masiva de 1000 codigos', () => {
  const r = service.assignMissingDcCodes(1000);
  console.log('   ', r.length, 'generados | heap', mem(), 'MB');
});

console.log('heap final:', mem(), 'MB');