import { compactCode } from './src/app/models/certificate-code';
import { codeContainsCompact } from './src/app/shared/utils/text.utils';
import { buildMockParticipations } from './src/app/core/services/mock-data/participations.mock';
import { buildMockStudents } from './src/app/core/services/mock-data/students.mock';
import { buildMockEvents } from './src/app/core/services/mock-data/events.mock';

(globalThis as { window?: unknown }).window = { location: { search: '?padron=260000' } };

const students = buildMockStudents();
const events = buildMockEvents();
const parts = buildMockParticipations(events, students);
console.log('participaciones:', parts.length.toLocaleString('es-PE'));

const needle = '2213271';
const compact = compactCode(needle);

function bench(label: string, fn: () => number): void {
  const t = performance.now();
  const hits = fn();
  console.log(`${label}: ${(performance.now() - t).toFixed(0)} ms | ${hits} coincidencias`);
}

bench('codeContainsCompact (char a char)', () => {
  let n = 0;
  for (const p of parts) {
    if (
      codeContainsCompact(p.verificationCode, compact) ||
      codeContainsCompact(p.legacyCode, compact)
    ) {
      n++;
    }
  }
  return n;
});

bench('includes nativo sobre el codigo crudo', () => {
  let n = 0;
  for (const p of parts) {
    if (
      (p.verificationCode !== null && p.verificationCode.includes(compact)) ||
      (p.legacyCode !== null && p.legacyCode.includes(compact))
    ) {
      n++;
    }
  }
  return n;
});

bench('indice de codigos compactos precalculado', () => {
  const t0 = performance.now();
  const index = parts.map((p) => compactCode(p.verificationCode ?? '') + '|' + compactCode(p.legacyCode ?? ''));
  const build = performance.now() - t0;
  let n = 0;
  for (let i = 0; i < index.length; i++) {
    if (index[i].includes(compact)) {
      n++;
    }
  }
  console.log(`   (indice construido en ${build.toFixed(0)} ms, ${Math.round(index.length * 30 / 1024 / 1024)} MB aprox)`);
  return n;
});

bench('solo recorrer el Set de ids sobre 1.2M', () => {
  const ids = new Set(parts.slice(0, 4).map((p) => p.id));
  let n = 0;
  for (const p of parts) {
    if (ids.has(p.id)) {
      n++;
    }
  }
  return n;
});