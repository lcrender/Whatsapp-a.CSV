const { exec } = require('child_process');

exec('node parse-whatsapp.js', (error, stdout, stderr) => {
  if (error) {
    console.error(`Error al ejecutar el script: ${error.message}`);
    return;
  }
  if (stderr) {
    console.error(`Error en consola: ${stderr}`);
    return;
  }
  console.log(stdout);
});
