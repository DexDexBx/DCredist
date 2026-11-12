/**
 * IMPRESION DE LA CONSTANCIA.
 *
 * Imprime UNICAMENTE el nodo marcado con `.dc-certificate-print`, dentro de un
 * iframe aislado. Imprimir dentro de la aplicacion arrastraba el resto del
 * layout (oculto pero presente) y generaba varias paginas.
 *
 * Detalles clave:
 *  - `@page` usa `margin: 0` para suprimir por completo los encabezados y pies
 *    automaticos del navegador (URL, fecha/hora y titulo) en todas las hojas.
 *  - Los margenes superior e inferior de cada hoja se garantizan mediante una
 *    tabla estructural (`.dc-print-layout`) cuyos `<thead>` y `<tfoot>` se
 *    repiten automaticamente al inicio y final de cada pagina impresa.
 *  - El marco de esquinas y la marca de agua se extraen del flujo y van dentro
 *    de `.dc-print-frame` (`position: fixed`), para que el navegador los repita
 *    centrados y en la misma posicion en cada hoja.
 *  - El iframe tiene el ancho real de A4 (`210 mm`) para que el calculo de
 *    maquetacion y `zoom` coincida exactamente con la impresion.
 *  - Si el contenido se pasa un poco, se reduce con `zoom` para conservar una
 *    sola hoja. Si se pasa mucho NO se encoge hasta ser ilegible: se dejan dos
 *    hojas (o mas), con reglas de corte para no partir bloques a la mitad.
 */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_X_MM = 12;
const PAGE_MARGIN_TOP_MM = 16;
const PAGE_MARGIN_BOTTOM_MM = 14;

/** Por debajo de esto no se encoge: se prefiere una segunda hoja legible. */
const MIN_ZOOM = 0.86;

/** Selectores explicitos de marca de agua (ademas de la deteccion por estilo). */
const WATERMARK_SELECTOR =
  '.dc-watermark, [data-watermark], [class*="watermark"], [class*="marca-agua"], [class*="marca_agua"]';

/**
 * Adorno de esquina (3 cuadros en "L") y contenedor fijo de marca de agua.
 * Al estar en `position: fixed` sobre la hoja A4 completa, ambos se repiten
 * automaticamente en la 1.ª, 2.ª y demas paginas.
 */
const PAGE_FRAME_CSS =
  `.dc-print-frame{position:fixed;top:0;left:0;right:0;bottom:0;` +
  `z-index:0;pointer-events:none;}` +
  `.dc-print-watermark{position:absolute;top:0;left:0;right:0;bottom:0;` +
  `display:flex;align-items:center;justify-content:center;pointer-events:none;}` +
  `.dc-frame-corner{position:absolute;width:20px;height:20px;}` +
  `.dc-frame-corner i{position:absolute;width:8px;height:8px;background:#910048;}` +
  `.dc-frame-corner i:nth-child(1){top:0;left:0;}` +
  `.dc-frame-corner i:nth-child(2){top:0;right:0;}` +
  `.dc-frame-corner i:nth-child(3){bottom:0;left:0;}` +
  `.dc-frame-corner.dc-tl{top:calc(${PAGE_MARGIN_TOP_MM}mm + 4px);left:calc(${PAGE_MARGIN_X_MM}mm + 4px);}` +
  `.dc-frame-corner.dc-tr{top:calc(${PAGE_MARGIN_TOP_MM}mm + 4px);right:calc(${PAGE_MARGIN_X_MM}mm + 4px);transform:scaleX(-1);}` +
  `.dc-frame-corner.dc-bl{bottom:calc(${PAGE_MARGIN_BOTTOM_MM}mm + 4px);left:calc(${PAGE_MARGIN_X_MM}mm + 4px);transform:scaleY(-1);}` +
  `.dc-frame-corner.dc-br{bottom:calc(${PAGE_MARGIN_BOTTOM_MM}mm + 4px);right:calc(${PAGE_MARGIN_X_MM}mm + 4px);transform:scale(-1,-1);}` +
  `.dc-certificate-print{position:relative;z-index:1;background:transparent!important;}` +
  `.dc-certificate-print .dc-frame-pad{padding:0!important;}` +
  `.dc-certificate-print .dc-frame-outer{border:0!important;padding:0!important;}` +
  `.dc-certificate-print .dc-frame-inner{border:0!important;}`;

/**
 * Estructura de margenes repetibles por pagina y reglas de corte.
 * `thead` y `tfoot` de `.dc-print-layout` reservan el margen superior e
 * inferior en cada pagina sin activar los encabezados del navegador.
 */
