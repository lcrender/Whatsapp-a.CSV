const fs = require('fs');

const inputText = fs.readFileSync('./mensajes.txt', 'utf8');

const mensajes = inputText
  .split(/\[\d{1,2}:\d{2}, \d{1,2}\/\d{1,2}\/\d{4}\] [^\:]+: /)
  .filter(Boolean);

const parsePrice = (priceStr) => {
  if (!priceStr) return '';
  let num = parseFloat(priceStr.replace('$', '').toLowerCase().replace('k', '')) * 1000;
  return isNaN(num) ? '' : num.toFixed(0);
};

const productos = [];

mensajes.forEach((mensaje, index) => {
  let marca = 'Hermes';
  let descripcion = '';
  let precio_regular = '';
  let precio_oferta = '';

  try {
    const lineas = mensaje.trim().split('\n');

    const texto = lineas[0];
    const precioB2B = lineas.find(l => l.includes('B2B:'));
    const precioB2C = lineas.find(l => l.includes('B2C:'));

    // Modelo
    let modelo = '';
    const modeloMatch = texto.match(/\b(K|B|C)\d{1,2}\b|Birkin \d{1,2}|Kelly \d{1,2}|Constance \d{1,2}/i);
    if (modeloMatch) {
      modelo = modeloMatch[0]
        .replace(/K(\d+)/i, 'Kelly $1')
        .replace(/B(\d+)/i, 'Birkin $1')
        .replace(/C(\d+)/i, 'Constance $1');
    }

    // Material
    let material = '';
    const materialMatch = texto.match(/\b(PHW|GHW|RGHW|BGHW|Palladium Hardware|Gold Hardware|Rose Gold Hardware|Brushed Gold Hardware)\b/i);
    if (materialMatch) {
      material = materialMatch[0]
        .replace('PHW', 'Palladium Hardware')
        .replace('GHW', 'Gold Hardware')
        .replace('RGHW', 'Rose Gold Hardware')
        .replace('BGHW', 'Brushed Gold Hardware');
    }

    // Año (Stamp)
    let año = '';
    const añoMatch = texto.match(/Stamp ([A-Z])\/?(\d{2,4})?/i);
    if (añoMatch) {
      const letra = añoMatch[1];
      const numAño = añoMatch[2];
      año = numAño ? `Stamp ${letra} 20${numAño.slice(-2)}` : `Stamp ${letra}`;
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
      .join(' ');

    // Manejo de Precios
if (/Price Under Request/i.test(mensaje) || (!precioB2B && !precioB2C)) {
    precio_regular = '';
    precio_oferta = '';
    descripcion += ' Price Under Request <div class="oculto">Full set - boutique receipt Brand New</div>';
  } else {
    precio_regular = parsePrice(precioB2B?.split(':')[1]?.trim());
    precio_oferta = parsePrice(precioB2C?.split(':')[1]?.trim());
    descripcion += '<div class="oculto">Full set - boutique receipt Brand New</div>';
  }
  
  // Remover todos los saltos de línea y espacios excesivos
  descripcion = descripcion.replace(/\s+/g, ' ').trim();
  

    // Validación
    if (!modelo || (!precio_regular && !/Price Under Request/i.test(mensaje))) {
      console.log(`Producto n${index + 1} REVISAR`);
    } else {
      console.log(`Producto n${index + 1} creado ok`);
    }

    productos.push({ marca, descripcion, precio_regular, precio_oferta });

  } catch (e) {
    console.log(`Producto n${index + 1} REVISAR`);
  }
});

// Generar CSV manualmente
const header = 'Marca,Descripción,Precio Regular,Precio Oferta\n';
const rows = productos.map(p => {
  return `${p.marca},"${p.descripcion.replace(/"/g, '""')}",${p.precio_regular},${p.precio_oferta}`;
}).join('\n');

fs.writeFileSync('productos.csv', header + rows, 'utf8');
console.log('Archivo productos.csv generado correctamente.');