// Notas del celu: poder borrar una carpeta (sus notas no se borran: quedan sueltas).
// También sube la versión a 1.1.1. Se puede correr más de una vez sin duplicar nada.
const fs = require("fs");
const path = require("path");

function editar(ruta, reemplazos, marca) {
  let texto = fs.readFileSync(ruta, "utf8");
  if (texto.includes(marca)) { console.log(`  ${ruta}: ya estaba, no lo toqué`); return; }
  const original = texto;
  const cr = texto.includes("\r\n");
  if (cr) texto = texto.replace(/\r\n/g, "\n");
  for (const [viejo, nuevo] of reemplazos) {
    if (!texto.includes(viejo)) { console.log(`  ERROR en ${ruta}: no encontré\n${viejo}`); process.exit(1); }
    texto = texto.replace(viejo, () => nuevo);
  }
  if (cr) texto = texto.replace(/\n/g, "\r\n");
  fs.mkdirSync("respaldos", { recursive: true });
  fs.writeFileSync(path.join("respaldos", path.basename(ruta) + ".antes-carpetas"), original);
  fs.writeFileSync(ruta, texto);
  console.log(`  ${ruta}: actualizado (copia en respaldos)`);
}

editar("www/funciones/notas.js", [
  // 1. En el menú ⋯, cuando estás adentro de una carpeta: "Borrar esta carpeta"
  ['          <button data-accion="carpeta-nueva">${conIcono("nueva", "Nueva carpeta")}</button>\n',
   '          <button data-accion="carpeta-nueva">${conIcono("nueva", "Nueva carpeta")}</button>\n' +
   '          ${abiertaCarpeta ? `<button data-accion="carpeta-borrar" class="no-peligro">${conIcono("borrar", "Borrar esta carpeta")}</button>` : ""}\n'],
  ["    contenedor.querySelector('[data-accion=\"carpeta-nueva\"]').onclick = carpetaNueva;\n",
   "    contenedor.querySelector('[data-accion=\"carpeta-nueva\"]').onclick = carpetaNueva;\n" +
   "    const botonBorrarCarpeta = contenedor.querySelector('[data-accion=\"carpeta-borrar\"]');\n" +
   "    if (botonBorrarCarpeta) botonBorrarCarpeta.onclick = carpetaBorrar;\n"],
  // 2. La pregunta antes de borrar, y el borrado (suave, para que viaje a la compu)
  ["  // ================= EL EDITOR =================\n",
   `  function carpetaBorrar() {
    const carpeta = carpetaPorId(carpetaAbierta);
    if (!carpeta) return;
    const adentro = base.notas.filter((n) => !n.borrada && n.carpeta === carpeta.uid);
    const lista = document.getElementById("no-lista");
    document.getElementById("no-menu").hidden = true;
    lista.innerHTML = \`
      <p class="tf-etiqueta">Borrar carpeta</p>
      <p class="tf-mensaje">¿Borrás la carpeta <b>\${escapar(carpeta.nombre)}</b>?
        \${adentro.length === 1 ? "Su nota no se borra: queda suelta." : adentro.length ? \`Sus \${adentro.length} notas no se borran: quedan sueltas.\` : "Está vacía."}</p>
      <div class="tf-fila tf-final">
        <button class="tf-boton secundario" id="no-cancelar-borrar">Cancelar</button>
        <button class="tf-boton" id="no-confirmar-borrar">Borrar</button>
      </div>\`;
    document.getElementById("no-cancelar-borrar").onclick = dibujarLista;
    document.getElementById("no-confirmar-borrar").onclick = () => {
      Object.assign(carpeta, { borrada: 1, modificada: ahora() });
      adentro.forEach((n) => Object.assign(n, { carpeta: null, modificada: ahora() }));
      guardarTodo();
      carpetaAbierta = null;
      vista = "carpetas";
      mostrarLista();
      anunciar("Carpeta borrada");
    };
  }

  // ================= EL EDITOR =================
`],
], "function carpetaBorrar");

editar("www/funciones/ajustes.js", [
  ['window.QUIPU_VERSION = "1.1.0";', 'window.QUIPU_VERSION = "1.1.1";'],
], 'window.QUIPU_VERSION = "1.1.1";');

console.log("\nListo. Ahora: npx cap sync android");