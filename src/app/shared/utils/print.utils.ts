/**
 * IMPRESION DE LA CONSTANCIA.
 *
 * Imprime UNICAMENTE el nodo marcado con `.dc-certificate-print`, dentro de un
 * iframe aislado. Imprimir dentro de la aplicacion arrastraba el resto del
 * layout (oculto pero presente) y generaba varias paginas.
 *
 * Detalles que rompian el resultado:
 *  - El iframe debe tener un ancho real (~ancho util de A4). Con ancho 0 el
 *    documento se maquetaba a 0 px y la hoja salia deformada.
 *  - Si el contenido se pasa un poco, se reduce con `zoom` para conservar una
 *    sola hoja. Si se pasa mucho NO se encoge hasta ser ilegible: se dejan dos
 *    hojas (o mas), pero con reglas de corte para que ningun bloque quede
 *    partido a la mitad.
 *
 * El marco no lleva lineas: solo el motivo de CUADROS en las esquinas. Va en un
 * elemento `position:fixed`, que el navegador repite en cada hoja, asi el
 * adorno aparece igual en la 1.ª, 2.ª y demas paginas.
 */
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;
const PAGE_MARGIN_X_MM = 12;
const PAGE_MARGIN_TOP_MM = 16;
const PAGE_MARGIN_BOTTOM_MM = 14;

/** Por debajo de esto no se encoge: se prefiere una segunda hoja legible. */
const MIN_ZOOM = 0.86;

/**
 * Adorno de esquina: 3 cuadros en "L" (como el icono del logo). Se espeja en
 * cada esquina para que apunten hacia afuera.
 */
const PAGE_FRAME_CSS =
  // `z-index:0` (no negativo): un elemento posicionado se pinta POR ENCIMA del
  // fondo del body. Con `z-index:-1` quedaba debajo del blanco del body y los
  // cuadros desaparecian en la impresion.
  `.dc-print-frame{position:fixed;top:0;left:0;right:0;bottom:0;` +
  `z-index:0;pointer-events:none;}` +
  `.dc-frame-corner{position:absolute;width:20px;height:20px;}` +
  `.dc-frame-corner i{position:absolute;width:8px;height:8px;background:#910048;}` +
  `.dc-frame-corner i:nth-child(1){top:0;left:0;}` +
  `.dc-frame-corner i:nth-child(2){top:0;right:0;}` +
  `.dc-frame-corner i:nth-child(3){bottom:0;left:0;}` +
  `.dc-frame-corner.dc-tl{top:4px;left:4px;}` +
  `.dc-frame-corner.dc-tr{top:4px;right:4px;transform:scaleX(-1);}` +
  `.dc-frame-corner.dc-bl{bottom:4px;left:4px;transform:scaleY(-1);}` +
  `.dc-frame-corner.dc-br{bottom:4px;right:4px;transform:scale(-1,-1);}` +
  // El documento va encima del marco y sin su propio marco: la hoja lleva solo
  // los cuadros. Al ser transparente, los cuadros se ven a traves de el.
  `.dc-certificate-print{position:relative;z-index:1;background:transparent!important;}` +
  `.dc-certificate-print .dc-frame-pad{padding:0!important;}` +
  `.dc-certificate-print .dc-frame-outer{border:0!important;padding:0!important;}` +
  `.dc-certificate-print .dc-frame-inner{border:0!important;}`;

/*
 * Reglas de corte. `break-inside: avoid` mantiene enteros los bloques con
 * `.dc-keep`, las filas de tabla y los titulos de la tabla. El resto del
 * documento fluye para que el salto de pagina sea limpio.
 */
const PAGE_BREAK_CSS =
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

  const headMarkup = Array.from(
    document.querySelectorAll('link[rel="stylesheet"], style')
  )
    .map((element) => element.outerHTML)
    .join('\n');

  const contentWidthPx = mmToPx(A4_WIDTH_MM - PAGE_MARGIN_X_MM * 2);

  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText =
    'position:fixed;top:0;left:-10000px;border:0;' +
    `width:${Math.round(contentWidthPx)}px;height:${Math.round(mmToPx(A4_HEIGHT_MM))}px;`;
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
      `<title>Constancia de créditos · DCredits</title>` +
      headMarkup +
      `<style>` +
      `@page{size:A4 portrait;` +
      `margin:${PAGE_MARGIN_TOP_MM}mm ${PAGE_MARGIN_X_MM}mm ${PAGE_MARGIN_BOTTOM_MM}mm;}` +
      `html,body{margin:0;padding:0;background:#fff;}` +
      `*{-webkit-print-color-adjust:exact;print-color-adjust:exact;}` +
      `.dc-no-print{display:none!important;}` +
      `.dc-certificate-print{margin:0!important;}` +
      PAGE_FRAME_CSS +
      PAGE_BREAK_CSS +
      `</style></head><body>${source.outerHTML}` +
      `<div class="dc-print-frame" aria-hidden="true">` +
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
    frameWin.focus();
    frameWin.print();
    window.setTimeout(() => frame.remove(), 1500);
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
