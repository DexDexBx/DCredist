import { Injectable, computed, inject } from '@angular/core';
import {
  AccreditationSummary,
  CreditsProgressSummary,
  CreditFilter,
  CreditQuery,
  CreditRowsPage,
  CreditSortKey,
  DEFAULT_CREDITS_TARGET,
  Participation,
  SchoolCreditSummary,
  Student,
  StudentCreditSummary,
  creditsProgress,
  percentage,
  primaryCertificateCode,
  remainingCredits,
  roundCredits,
  studentDisplayName,
} from '../../models';
import { ParticipationService } from './participation.service';
import { StudentService } from './student.service';
import { NAME_COLLATOR } from '../../shared/utils/text.utils';

/**
 * ¿Entra el estudiante en el filtro de situacion?
 *
 * 'all' incluye tambien a quien no tiene nada credito: sin participaciones no hay
 * motivo para ocultarlo de la institucion, y son justo los que hay que detectar.
 *
 * Vive fuera de la clase porque es una regla pura y se llama una vez por
 * estudiante en cada consulta: 260 000 llamadas por pulsacion.
 */
function matchesCreditState(filter: CreditFilter, credits: number, target: number): boolean {
  switch (filter) {
    case 'COMPLETED':
      return credits >= target;
    case 'IN_PROGRESS':
      return credits > 0 && credits < target;
    case 'WITHOUT_CREDITS':
      return credits <= 0;
    default:
      return true;
  }
}

/**
 * MOCK SERVICE - CREDITOS.
 *
 * Los creditos NUNCA se guardan como un total manual en el estudiante: siempre
 * se derivan de las participaciones vigentes.
 *
 *   creditos acumulados = SUM(Participation.credits WHERE status = 'VALID')
 *
 * La meta (21 por defecto) es un parametro del dominio, no un dato del
 * estudiante: `creditsProgress` y `remainingCredits` se recalculan contra ella,
 * asi que cambiar la meta actualiza todas las barras de avance.
 *
 * Contrato de API que debe conservar al migrar a HttpClient:
 *   GET /students/:id/credits
 *   GET /reports/schools/credits
 *   GET /reports/credits/progress
 */
@Injectable({ providedIn: 'root' })
export class CreditService {
  private readonly participationService = inject(ParticipationService);
  private readonly studentService = inject(StudentService);

  /** Meta vigente. Se lee de una variable de entorno en la version con API. */
  readonly creditsTarget = DEFAULT_CREDITS_TARGET;

  /**
   * Credito acumulado por estudiante, en una sola pasada por el historico.
   *
   * Preguntar con `totalCreditsOf()` sobre el padron completo es correcto para UNA
   * ficha, pero un reporte tiene que recorrerlo entero: 260 000 consultas al
   * indice terminan releendo 1 200 000 participaciones una y otra vez. Acumularlo
   * aqui deja el total en un `Map` y convierte el reporte en 260 000 consultas
   * baratas a memoria.
   *
   * Solo suma participaciones VALID: una cancelada no acredita y una pendiente
   * todavia no.
   */
  private readonly creditsByStudent = computed(() => {
    const credits = new Map<string, number>();

    for (const [studentId, participations] of this.participationService.participationsByStudent()) {
      let total = 0;

      for (const participation of participations) {
        if (participation.status === 'VALID') {
          total += participation.credits;
        }
      }

      credits.set(studentId, roundCredits(total));
    }

    return credits;
  });

  /**
   * Orden del padron de mayor a menor credito.
   *
   * Es `computed`, no se recalcula por pulsacion: solo cuando cambian el padron o
   * las participaciones. El filtro de situacion se aplica DESPUES, sobre esta
   * lista ya ordenada, de modo que escribir en el buscador no vuelve a ordenar las
   * 260 000 filas (lo que costaba segundos) sino solo las recorre.
   *
   * Guarda `id` y no la ficha completa a proposito: recorrerlo accessing
   * `students[index]` salta a lugares distintos de memoria260 000 veces y eso por
   * si solo cuesta cientos de milisegundos. Con id y credito el recorrido es
   * lineal de principio a fin, y las 25 fichas de la pagina se resuelven al final.
   */
  private readonly creditRows = computed(() => {
    const students = this.studentService.students();
    const credits = this.creditsByStudent();

    return students
      .map((student) => ({ student, credits: credits.get(student.id) ?? 0 }))
      .sort(
        (a, b) =>
          b.credits - a.credits ||
          NAME_COLLATOR.compare(a.student.lastName, b.student.lastName)
      );
  });

