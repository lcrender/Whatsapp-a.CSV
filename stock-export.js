// stock-export.js
const fs = require('fs');
const path = require('path');
const cfg = require('./stock-config.js');

// ===================== Carga y validación de config ======================
const modeKey = cfg.mode || 'web';
const modeCfg = (cfg.modes && cfg.modes[modeKey]) || null;

if (!modeCfg) {
  console.error(`❌ Modo inválido: "${modeKey}". Revisá stock-config.js`);
  process.exit(1);
}

const INPUT_PATH = modeCfg.inputPath;
const EXPORT_FOLDER = path.isAbsolute(modeCfg.exportFolder)
  ? modeCfg.exportFolder
  : path.join(__dirname, modeCfg.exportFolder);
const CATEGORY = modeCfg.category;
const IMG_PREFIX = modeCfg.image?.prefix || '';
const IMG_LETTER = modeCfg.image?.letter || '';
const IMG_EXT = (cfg.common?.imageExt) || '.jpg';
const UPLOADS_BASE = (cfg.common?.uploadsBase) || 'https://frontrowco.com/wp-content/uploads';
const OUTPUT_NAME_FN = modeCfg.outputCsvName || ((f) => `productos.${modeKey}.${f}.csv`);

if (!fs.existsSync(INPUT_PATH)) {
  console.error(`❌ No existe el archivo de entrada: ${INPUT_PATH}`);
  process.exit(1);
}
if (!fs.existsSync(EXPORT_FOLDER)) {
  fs.mkdirSync(EXPORT_FOLDER, { recursive: true });
}

// ===================== Lectura fuente ======================
const inputText = fs.readFileSync(INPUT_PATH, 'utf8');

// === Parseo de mensajes fuente (formato WhatsApp) ===
const mensajes = inputText
  .split(/\[\d{1,2}:\d{2}, \d{1,2}\/\d{1,2}\/\d{4}\] [^:]+: /)
  .map(m => m.trim())
  .filter(Boolean);

// === Helpers ===
const COND_FRASES = [
  'Brand New',
  'New (Unused)',
  'Like New Excellent',
  'Like New',
  'Preowned'
];

// --------------------- Detectores ----------------------
function detectarCondicion(raw) {
  const text = raw || '';

  // 0) "Unused" con o sin paréntesis en cualquier parte
  if (/\bunused\b/i.test(text) || /\(\s*unused\s*\)/i.test(text)) {
    return { condicion: 'New (Unused)', origen: 'detectado "Unused"' };
  }

  // 1) Frase exacta
  const condAlternativas = COND_FRASES.map(f => f.replace(/[()]/g, '\\$&')).join('|');
  const condRegex = new RegExp(`\\b(${condAlternativas})(?!\\w)`, 'i');
  const matchExacto = text.match(condRegex);
  if (matchExacto) {
    const canon = COND_FRASES.find(f => f.toLowerCase() === matchExacto[1].toLowerCase());
    return { condicion: canon, origen: 'frase exacta' };
  }

  // 2) "Excellent" => Like New Excellent
  if (/\bexcellent\b/i.test(text)) {
    return { condicion: 'Like New Excellent', origen: 'normalizado desde "Excellent"' };
  }

  // 3) "new" presente sin "unused" => Brand New
  const newOnly =
    /\bnew\b/i.test(text) &&
    !/\bnew\s*\(\s*unused\s*\)/i.test(text) &&
    !/\bunused\b/i.test(text);
  if (newOnly) {
    return { condicion: 'Brand New', origen: 'normalizado desde "new" sin (Unused)' };
  }

  // 4) Por defecto
  return { condicion: 'Brand New', origen: 'por defecto (no encontrada)' };
}

