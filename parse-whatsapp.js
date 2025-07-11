const fs = require('fs');
const path = require('path');

const inputText = fs.readFileSync('./mensajes.txt', 'utf8');
const exportFolder = path.join(__dirname, 'export');
const letter = "E";

if (!fs.existsSync(exportFolder)) {
  fs.mkdirSync(exportFolder, { recursive: true });
}

const mensajes = inputText
  .split(/\[\d{1,2}:\d{2}, \d{1,2}\/\d{1,2}\/\d{4}\] [^:]+: /)
  .map(m => m.trim())
  .filter(Boolean);

const separarProductos = (mensaje) => {
  return mensaje
    .split(/\n(?=(?:Like New\s*[-–—]*\s*)?(?:KP|K\d{2}|B\d{2}|Birkin \d{2}|Kelly(?: Pochette| Elan| Danse| To Go| 20 Mini| 25| 30)?|Constance(?: To Go)?|K\d{2} Mini|B25|B30|B35)\b)/gi)
    .map(p => p.trim())
    .filter(Boolean);
};

const productos = [];

mensajes.forEach((mensaje, indexMsg) => {
  const productosSeparados = separarProductos(mensaje);

  productosSeparados.forEach((bloqueProducto, indexProd) => {
    let descripcion = '';
    let precio_regular = '';
    let precio_oferta = '';

    try {
      const lineas = bloqueProducto.trim().split('\n');
      const texto = lineas[0].replace(/^Like New\s*[-–—]*\s*/i, '').trim();

      // Modelo
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

      // Material
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

      // Año
      let año = '';
      const stampAños = { T: '2015', X: '2016', A: '2017', C: '2018', D: '2019', Y: '2020', Z: '2021', U: '2022', B: '2023', W: '2024', K: '2025' };
      const añoMatch = texto.match(/Stamp ([A-Z])(?:\/?(\d{2,4}))?/i);
      if (añoMatch) {
        const letra = añoMatch[1].toUpperCase();
        let numAño = añoMatch[2];
        if (numAño) {
          numAño = numAño.length === 2 ? `20${numAño}` : numAño;
        } else {
          numAño = stampAños[letra] || '';
        }
        año = numAño ? `Stamp ${letra} ${numAño}` : `Stamp ${letra}`;
      }

      // Detalles
      let detalles = texto
        .replace(modeloMatch ? modeloMatch[0] : '', '')
        .replace(materialMatch ? materialMatch[0] : '', '')
        .replace(/Stamp.*$/i, '')
        .trim();

      descripcion = [modelo, detalles, material, año]
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const ocultoTexto = `<div class="oculto">\n\n\n\nFull set - boutique receipt\n\n\n\nBrand New\n\n\n\n<a href="#" class="whatsapp-button" onclick="openWhatsApp()">Get more info on WhatsApp\n</a>\n\n<script>\nfunction openWhatsApp() {\n  var phoneNumber = "13059429906";\n  var message = "Thank you for contacting FRONT ROW. \\\\nTo assist you personally, please send us this message and we’ll take care of the rest. " + window.location.href;\n  var encodedMessage = encodeURIComponent(message);\n  var whatsappURL = "https://wa.me/" + phoneNumber + "?text=" + encodedMessage;\n  window.open(whatsappURL, "_blank");\n}\n</script>\n\n</div>`;

      descripcion += ocultoTexto;

      productos.push({ descripcion, precio_regular: '', precio_oferta: '' });
      console.log(`Producto ${indexMsg + 1}-${indexProd + 1} creado OK`);
    } catch (e) {
      console.log(`Producto ${indexMsg + 1}-${indexProd + 1} REVISAR`);
    }
  });
});

// Fecha y nombre de archivo
const ahora = new Date();
const añoActual = ahora.getFullYear();
const mesActual = String(ahora.getMonth() + 1).padStart(2, '0');
const fechaHoy = `${String(ahora.getDate()).padStart(2, '0')}.${mesActual}.${añoActual}`;

// Cabecera CSV
const header = `ID,Type,SKU,Name,Published,Is featured?,Visibility in catalog,Short description,Description,Date sale price starts,Date sale price ends,Tax status,Tax class,In stock?,Stock,Low stock amount,Backorders allowed?,Sold individually?,Weight (kg),Length (cm),Width (cm),Height (cm),Allow customer reviews?,Purchase note,Sale price,Regular price,Categories,Tags,Shipping class,Images,Download limit,Download expiry days,Parent,Grouped products,Upsells,Cross-sells,External URL,Button text,Position\n`;

const totalProductos = productos.length;
// const rows = productos.map((p, idx) => {
//   const numImagen = totalProductos - idx;
//   const imagenUrl = `https://frontrowco.com/wp-content/uploads/${añoActual}/${mesActual}/Hermes${letter}${numImagen}.jpg`;
//   return [
//     '', 'simple', '', 'Hermès', '1', '0', 'visible',
//     `"${p.descripcion.replace(/"/g, '""')}"`,
//     '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
//     '', '', // Sale price & Regular price vacíos
//     'Hermès', '', '',
//     imagenUrl,
//     '', '', '', '', '', '', '', '', '0'
//   ].join(',');
// }).join('\n');
const rows = productos.map((p, idx) => {
  const numImagen = idx + 1;
  const imagenUrl = `https://frontrowco.com/wp-content/uploads/${añoActual}/${mesActual}/Hermes${letter}${numImagen}.jpg`;
  return [
    '', 'simple', '', 'Hermès', '1', '0', 'visible',
    `"${p.descripcion.replace(/"/g, '""')}"`,
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    '', '', // Sale price & Regular price vacíos
    'Hermès', '', '',
    imagenUrl,
    '', '', '', '', '', '', '', '', '0'
  ].join(',');
}).join('\n');


const outputPath = path.join(exportFolder, `productos.${fechaHoy}.csv`);
fs.writeFileSync(outputPath, "\uFEFF" + header + rows, 'utf8');

console.log(`✅ Archivo productos.${fechaHoy}.csv generado correctamente.`);
console.log(`\n🧾 Total de productos generados: ${productos.length}`);
