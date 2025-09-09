/**
 * manual_productos_to_csv.js
 * ------------------------------------------------------------
 * Crea un CSV para WooCommerce a partir de:
 *  - Campos comunes editables (COMMON) para TODAS las filas
 *  - Overrides por producto opcionales (PER_PRODUCT_OVERRIDES)
 *  - Un array FINAL de nombres (PRODUCT_NAMES) para generar tantas filas como items haya
 *  - Genera automáticamente las imágenes con prefijo + número (1..n)
 * 
 * Salida: export/productos.manual.DD.MM.YYYY.csv (con BOM)
 */

const fs = require('fs');
const path = require('path');

// === CONFIG GENERAL (EDITABLE) ==============================================

const EXPORT_FOLDER = path.join(__dirname, 'export');

// Prefijo para las imágenes y numeración correlativa
// Resultado: HermesC1.jpg, HermesC2.jpg, ...
const IMAGE_BASENAME = 'Miami-Stock-Hermes-A';  // <-- Cambiá la "C" por lo que necesites
const IMAGE_EXTENSION = '.jpg';
const IMAGE_START_INDEX = 1;        // Si querés que empiece en 10, poné 10

// Ruta web (si la usás) donde estarán subidas las imágenes
// Se arma como: ${IMAGE_BASE_URL}/${YYYY}/${MM}/${IMAGE_BASENAME}${i}.jpg
const IMAGE_BASE_URL = 'https://frontrowco.com/wp-content/uploads';

// Fecha actual para carpeta y nombre de archivo
const now = new Date();
const YYYY = String(now.getFullYear());
const MM = String(now.getMonth() + 1).padStart(2, '0');
const TODAY_LABEL = `${String(now.getDate()).padStart(2, '0')}.${MM}.${YYYY}`;

// === ENCABEZADOS CSV WOO (NO CAMBIAR ORDEN A MENOS QUE SEPAS LO QUE HACÉS) ===

const HEADERS = [
  'ID','Type','SKU','Name','Published','Is featured?','Visibility in catalog','Short description','Description',
  'Date sale price starts','Date sale price ends','Tax status','Tax class','In stock?','Stock','Low stock amount',
  'Backorders allowed?','Sold individually?','Weight (kg)','Length (cm)','Width (cm)','Height (cm)',
  'Allow customer reviews?','Purchase note','Sale price','Regular price','Categories','Tags','Shipping class','Images',
  'Download limit','Download expiry days','Parent','Grouped products','Upsells','Cross-sells','External URL','Button text','Position'
];

// === CAMPOS COMUNES PARA TODAS LAS FILAS (EDITÁ A GUSTO) ====================
// TIP: Lo que no uses, dejalo como '' (cadena vacía). Si algo debe ir igual para todos, ponelo acá.
const COMMON = {
  'ID': '',
  'Type': 'simple',
  'SKU': '',                      // si querés que Woo genere SKU, dejalo vacío
  'Name': 'Hermès',               // si preferís que la columna Name sea el nombre de producto, cambiaremos abajo
  'Published': '1',
  'Is featured?': '0',
  'Visibility in catalog': 'visible',
  'Short description': '',        // podés completar manualmente un HTML corto si querés
  'Description': '',
  'Date sale price starts': '',
  'Date sale price ends': '',
  'Tax status': '',
  'Tax class': '',
  'In stock?': '',                // '1' si querés activar stock por producto
  'Stock': '',
  'Low stock amount': '',
  'Backorders allowed?': '',
  'Sold individually?': '',
  'Weight (kg)': '',
  'Length (cm)': '',
  'Width (cm)': '',
  'Height (cm)': '',
  'Allow customer reviews?': '',
  'Purchase note': '',
  'Sale price': '',
  'Regular price': '',
  'Categories': 'Hermès',         // categoría fija (podés cambiarla)
  'Tags': '',                     // si querés, acá ponés tags comunes para todos separados por coma
  'Shipping class': '',
  'Images': '',                   // se completa automáticamente
  'Download limit': '',
  'Download expiry days': '',
  'Parent': '',
  'Grouped products': '',
  'Upsells': '',
  'Cross-sells': '',
  'External URL': '',
  'Button text': '',
  'Position': '0'
};

// === OVERRIDES POR PRODUCTO (OPCIONAL) ======================================
// Si querés que algún producto tenga valores distintos a COMMON, podés indicarlo por índice.
// Ejemplo: el segundo producto (índice 1) con Regular price distinto y Tags propios.
// Si no necesitás overrides, dejá este objeto vacío.
const PER_PRODUCT_OVERRIDES = {
  // 0: { 'Regular price': '1000', 'Tags': 'Like New, Birkin' },
  // 1: { 'Regular price': '2000', 'Tags': 'Brand New, Kelly' },
};

// === ¿EL NOMBRE DEL PRODUCTO VA EN "Name"? ==================================
// Si querés que la columna "Name" del CSV sea el NOMBRE DEL PRODUCTO del array de abajo, dejá true.
// Si preferís que "Name" quede fijo (por ejemplo "Hermès") y que el array vaya a otra columna (p.ej. Description), usá false.
const USE_PRODUCT_NAME_IN_NAME_COLUMN = true;

// Si USE_PRODUCT_NAME_IN_NAME_COLUMN es false, ¿dónde ponemos el nombre del producto del array?
// Opciones típicas: 'Short description' o 'Description'
const FALLBACK_NAME_TARGET_COLUMN = 'Short description';