function detectarModelo(raw) {
  const text = raw || '';

  if (/\bhac\s*(?:à|a)\s*dos\b/i.test(text)) return { modeloTag: 'HAC a Dos', origen: 'match HAC a Dos' };
  if (/\bbirkin\b/i.test(text) || /\bb\d{1,2}\b/i.test(text)) return { modeloTag: 'Birkin', origen: 'match Birkin/B##' };
  if (/\bkelly\b/i.test(text) || /\bkp\b/i.test(text) || /\bk\d{1,2}\b/i.test(text) || /\bkelly\s+pochette\b/i.test(text)) {
    return { modeloTag: 'Kelly', origen: 'match Kelly/KP/K##' };
  }
  if (/\bconstance\b/i.test(text) || /\bc\d{1,2}\b/i.test(text)) return { modeloTag: 'Constance', origen: 'match Constance/C##' };
  if (/\blindy\b/i.test(text)) return { modeloTag: 'Lindy', origen: 'match Lindy' };
  if (/\bbolide\b/i.test(text)) return { modeloTag: 'Bolide', origen: 'match Bolide' };
  return { modeloTag: '', origen: 'no detectado' };
}

function detectarFullSet(raw) {
  const text = raw || '';
  const noReceipt = /\b(?:no\s+(?:receipt|receip|reciept|recipt)|without\s+receipt|w\/o\s+receipt)\b/i.test(text);
  if (noReceipt) {
    return { fullSet: 'Full set no receipt', origen: 'detectado "no receipt"' };
  }
  return { fullSet: 'Full set with receipt', origen: 'por defecto (sin mención de "no receipt")' };
}

// --------------------- Separador ----------------------
function separarProductos(mensaje) {
  const cortes = mensaje
    .split(/\n(?=(?:Like New\s*[-–—]*\s*)?(?:KP|K\d{2}|B\d{2}|C\d{2}|Birkin(?:\s+HAC\s+\d{2}|\s+\d{2})|Kelly(?:\s+Pochette|\s+Elan|\s+Danse|\s+To\s+Go|\s+20\s+Mini|\s+25|\s+30)?|Constance(?:\s+To\s+Go|\s+18\s+Mini|\s+\d{2})?|Lindy(?:\s+\d{2})?|Bolide(?:\s+on\s+Wheels|\s+Shark\s+Bag\s+Charm|\s+\d{2})?|HAC\s*(?:à|a)\s*Dos|Hac\s*a\s*Dos)\b)/gi)
    .map(p => p.trim())
    .filter(Boolean);

  if (cortes.length > 1) return cortes;

  // Fallback: cada línea no vacía es un producto
  return mensaje.split('\n').map(l => l.trim()).filter(Boolean);
}

// --------------------- Proceso ----------------------
const productos = [];
const resumenPorCond = {};
const ensureCondBucket = (cond) => {
  if (!resumenPorCond[cond]) resumenPorCond[cond] = [];
};