  getStudentCreditSummary(studentId: string): StudentCreditSummary {
    const participations = this.participationService.getByStudent(studentId);
    const valid = participations.filter((participation) => participation.status === 'VALID');
    const cancelled = participations.filter(
      (participation) => participation.status === 'CANCELLED'
    );
    const pending = participations.filter((participation) => participation.status === 'PENDING');

    const totalCredits = this.totalCreditsOf(studentId);

    return {
      studentId,
      totalCredits,
      creditsTarget: this.creditsTarget,
      progress: creditsProgress(totalCredits, this.creditsTarget),
      remainingCredits: remainingCredits(totalCredits, this.creditsTarget),
      completed: totalCredits >= this.creditsTarget,
      totalParticipations: participations.length,
      validParticipations: valid.length,
      cancelledParticipations: cancelled.length,
      pendingParticipations: pending.length,
      eventsParticipated: new Set(valid.map((participation) => participation.eventId)).size,
      // Una participacion registrada siempre tiene un codigo de certificado:
      // el DC de DCredits, o el del sistema anterior si es una migrada.
      certificateCount: participations.filter(
        (participation) => primaryCertificateCode(participation) !== null
      ).length,
      pendingGrades: valid.filter(
        (participation) => participation.grade === null || participation.grade === undefined
      ).length,
    };
  }

  /**
   * Resumenes de creditos de varios estudiantes en una sola pasada.
   *
   * Una tabla paginada de 200 filas no debe pedir 200 resumenes sueltos: aqui se
   * resuelve el indice una vez y se reparte en un Map.
   */
  getStudentCreditSummaries(studentIds: readonly string[]): Map<string, StudentCreditSummary> {
    const summaries = new Map<string, StudentCreditSummary>();
    for (const studentId of studentIds) {
      summaries.set(studentId, this.getStudentCreditSummary(studentId));
    }
    return summaries;
  }

  /** Historial ordenado del estudiante, del evento mas reciente al mas antiguo. */
  getStudentHistory(studentId: string): Participation[] {
    return this.participationService.getByStudent(studentId);
  }

  /**
   * Pagina de estudiantes con su avance hacia la meta.
   *
   * Recorre el padron una sola vez contando y filtrando a la vez, y solo
   * materializa los objetos `Student` de las filas visibles. Con el padron
   * historico completo esto evita 260 000 objetos intermedios por cada tecla o
   * cada pagina cambiada.
   *
   * Ninguno de los dos caminos ordena: el orden por credito viene precalculado en
   * `creditRows` y el por nombre lo tiene cacheado `StudentService`.
   */
  getStudentCreditsPage(query: CreditQuery = {}): CreditRowsPage {
    const filter = query.filter ?? 'all';
    const target = this.creditsTarget;
    const byName = (query.sort ?? 'progress') === 'name';

    const students = this.studentService.students();
    const credits = this.creditsByStudent();

    // Ordenado por nombre, `candidates` son posiciones del padron y el filtro del
    // padron (buscador, escuela, sede) ya viene aplicado. Ordenado por credito,
    // `ordered` son filas {student, credits} en orden descendente de credito.
    const candidates = byName
      ? this.studentService.matchIndices({
          search: query.search,
          professionalSchool: query.professionalSchool,
          headquarters: query.headquarters,
          sort: 'name',
        })
      : null;
    const ordered = candidates ? null : this.creditRows();

    const matches: number[] = [];
    let completed = 0;
    let inProgress = 0;
    let withoutCredits = 0;

    for (let position = 0; position < (candidates ? candidates.length : ordered!.length); position++) {
      const total = candidates
        ? credits.get(students[candidates[position]].id) ?? 0
        : ordered![position].credits;

      if (total <= 0) {
        withoutCredits++;
      } else if (total >= target) {
        completed++;
      } else {
        inProgress++;
      }

      if (matchesCreditState(filter, total, target)) {
        matches.push(position);
      }
    }

    const pageSize = query.pageSize && query.pageSize > 0 ? Math.trunc(query.pageSize) : 25;
    const total = matches.length;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, Math.trunc(query.page ?? 1)), pageCount);
    const offset = (page - 1) * pageSize;

    const items = matches.slice(offset, offset + pageSize).map((position) => {
      const student = candidates ? students[candidates[position]] : ordered![position].student;

      return {
        student,
        name: studentDisplayName(student),
        summary: this.getStudentCreditSummary(student.id),
      };
    });

    return {
      items,
      total,
      page,
      pageSize,
      pageCount,
      from: items.length === 0 ? 0 : offset + 1,
      to: offset + items.length,
      counts: {
        // Los tres estados se cuentan sobre los mismos filtros del padron, asi que
        // las pestanyas siempre suman el mismo total. `total` (las filas de la
        // tabla) si depende del filtro activo.
        all: completed + inProgress + withoutCredits,
        completed,
        inProgress,
        withoutCredits,
      },
    };
  }

  /**
   * Resumen por escuela profesional: base de la futura consulta institucional.
   *
   * Una sola pasada con contadores: no crea un resumen por estudiante, porque
   * con el padron historico completo serian cientos de miles de objetos.
   */
  getSchoolSummaries(): SchoolCreditSummary[] {
    const bySchool = new Map<string, SchoolCreditSummary>();

    for (const student of this.studentService.students()) {
      const school = student.professionalSchool;
      const summary = bySchool.get(school) ?? {
        professionalSchool: school,
        students: 0,
        activeStudents: 0,
        participations: 0,
        validParticipations: 0,
        totalCredits: 0,
      };

      summary.students++;
      if (student.status === 'ACTIVE') {
        summary.activeStudents++;
      }

      const participations = this.participationService.getByStudent(student.id);
      summary.participations += participations.length;
      summary.validParticipations += participations.filter(
        (participation) => participation.status === 'VALID'
      ).length;
      summary.totalCredits += this.totalCreditsOf(student.id);

      bySchool.set(school, summary);
    }

    return Array.from(bySchool.values())
      .map((summary) => ({ ...summary, totalCredits: roundCredits(summary.totalCredits) }))
      .sort((a, b) => b.totalCredits - a.totalCredits);
  }

  /**
   * Top de estudiantes por creditos acumulados.
   *
   * Se detiene en cuanto se llena el limite: ordenar a 260 000 estudiantes solo
   * para mostrar cinco filas es trabajo tirado a la basura.
   */
  topStudents(limit = 5): { studentId: string; name: string; credits: number }[] {
    const best: { studentId: string; name: string; credits: number }[] = [];

    for (const student of this.studentService.students()) {
      const credits = this.totalCreditsOf(student.id);
      if (credits <= 0) {
        continue;
      }

      if (best.length === limit && credits <= best[best.length - 1].credits) {
        continue;
      }

      const index = best.findIndex((item) => item.credits < credits);
      const entry = { studentId: student.id, name: studentDisplayName(student), credits };

      if (index === -1) {
        best.push(entry);
      } else {
        best.splice(index, 0, entry);
      }

      if (best.length > limit) {
        best.pop();
      }
    }

    return best;
  }

  /** Total de creditos otorgados en todo el sistema. */
  readonly globalTotalCredits = computed(() =>
    roundCredits(
      this.participationService
        .participations()
        .filter((participation) => participation.status === 'VALID')
        .reduce((total, participation) => total + participation.credits, 0)
    )
  );

