// Ajustes del celu: la versión de verdad y los sonidos del cambio de personaje (como en la compu).
// Se puede correr más de una vez sin duplicar nada.
const fs = require("fs");
const path = require("path");

const ruta = "www/funciones/ajustes.js";
let texto = fs.readFileSync(ruta, "utf8");
if (texto.includes("function efecto(")) {
  console.log(`  ${ruta}: ya estaba, no lo toqué`);
  process.exit(0);
}
const original = texto;
const cr = texto.includes("\r\n");
if (cr) texto = texto.replace(/\r\n/g, "\n");

const reemplazos = [
  ['  const VERSION = "Quipu para celular · versión de prueba";\n',
   '  window.QUIPU_VERSION = "1.1.0";   // subirla en cada versión nueva (y versionName en android/app/build.gradle)\n' +
   '  const VERSION = "Quipu para celular · versión " + window.QUIPU_VERSION;\n'],
  ['  const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));\n',
   '  const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));\n\n' +
   '  // Los sonidos del ritual, los mismos de la compu (con el volumen de los avisos)\n' +
   '  function efecto(nombre) {\n' +
   '    if (!ajustes.volumen_avisos) return;\n' +
   '    const sonido = new Audio(`assets/sonidos/${nombre}.wav`);\n' +
   '    sonido.volume = ajustes.volumen_avisos / 10;\n' +
   '    sonido.play().catch(() => {});\n' +
   '  }\n'],
  ['    anunciar("Escaneando…");\n',
   '    anunciar("Escaneando…");\n    efecto("escaneo");\n'],
  ['    anunciar("Creando…");\n',
   '    efecto("captura");\n    await esperar(400);\n    anunciar("Creando…");\n    efecto("codigo");\n'],
  ['    anunciar("¡Listo!");\n',
   '    anunciar("¡Listo!");\n    efecto("listo");\n'],
  ['    $("aj-antes").onclick = () => { indice = (indice - 1 + cartas.length) % cartas.length; dibujar(); };\n',
   '    $("aj-antes").onclick = () => { indice = (indice - 1 + cartas.length) % cartas.length; efecto("carta"); dibujar(); };\n'],
  ['    $("aj-despues").onclick = () => { indice = (indice + 1) % cartas.length; dibujar(); };\n',
   '    $("aj-despues").onclick = () => { indice = (indice + 1) % cartas.length; efecto("carta"); dibujar(); };\n'],
];
for (const [viejo, nuevo] of reemplazos) {
  if (!texto.includes(viejo)) { console.log(`  ERROR en ${ruta}: no encontré\n${viejo}`); process.exit(1); }
  texto = texto.replace(viejo, () => nuevo);
}
if (cr) texto = texto.replace(/\n/g, "\r\n");
fs.mkdirSync("respaldos", { recursive: true });
fs.writeFileSync(path.join("respaldos", "ajustes.js.antes-detalles"), original);
fs.writeFileSync(ruta, texto);
console.log(`  ${ruta}: actualizado (copia en respaldos)`);