const PAGE_LAYOUT_AND_BREAK_CSS =
  `.dc-print-layout{width:100%;border-collapse:collapse;table-layout:fixed;margin:0;border:0;background:transparent;}` +
  `.dc-print-layout > thead{display:table-header-group;}` +
  `.dc-print-layout > tfoot{display:table-footer-group;}` +
  `.dc-print-layout > thead > tr > td{height:${PAGE_MARGIN_TOP_MM}mm;padding:0;margin:0;border:0;background:transparent;font-size:0;line-height:0;}` +
  `.dc-print-layout > tfoot > tr > td{height:${PAGE_MARGIN_BOTTOM_MM}mm;padding:0;margin:0;border:0;background:transparent;font-size:0;line-height:0;}` +
  `.dc-print-layout > tbody > tr > td{padding:0 ${PAGE_MARGIN_X_MM}mm;margin:0;border:0;background:transparent;vertical-align:top;}` +
  `.dc-certificate-print .dc-keep,` +
  `.dc-certificate-print tr,` +
  `.dc-certificate-print thead{break-inside:avoid;page-break-inside:avoid;}` +
  `.dc-certificate-print thead{display:table-header-group;}` +
  `.dc-certificate-print tfoot{display:table-footer-group;}`;

export function printCertificate(selector = '.dc-certificate-print'): void {
  const source = document.querySelector<HTMLElement>(selector);

  // Sin nodo imprimible no hay nada que aislar: se usa la impresion normal.
  if (!source) {
    window.print();
    return;
  }

  // Se clona el nodo y se extrae la marca de agua del flujo del documento
  // para colocarla en `.dc-print-frame` centrada en cada hoja.
  const clone = source.cloneNode(true) as HTMLElement;
  const watermarkMarkup = extractWatermarkMarkup(source, clone);

  const headMarkup = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style')
  )
    .map((element) => element.outerHTML)
    .join('\n');

  const pageWidthPx = mmToPx(A4_WIDTH_MM);
  const contentWidthPx = mmToPx(A4_WIDTH_MM - PAGE_MARGIN_X_MM * 2);

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:fixed;top:0;left:-10000px;border:0;' +
    `width:${Math.round(pageWidthPx)}px;height:${Math.round(mmToPx(A4_HEIGHT_MM))}px;`;
  document.body.appendChild(frame);

  const frameDoc = frame.contentDocument;
  const frameWin = frame.contentWindow;

  if (!frameDoc || !frameWin) {
    frame.remove();
    window.print();
    return;
  }

  frameDoc.open();
  frameDoc.write(
    `<!doctype html><html lang="es"><head><meta charset="utf-8" />` +
      // Las hojas de estilo del build de produccion son relativas
      // ("styles-XXXX.css"). Sin <base>, el iframe las resuelve contra
      // about:blank y la constancia se imprime sin estilos.
      `<base href="${document.baseURI}" />` +
      `<title></title>` +
      headMarkup +
      `<style>` +
      `@page{` +
      `size:A4 portrait;` +
      `margin:0;` +
      `@top-left{content:none;}` +
      `@top-center{content:none;}` +
      `@top-right{content:none;}` +
      `@bottom-left{content:none;}` +
      `@bottom-center{content:none;}` +
      `@bottom-right{content:none;}` +
      `}` +
      `html,body{margin:0;padding:0;background:#fff;}` +
      `*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
      `.dc-no-print{display:none!important;}` +
      `.dc-certificate-print{margin:0!important;}` +
      PAGE_FRAME_CSS +
      PAGE_LAYOUT_AND_BREAK_CSS +
      `</style></head><body>` +
      `<table class="dc-print-layout" role="presentation">` +
      `<thead><tr><td></td></tr></thead>` +
      `<tfoot><tr><td></td></tr></tfoot>` +
      `<tbody><tr><td>${clone.outerHTML}</td></tr></tbody>` +
      `</table>` +
      `<div class="dc-print-frame" aria-hidden="true">` +
      watermarkMarkup +
      corner('dc-tl') +
      corner('dc-tr') +
      corner('dc-bl') +
      corner('dc-br') +
      `</div></body></html>`
  );
  frameDoc.close();

  let printed = false;
  const run = (): void => {
    if (printed) {
      return;
    }
    printed = true;
    shrinkIfBarelyOver(frameDoc, contentWidthPx);

    let cleanupTimer = 0;
    const cleanup = (): void => {
      window.clearTimeout(cleanupTimer);
      // Se retira despues de cerrar la vista previa: quitarlo antes puede
      // cortar la impresion o desmaquetar la hoja en algunos navegadores.
      cleanupTimer = window.setTimeout(() => frame.remove(), 400);
    };

    frameWin.addEventListener('afterprint', cleanup, { once: true });
    frameWin.focus();
    frameWin.print();
    // Red de seguridad si el navegador no dispara `afterprint`.
    cleanupTimer = window.setTimeout(() => frame.remove(), 60000);
  };

  const schedule = (): void => {
    window.setTimeout(run, 250);
  };

  // Se imprime cuando estan listas las fuentes; con red de seguridad por si
  // `fonts.ready` no resuelve.
  if (frameDoc.fonts) {
    frameDoc.fonts.ready.then(schedule, schedule);
  } else {
    schedule();
  }
  frameWin.addEventListener('load', schedule);
  window.setTimeout(run, 1200);
}

/**
 * Localiza la marca de agua en el nodo vivo (por selector o estilo computado),
 * la retira del clon del documento y devuelve su HTML centrado para `.dc-print-frame`.
 */
function extractWatermarkMarkup(
  source: HTMLElement,
  clone: HTMLElement
): string {
  const sourceElements = Array.from(source.querySelectorAll<HTMLElement>('*'));
  const cloneElements = Array.from(clone.querySelectorAll<HTMLElement>('*'));

  const explicitMatches = sourceElements.filter((el) =>
    el.matches(WATERMARK_SELECTOR)
  );

  const candidates =
    explicitMatches.length > 0
      ? explicitMatches
      : sourceElements.filter((el) => {
          if (
            el.closest('.dc-no-print') ||
            el.matches(
              '.dc-frame-pad, .dc-frame-outer, .dc-frame-inner, table, thead, tbody, tfoot, tr, td, th'
            )
          ) {
            return false;
          }

          const style = window.getComputedStyle(el);
          const isFloating =
            style.position === 'absolute' || style.position === 'fixed';
          if (!isFloating) {
            return false;
          }

          const isWatermarkStyle =
            parseFloat(style.opacity) < 0.5 ||
            style.pointerEvents === 'none' ||
            Number(style.zIndex) < 0;

          return (
            isWatermarkStyle && el.offsetWidth >= 60 && el.offsetHeight >= 40
          );
        });

  const candidateSet = new Set(candidates);
  const topLevelMatches = candidates.filter((el) => {
    let parent = el.parentElement;
    while (parent && parent !== source) {
      if (candidateSet.has(parent)) {
        return false;
      }
      parent = parent.parentElement;
    }
    return true;
  });

  if (topLevelMatches.length === 0) {
    return '';
  }

  const sourceRect = source.getBoundingClientRect();

  return topLevelMatches
    .map((liveEl) => {
      const index = sourceElements.indexOf(liveEl);
      const cloneEl = cloneElements[index];
      if (!cloneEl) {
        return '';
      }

      const liveStyle = window.getComputedStyle(liveEl);
      const isFullOverlay =
        sourceRect.width > 0 &&
        sourceRect.height > 0 &&
        liveEl.offsetWidth >= sourceRect.width * 0.8 &&
        liveEl.offsetHeight >= sourceRect.height * 0.8;

      cloneEl.remove();

      if (isFullOverlay) {
        cloneEl.style.cssText +=
          ';position:absolute!important;top:0!important;left:0!important;' +
          'right:0!important;bottom:0!important;width:100%!important;height:100%!important;margin:0!important;';
        return cloneEl.outerHTML;
      }

      // Si el elemento ya tiene `translate(-50%, -50%)`, lo anclamos al 50% de la hoja.
      // En caso contrario, lo centramos con flexbox quitando desplazamientos previos.
      const matrixMatch = liveStyle.transform.match(/^matrix\(([^)]+)\)$/);
      if (matrixMatch) {
        const parts = matrixMatch[1].split(',').map((v) => parseFloat(v.trim()));
        const [a, b, c, d, tx, ty] = parts;
        if (Math.abs(tx) > 1 && Math.abs(ty) > 1) {
          cloneEl.style.cssText +=
            ';position:absolute!important;top:50%!important;left:50%!important;' +
            'right:auto!important;bottom:auto!important;margin:0!important;';
          return cloneEl.outerHTML;
        }
        cloneEl.style.cssText += `;transform:matrix(${a},${b},${c},${d},0,0)!important;`;
      }

      cloneEl.style.cssText +=
        ';position:relative!important;top:auto!important;left:auto!important;' +
        'right:auto!important;bottom:auto!important;margin:0!important;';

      return `<div class="dc-print-watermark">${cloneEl.outerHTML}</div>`;
    })
    .join('');
}

/** Adorno de esquina con 3 cuadros. */
function corner(position: string): string {
  return `<span class="dc-frame-corner ${position}"><i></i><i></i><i></i></span>`;
}

/**
 * Si el documento se pasa solo un poco del alto util de A4, lo reduce con
 * `zoom` para conservar una sola hoja. Si se pasa mucho, no se toca: se deja
 * continuar en una segunda pagina, ya con los cortes controlados por CSS.
 */
function shrinkIfBarelyOver(frameDoc: Document, contentWidthPx: number): void {
  const target = frameDoc.querySelector<HTMLElement>('.dc-certificate-print');
  if (!target) {
    return;
  }

  const availableHeight = mmToPx(
    A4_HEIGHT_MM - PAGE_MARGIN_TOP_MM - PAGE_MARGIN_BOTTOM_MM
  );
  const width = target.scrollWidth || target.offsetWidth || contentWidthPx;
  const height = target.scrollHeight || target.offsetHeight;

  if (height <= availableHeight) {
    return;
  }

  const scale = Math.min(availableHeight / height, contentWidthPx / width);

  if (scale < MIN_ZOOM) {
    return;
  }

  (target.style as CSSStyleDeclaration & { zoom?: string }).zoom = String(
    Math.round(scale * 1000) / 1000
  );
}

/** Convierte milimetros a pixeles CSS (1 in = 96 px = 25.4 mm). */
function mmToPx(mm: number): number {
  return (mm * 96) / 25.4;
}