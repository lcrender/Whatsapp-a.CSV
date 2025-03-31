const fs = require('fs');

const inputText = fs.readFileSync('./mensajes.txt', 'utf8');

// const mensajes = inputText
//   .split(/\[\d{1,2}:\d{2}, \d{1,2}\/\d{1,2}\/\d{4}\] [^\:]+: /)
//   .filter(Boolean);

const mensajes = inputText
  .split(/(?=(?:[BK]\d{2}|KP|Kelly|Birkin|Constance).*?(?=\n(?:[BK]\d{2}|KP|Kelly|Birkin|Constance)|$))/gs)
  .map(m => m.trim())
  .filter(Boolean);


// const parsePrice = (priceStr) => {
//   if (!priceStr) return '';
//   let num = parseFloat(priceStr.replace('$', '').toLowerCase().replace('k', '')) * 1000;
//   return isNaN(num) ? '' : num.toFixed(0);
// };
const parsePrice = (priceStr) => {
  if (!priceStr) return '';
  let num = parseFloat(
    priceStr
      .replace(/,/g, '') // 👈 eliminamos separadores de miles
      .replace('$', '')
      .toLowerCase()
      .replace('k', '') // por si viene en formato "23.5k"
  );

  // Si venía con "k", multiplicamos
  if (/k/i.test(priceStr)) num *= 1000;

  return isNaN(num) ? '' : num.toFixed(0);
};

const productos = [];

mensajes.forEach((mensaje, index) => {
  let descripcion = '';
  let precio_regular = '';
  let precio_oferta = '';

  try {
    const lineas = mensaje.trim().split('\n');

    const texto = lineas[0];
    const precioB2B = lineas.find(l => l.toLowerCase().includes('b2b:'));
    const precioB2C = lineas.find(l => l.toLowerCase().includes('b2c:'));

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

    // Año (Stamp con años por defecto)
    let año = '';
    const stampAños = { A: '2017', C: '2018', D: '2019', Y: '2020', Z: '2021', U: '2022', B: '2023', W: '2024', T: '2015', X: '2016' };

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
      .replace('(Unused)', '')
      .trim();

    descripcion = [modelo, detalles, material, año]
      .filter(Boolean)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const ocultoTexto = '<div class="oculto">\n\n\n\nFull set - boutique receipt\n\n\n\nBrand New\n\n\n\n</div>';

    if (/Price Under Request/i.test(mensaje) || (!precioB2B && !precioB2C)) {
      precio_regular = '';
      precio_oferta = '';
      descripcion += '\n\nPrice Under Request\n\n' + ocultoTexto;
    } else {
      precio_regular = parsePrice(precioB2C?.split(':')[1]?.trim());
      precio_oferta = parsePrice(precioB2B?.split(':')[1]?.trim());
      descripcion += ocultoTexto;
    }

    productos.push({ descripcion, precio_regular, precio_oferta });
    console.log(`Producto n${index + 1} creado ok`);
  } catch (e) {
    console.log(`Producto n${index + 1} REVISAR`);
  }
});

// Fecha actual para imágenes y nombre de archivo
const ahora = new Date();
const añoActual = ahora.getFullYear();
const mesActual = String(ahora.getMonth() + 1).padStart(2, '0');
const fechaHoy = `${String(ahora.getDate()).padStart(2, '0')}.${mesActual}.${añoActual}`;

// Cabecera CSV WooCommerce
const header = `ID,Type,SKU,Name,Published,Is featured?,Visibility in catalog,Short description,Description,Date sale price starts,Date sale price ends,Tax status,Tax class,In stock?,Stock,Low stock amount,Backorders allowed?,Sold individually?,Weight (kg),Length (cm),Width (cm),Height (cm),Allow customer reviews?,Purchase note,Sale price,Regular price,Categories,Tags,Shipping class,Images,Download limit,Download expiry days,Parent,Grouped products,Upsells,Cross-sells,External URL,Button text,Position\n`;

// Generar filas CSV
const totalProductos = productos.length;

const rows = productos.map((p, idx) => {
  const numImagen = totalProductos - idx;
  const imagenUrl = `https://frontrowco.com/wp-content/uploads/${añoActual}/${mesActual}/HermesA${numImagen}.jpg`;

  return [
    '', 'simple', '', 'Hermès', '1', '0', 'visible',
    `"${p.descripcion.replace(/"/g, '""')}"`,
    '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '',
    p.precio_oferta,
    p.precio_regular,
    'Hermès', '', '',
    imagenUrl,
    '', '', '', '', '', '', '', '', '0'
  ].join(',');
}).join('\n');

// Guardar archivo CSV con codificación UTF-8
fs.writeFileSync(`productos.${fechaHoy}.csv`, "\uFEFF" + header + rows, 'utf8');
console.log(`Archivo productos.${fechaHoy}.csv generado correctamente.`);
