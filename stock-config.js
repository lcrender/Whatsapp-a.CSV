// stock-config.js
// Seleccioná el modo por defecto acá:
const mode = 'web'; // 'miami' | 'web'

module.exports = {
  mode, // modo activo
  common: {
    // Base de uploads de WordPress (el script agrega /YYYY/MM/)
    uploadsBase: 'https://frontrowco.com/wp-content/uploads',
    // Extensión de las imágenes
    imageExt: '.jpg',
  },
  modes: {
    miami: {
      inputPath: './stock-miami.txt',
      exportFolder: './export-miami',
      category: 'miami',
      // Nombre de imagen: prefix + letter + id + ext
      image: { prefix: 'Miami-Stock-Hermes-', letter: 'A' },
      // Nombre de archivo CSV de salida
      outputCsvName: (fechaStr) => `productos.miami.${fechaStr}.csv`,
    },
    web: {
      inputPath: './mensajes.txt',
      exportFolder: './export',
      category: 'Hermès',
      image: { prefix: 'Hermes', letter: 'D' }, // => HermesC{id}.jpg
      outputCsvName: (fechaStr) => `productos.web.${fechaStr}.csv`,
    }
  }
};
