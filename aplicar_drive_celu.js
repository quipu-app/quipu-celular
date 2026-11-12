// Suma la sincronización con Drive a la app del celu. Se puede correr más de una vez sin duplicar nada.
const fs = require("fs");
const path = require("path");

function editar(ruta, reemplazos, marca) {
  let texto = fs.readFileSync(ruta, "utf8");
  if (texto.includes(marca)) { console.log(`  ${ruta}: ya estaba, no lo toqué`); return; }
  const original = texto;
  const cr = texto.includes("\r\n");                       // respetar los finales de línea de Windows
  if (cr) texto = texto.replace(/\r\n/g, "\n");
  for (const [viejo, nuevo] of reemplazos) {
    if (!texto.includes(viejo)) { console.log(`  ERROR en ${ruta}: no encontré\n${viejo}`); process.exit(1); }
    texto = texto.replace(viejo, () => nuevo);
  }
  if (cr) texto = texto.replace(/\n/g, "\r\n");
  fs.mkdirSync("respaldos", { recursive: true });              // fuera de www, así no viaja dentro de la app
  fs.writeFileSync(path.join("respaldos", path.basename(ruta) + ".antes"), original);
  fs.writeFileSync(ruta, texto);
  console.log(`  ${ruta}: actualizado (copia en respaldos)`);
}

// 1. index.html: cargar el sincronizador
editar("www/index.html", [[
  '<script src="funciones/arrastre.js"></script>',
  '<script src="funciones/sincronizacion.js"></script><script src="funciones/arrastre.js"></script>',
]], "sincronizacion.js");

// 2. ajustes.js: la sección Google Drive, la fecha del nombre y releer los ajustes al abrir
editar("www/funciones/ajustes.js", [
  ['      <p class="tf-etiqueta">Versión</p>',
   '      ${window.SINCRO ? SINCRO.html() : ""}\n\n      <p class="tf-etiqueta">Versión</p>'],
  ['      ajustes.nombre = $("aj-nombre").value.trim();\n',
   '      ajustes.nombre = $("aj-nombre").value.trim();\n      ajustes.nombre_cambiado = Date.now() / 1000;   // para saber qué nombre gana entre aparatos\n'],
  ['      b.onclick = () => { ajustes.sonido_teclas = b.dataset.tipo; guardar(); sonarTecla(); dibujar(); };\n    });\n  }\n',
   '      b.onclick = () => { ajustes.sonido_teclas = b.dataset.tipo; guardar(); sonarTecla(); dibujar(); };\n    });\n    if (window.SINCRO) SINCRO.conectar(dibujar);\n  }\n'],
  ['    async abrir(lugar) {\n      contenedor = lugar;\n',
   '    async abrir(lugar) {\n      contenedor = lugar;\n      try { ajustes = { ...ajustes, ...JSON.parse(localStorage.getItem(CLAVE)) }; } catch (error) { /* sigue igual */ }   // el nombre pudo llegar de la compu\n'],
], "SINCRO.html()");

// 3. agenda.js: que el sincronizador pueda pedirle que relea los eventos
editar("www/funciones/agenda.js", [[
  "  MODULOS.agenda = {\n",
  "  MODULOS.agenda = {\n    recargar() { cargar(); },          // lo usa la sincronización cuando llegan eventos de la compu\n",
]], "recargar()");

console.log("\nListo. Ahora: npx cap sync android");