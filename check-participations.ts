import '@angular/compiler';
import { Injector, runInInjectionContext } from '@angular/core';
import { ParticipationService } from './src/app/core/services/participation.service';
import { EventService } from './src/app/core/services/event.service';
import { StudentService } from './src/app/core/services/student.service';

const injector = Injector.create({
  providers: [ParticipationService, EventService, StudentService],
});
const service = runInInjectionContext(injector, () => injector.get(ParticipationService));
const all = service.participations();
console.log('participaciones totales:', all.length.toLocaleString('es-PE'));

// 1. Pagina sin filtros
let t = performance.now();
const page1 = service.getParticipationsPage({});
console.log('pagina 1 ->', page1.items.length, 'filas | total', page1.total.toLocaleString('es-PE'),
  '|', page1.from, '-', page1.to, '|', (performance.now() - t).toFixed(1), 'ms');
console.log('  pageSize', page1.pageSize, '| pageCount', page1.pageCount,
  '| esperado', Math.ceil(page1.total / page1.pageSize));

// 2. Ultima pagina
t = performance.now();
const last = service.getParticipationsPage({ page: page1.pageCount });
console.log('ultima pagina ->', last.items.length, 'filas |', last.page, '/', last.pageCount,
  '|', (performance.now() - t).toFixed(1), 'ms');

// 3. Página fuera de rango se corrige
const over = service.getParticipationsPage({ page: 99999 });
console.log('pagina 99999 -> se muestra', over.page, '(de', over.pageCount, ')');

// 4. Filtro por evento
const eventId = all[0].eventId;
t = performance.now();
const byEvent = service.getParticipationsPage({ eventId });
console.log('por evento ->', byEvent.items.length, 'de', byEvent.total, '|', (performance.now() - t).toFixed(1), 'ms');

// 5. Ordenes
for (const sort of ['student', 'event', 'credits'] as const) {
  t = performance.now();
  const sorted = service.getParticipationsPage({ eventId, sort });
  console.log('orden', sort, '->', sorted.items.length, 'filas |', (performance.now() - t).toFixed(1), 'ms',
    '| primero:', sorted.items[0]?.universityCodeOf ?? '');
}

// 6. Busqueda por codigo de estudiante
const studentCode = service.participationsByStudent().size > 0
  ? (service as never as { studentService: { findById(id: string): { universityCode: string } } })
  : null;
const firstStudentId = [...service.participationsByStudent().keys()][0];
const code = (service as any).studentService.findById(firstStudentId)?.universityCode;
t = performance.now();
const byCode = service.getParticipationsPage({ search: code });
console.log('busqueda por codigo "' + code + '" ->', byCode.total, 'filas |', (performance.now() - t).toFixed(1), 'ms');

// 7. Busqueda por fragmento de codigo DC
const withDc = all.find((p) => p.verificationCode);
if (withDc) {
  const fragment = withDc.verificationCode!.slice(-4);
  t = performance.now();
  const byFragment = service.getParticipationsPage({ search: fragment });
  console.log('busqueda por fragmento "' + fragment + '" ->', byFragment.total, '|',
    'incluye el codigo completo:', byFragment.items.some((p) => p.id === withDc.id), '|',
    (performance.now() - t).toFixed(1), 'ms');
}

// 8. Busqueda con tildes: debe encontrar a quien esta sin tilde
t = performance.now();
const accentless = service.getParticipationsPage({ search: 'PEREZ' });
const accented = service.getParticipationsPage({ search: 'PÉREZ' });
console.log('PEREZ ->', accentless.total, '| PÉREZ ->', accented.total,
  '| deben coincidir:', accentless.total === accented.total, '|', (performance.now() - t).toFixed(1), 'ms');

// 9. Resumen sobre el filtro completo (no solo la pagina)
const summary = service.summarize({});
console.log('resumen global:', JSON.stringify(summary));
const sumValid = summary.valid + summary.cancelled + summary.pending;
console.log('estados suman el total:', sumValid === summary.total, `(${sumValid} = ${summary.total})`);

// 10. Resumen de un filtro debe ser coherente con la pagina
const sumEvent = service.summarize({ eventId });
const pageEvent = service.getParticipationsPage({ eventId });
console.log('resumen del evento total =', sumEvent.total, '== pagina.total', pageEvent.total, ':', sumEvent.total === pageEvent.total);

// 11. Reemision de codigo
const pending = service.pendingCodeMigration();
console.log('pendientes de migrar:', pending.length);
const target = pending.find((p) => p.status !== 'CANCELLED');
if (target) {
  const before = { dc: target.verificationCode, legacy: target.legacyCode };
  const res = service.assignDcCode(target.id);
  const after = service.participations().find((p) => p.id === target.id)!;
  console.log('reemision:', res.outcome, '| nuevo:', after.verificationCode);
  console.log('  anterior conservado:', after.legacyCode === before.legacy, `(${before.legacy} -> ${after.legacy})`);
  console.log('  ambos a la vez:', Boolean(after.verificationCode && after.legacyCode));
  const again = service.assignDcCode(target.id);
  console.log('  idempotente (2a vez):', again.outcome, '| codigo no cambia:', again.participation?.verificationCode === after.verificationCode);
}

// 12. Reemision masiva
t = performance.now();
const bulk = service.assignMissingDcCodes(500);
console.log('reemision masiva:', bulk.length, 'codigos |', (performance.now() - t).toFixed(1), 'ms');
const nuevos = bulk.filter((r) => r.outcome === 'CREATED');
console.log('  todos con legacy conservado:', nuevos.every((r) => r.legacyCode === r.participation?.legacyCode));
console.log('  codigos unicos:', new Set(nuevos.map((r) => r.verificationCode)).size === nuevos.length);
console.log('  pendientes ahora:', service.pendingCodeMigration().length);