// === LISTA FINAL DE NOMBRES (EDITABLE) ======================================
// Acá simplemente pegás/armás la lista final de nombres. El script creará N filas y
// usará esta longitud para numerar imágenes con IMAGE_BASENAME + índice.
const PRODUCT_NAMES = [
  // Ejemplos:
  // 'Birkin 30 Rouge Casaque Epsom Sellier Palladium Hardware Stamp Z',
  // 'Kelly 25 Retourne Etoupe Togo Gold Hardware Stamp B',
  "Birkin 30 Etoupe Togo Gold Hardware stamp K",
  "Birkin 25 Vert Rousseau Shiny Nilo Crocodile Gold Hardware stamp W",
  "Birkin 25 Trench Matte Porousus Crocodile Gold Hardware stamp Square L",
  "Birkin 25 Gold Epsom Sellier Gold Hardware stamp U",
  "Birkin 25 Gold Epsom Sellier Gold Hardware stamp U",
  "Birkin 30 New White Epsom Retourne Palladium Hardware stamp T",
  "Birkin 25 Caban Togo Gold Hardware stamp W",
  "Birkin 25 Togo Vert Fonce Palladium Hardware stamp W",
  "Birkin HAC 40 Black Evercolor | Toile Palladium Hardware stamp B",
  "Kelly 25 Mauve Pale Epsom Palladium Hardware stamp W",
  "Kelly 25 Bleu Atoll Epsom Gold Hardware stamp T",
  "Kelly 20 Mini Black Epsom Gold Hardware stamp W",
  "Kelly 20 Mini Tricolor Bleu Saphir | Bleu Nuit | Black Gold Hardware stamp B",
  "Kelly 20 Mini Gold Epsom Gold Hardware stamp W",
  "Kelly 20 Mini HSS Bleu Nuit | Rose Mexico interior Gold Hardware stamp W",
  "Kelly Pochette Black Swift Gold Hardware stamp W",
  "Constance 18 Mini Black Epsom Rose Gold Hardware stamp W",
  "Bolide on Wheels 1923 Epsom Blue and Orange stamp W",
  "Hac a Dos Natural Sable Togo Palladium Hardware stamp B",
  "Bolide Shark Bag Charm Gold Swift stamp W"
];

// === UTILIDADES =============================================================

function escapeCSV(value) {
  if (value == null) return '';
  const str = String(value);
  // Doble comillas para escapar y encerrar si hace falta
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function ensureExportFolder() {
  if (!fs.existsSync(EXPORT_FOLDER)) {
    fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
  }
}

function buildImageURL(indexOneBased) {
  const fileName = `${IMAGE_BASENAME}${indexOneBased}${IMAGE_EXTENSION}`;
  // si no querés URL completa y solo el nombre de archivo, devolvé fileName.
  return `${IMAGE_BASE_URL}/${YYYY}/${MM}/${fileName}`;
}

function buildRowObject(base, overrides = {}) {
  const row = { ...base };
  for (const k of Object.keys(overrides)) {
    row[k] = overrides[k];
  }
  return row;
}

function objectToCSVRow(obj, headers) {
  return headers.map(h => escapeCSV(obj[h] ?? '')).join(',');
}

// === PROCESO PRINCIPAL =======================================================

(function main() {
  if (!Array.isArray(PRODUCT_NAMES) || PRODUCT_NAMES.length === 0) {
    console.log('⚠️  No hay productos en PRODUCT_NAMES. Agregá al menos uno y volvés a ejecutar.');
    return;
  }

  ensureExportFolder();

  // Cabecera
  const headerLine = HEADERS.join(',');

  // Filas
  const rows = [];
  for (let i = 0; i < PRODUCT_NAMES.length; i++) {
    const productName = PRODUCT_NAMES[i];
    const indexOneBased = IMAGE_START_INDEX + i;

    // Base = COMMON
    const base = { ...COMMON };

    // Asignación del nombre de producto donde corresponda
    if (USE_PRODUCT_NAME_IN_NAME_COLUMN) {
      base['Name'] = productName;
    } else {
      base[FALLBACK_NAME_TARGET_COLUMN] = productName;
    }

    // Imagen auto
    base['Images'] = buildImageURL(indexOneBased);

    // Overrides por producto (opcional)
    const overrides = PER_PRODUCT_OVERRIDES[i] || {};
    const finalRowObj = buildRowObject(base, overrides);
    rows.push(objectToCSVRow(finalRowObj, HEADERS));
  }

  // Archivo
  const outPath = path.join(EXPORT_FOLDER, `productos.miami.${TODAY_LABEL}.csv`);
  fs.writeFileSync(outPath, '\uFEFF' + headerLine + '\n' + rows.join('\n'), 'utf8');

  // Logs
  console.log('------------------------------------------------------------');
  console.log(`✅ CSV generado: ${outPath}`);
  console.log(`🧾 Total de productos: ${PRODUCT_NAMES.length}`);
  console.log(`🖼️ Prefijo de imagen: ${IMAGE_BASENAME} (desde #${IMAGE_START_INDEX})`);
  console.log('🔗 Ejemplo primera imagen:', buildImageURL(IMAGE_START_INDEX));
  console.log('------------------------------------------------------------');
})();