mensajes.forEach((mensaje, indexMsg) => {
  const productosSeparados = separarProductos(mensaje);

  productosSeparados.forEach((bloqueProducto, indexProd) => {
    try {
      const lineas = bloqueProducto.trim().split('\n');
      let texto = lineas[0] || '';

      // Detectar
      const { condicion, origen: origenCond } = detectarCondicion(bloqueProducto);
      const { modeloTag, origen: origenModelo } = detectarModelo(bloqueProducto);
      const { fullSet, origen: origenFullSet } = detectarFullSet(bloqueProducto);

      // --- Limpieza del texto visible ---
      const condRemoveRegex = new RegExp(
        `\\b(${[
          ...COND_FRASES,
          'Brand New',
          'New',
          'Like New',
          'Excellent',
          'Used',
          'Pristine',
          'Mint Condition',
          'UNUSED'
        ].map(f => f.replace(/[()]/g, '\\$&')).join('|')})\\b`,
        'gi'
      );
      const receiptTokens = ['full set','with receipt','w/o receipt','without receipt','no receipt'];

      texto = texto
        .replace(condRemoveRegex, '')
        .replace(new RegExp(`\\s*[-–—:|/]*\\s*(?:${receiptTokens.join('|')})\\b`, 'gi'), '')
        .replace(/\(\s*(Used|Unused|Like New|Preowned|Excellent|New)\s*\)/gi, '')
        // Quitar fechas tipo 2023, 7/2025, 07/2025, 2025/7, 2025/07, 2025
        .replace(/\b(?:\d{1,2}\/20\d{2}|20\d{2}\/\d{1,2}|20\d{2})\b/g, '')
        // Separadores residuales
        .replace(/^\s*(?:[-–—:|]\s*)+/, '')
        .replace(/\s*(?:[-–—:|]\s*)+$/, '')
        .replace(/\s{2,}/g, ' ')
        .trim();

      // --- Modelo detallado (para descripción) ---
      let modelo = '';
      const modeloMatch = texto.match(/\b(KP|K\d{1,2}|B\d{1,2}|C\d{1,2}|Birkin \d{1,2}|Kelly \d{1,2}|Kelly Pochette|Constance \d{1,2})\b/i);
      if (modeloMatch) {
        const modeloEncontrado = modeloMatch[0].toUpperCase();
        if (modeloEncontrado === 'KP' || modeloEncontrado === 'KELLY POCHETTE') {
          modelo = 'Kelly Pochette';
        } else {
          modelo = modeloEncontrado
            .replace(/K(\d+)/, 'Kelly $1')
            .replace(/B(\d+)/, 'Birkin $1')
            .replace(/C(\d+)/, 'Constance $1');
        }
        modelo = modelo.split(' ').map(p => p[0] + p.slice(1).toLowerCase()).join(' ');
      }

      // --- Material (hardware) ---
      let material = '';
      const materialMatch = texto.match(/\b(phw|ghw|rghw|bghw|palladium hardware|gold hardware|rose gold hardware|brushed gold hardware)\b/i);
      if (materialMatch) {
        switch (materialMatch[0].toLowerCase()) {
          case 'phw':
          case 'palladium hardware':
            material = 'Palladium Hardware';
            break;
          case 'ghw':
          case 'gold hardware':
            material = 'Gold Hardware';
            break;
          case 'rghw':
          case 'rose gold hardware':
            material = 'Rose Gold Hardware';
            break;
          case 'bghw':
          case 'brushed gold hardware':
            material = 'Brushed Gold Hardware';
            break;
        }
      }

      // --- Stamp ---
      let stamp = '';
      let stampSource = '';
      const mKeyword = texto.match(/\bStamp\s+([A-Z])\b/i);
      if (mKeyword) {
        stamp = `Stamp ${mKeyword[1].toUpperCase()}`;
        stampSource = 'palabra Stamp';
      } else {
        const mIsolated = texto.match(/\b([A-Z])\b\s*(?:20\d{2})?\s*$/i);
        if (mIsolated) {
          stamp = `Stamp ${mIsolated[1].toUpperCase()}`;
          stampSource = 'letra aislada al final';
        }
      }

      // --- Detalles (remover solo lo detectado) ---
      let detalles = texto;
      if (modeloMatch) detalles = detalles.replace(modeloMatch[0], '');
      if (materialMatch) detalles = detalles.replace(materialMatch[0], '');
      if (stamp && stampSource === 'palabra Stamp') {
        detalles = detalles.replace(/\bStamp\s+[A-Z](?:[\/ ]?\d{2,4})?/i, '');
      } else if (stamp && stampSource === 'letra aislada al final') {
        detalles = detalles.replace(/\b([A-Z])\b\s*(?:20\d{2})?\s*$/i, '');
      }
      detalles = detalles.replace(/\s{2,}/g, ' ').trim();

      // --- Tags ---
      const tags = [condicion, modeloTag].filter(Boolean).join(', ');

      // --- Bloque oculto (full set y condición) ---
      const ocultoTexto =
        `<div class="oculto">\n\n${fullSet}\n\n${condicion}\n\n` +
        `<a href="#" class="whatsapp-button" onclick="openWhatsApp()">Inquire</a>\n` +
        `<script>\nfunction openWhatsApp() {\n` +
        `  var phoneNumber = "13059429906";\n` +
        `  var message = "Thank you for contacting FRONT ROW. \\\\nTo assist you personally, please send us this message and we’ll take care of the rest. " + window.location.href;\n` +
        `  var encodedMessage = encodeURIComponent(message);\n` +
        `  var whatsappURL = "https://wa.me/" + phoneNumber + "?text=" + encodedMessage;\n` +
        `  window.open(whatsappURL, "_blank");\n` +
        `}\n</script>\n</div>`;

      // --- Descripción SHORT visible + oculto ---
      const descripcion =
        [modelo, detalles, material, stamp].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
        + ocultoTexto;

      const idProducto = productos.length + 1;
      productos.push({ id: idProducto, descripcion, tags, condicion });

      // Resumen por condición (logs)
      if (!resumenPorCond[condicion]) resumenPorCond[condicion] = [];
      resumenPorCond[condicion].push(idProducto);

      // Logs de control por item
      console.log(`(${modeKey.toUpperCase()}) Producto ${indexMsg + 1}-${indexProd + 1} OK #${idProducto}`);
    } catch (e) {
      console.log(`(${modeKey.toUpperCase()}) Producto ${indexMsg + 1}-${indexProd + 1} REVISAR (${e.message})`);
    }
  });
});