/**
 * Avance global hacia la meta.
 *
 * El promedio se calcula sobre quienes ya tienen creditos: un estudiante en
 * cero no aporta, porque todavia no tiene nada que promediar.
 *
 * Sale de `accreditation`, que ya hace esta misma cuenta en una sola pasada. Antes
 * se armaba aqui un resumen por estudiante: con el padron historico completo eran
 * 260 000 objetos solo para el tablero, y el dashboard pinta las mismas cifras.
 */
  readonly creditsProgress = computed<CreditsProgressSummary>(() => {
    const summary = this.accreditation();

    return {
      creditsTarget: summary.creditsTarget,
      totalCredits: summary.totalCredits,
      remainingCredits: summary.remainingCredits,
      averageProgress: summary.averageProgress,
      studentsCompleted: summary.studentsCompleted,
      studentsWithCredits: summary.studentsWithCredits,
      totalStudents: summary.totalStudents,
    };
  });

/**
   * Corte de acreditacion en UNA sola pasada sobre el padron.
   *
   * Solo se acumulan contadores: los numeros son los mismos que armaba el resumen
   * por estudiante, pero el costo es lineal en participaciones y no crea objetos
   * intermedios. Con 260 000 estudiantes esa diferencia es de 260 000 objetos por
   * cada recalculo.
   *
   * La respuesta es un CONTEO DE ESTUDIANTES (completados / en progreso / sin
   * creditos), que es lo que la institucion necesita ver.
   */
  readonly accreditation = computed<AccreditationSummary>(() => {
    const students = this.studentService.students();
    const target = this.creditsTarget;

    let completed = 0;
    let inProgress = 0;
    let withoutCredits = 0;
    let progressSum = 0;
    let totalCredits = 0;

    for (const student of students) {
      const credits = this.totalCreditsOf(student.id);

      if (credits <= 0) {
        withoutCredits++;
        continue;
      }

      totalCredits += credits;
      progressSum += creditsProgress(credits, target);

      if (credits >= target) {
        completed++;
      } else {
        inProgress++;
      }
    }

    const withCredits = completed + inProgress;
    const totalStudents = students.length;

    return {
      creditsTarget: target,
      totalCredits: roundCredits(totalCredits),
      remainingCredits: roundCredits(Math.max(0, target * withCredits - totalCredits)),
      averageProgress: withCredits === 0 ? 0 : roundCredits(progressSum / withCredits),
      studentsCompleted: completed,
      studentsInProgress: inProgress,
      studentsWithoutCredits: withoutCredits,
      studentsWithCredits: withCredits,
      totalStudents,
      completionRate: percentage(completed, totalStudents),
      participationRate: percentage(withCredits, totalStudents),
    };
  });

  /**
   * Creditos acumulados de un estudiante: solo las participaciones VALID.
   *
   * Es el unico lugar donde se acumula el credito, para que el total y la ficha
   * nunca puedan discrepar. Se apoya en `creditsByStudent`, que es quien lleva la
   * cuenta; un estudiante sin participaciones no llega al indice y vale cero.
   */
  totalCreditsOf(studentId: string): number {
    return this.creditsByStudent().get(studentId) ?? 0;
  }
}