// --------------------- CSV ----------------------
const ahora = new Date();
const añoActual = ahora.getFullYear();
const mesActual = String(ahora.getMonth() + 1).padStart(2, '0');
const fechaHoy = `${String(ahora.getDate()).padStart(2, '0')}.${mesActual}.${añoActual}`;

const baseUploadsURL = `${UPLOADS_BASE}/${añoActual}/${mesActual}/`;

const header =
  `ID,Type,SKU,Name,Published,Is featured?,Visibility in catalog,Short description,Description,` +
  `Date sale price starts,Date sale price ends,Tax status,Tax class,In stock?,Stock,Low stock amount,` +
  `Backorders allowed?,Sold individually?,Weight (kg),Length (cm),Width (cm),Height (cm),` +
  `Allow customer reviews?,Purchase note,Sale price,Regular price,Categories,Tags,Shipping class,Images,` +
  `Download limit,Download expiry days,Parent,Grouped products,Upsells,Cross-sells,External URL,Button text,Position\n`;

const rows = productos.map((p) => {
  // Construcción de nombre de imagen según config
  // web:  Hermes + C + id + .jpg  => HermesC1.jpg
  // miami: Miami-Stock-Hermes- + A + id + .jpg => Miami-Stock-Hermes-A1.jpg
  const imageName = `${IMG_PREFIX}${IMG_LETTER}${p.id}${IMG_EXT}`;
  const imagenUrl = baseUploadsURL + imageName;

  return [
    '',                 // ID
    'simple',           // Type
    '',                 // SKU
    'Hermès',           // Name
    '1',                // Published
    '0',                // Is featured?
    'visible',          // Visibility in catalog
    `"${p.descripcion.replace(/"/g, '""')}"`, // Short description
    '',                 // Description
    '', '',             // Date sale price starts/ends
    '', '',             // Tax status/class
    '', '', '',         // In stock?, Stock, Low stock amount
    '', '',             // Backorders allowed?, Sold individually?
    '', '', '', '',     // Weight/Length/Width/Height
    '', '',             // Allow reviews?, Purchase note
    '', '',             // Sale price, Regular price
    CATEGORY,           // Categories (según modo)
    `"${p.tags.replace(/"/g, '""')}"`, // Tags
    '',                 // Shipping class
    imagenUrl,          // Images
    '', '', '', '', '', '', '', '', '0'
  ].join(',');
}).join('\n');

const outputCsvPath = path.join(EXPORT_FOLDER, OUTPUT_NAME_FN(fechaHoy));
fs.writeFileSync(outputCsvPath, "\uFEFF" + header + rows, 'utf8');

console.log('-'.repeat(60));
console.log(`✅ (${modeKey.toUpperCase()}) Archivo ${path.basename(outputCsvPath)} generado en: ${outputCsvPath}`);
console.log(`🧾 (${modeKey.toUpperCase()}) Total de productos generados: ${productos.length}`);
console.log('-'.repeat(60));
