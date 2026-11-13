// Notas del celu: cambiar nombre y color de una carpeta. Sube la versión a 1.2.0.
// Se puede correr más de una vez sin duplicar nada.
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
  fs.writeFileSync(path.join("respaldos", path.basename(ruta) + ".antes-editar"), original);
  fs.writeFileSync(ruta, texto);
  console.log(`  ${ruta}: actualizado (copia en respaldos)`);
}

editar("www/funciones/notas.js", [
  // 1. En el menú ⋯ de una carpeta: "Editar esta carpeta", antes de "Borrar"
  ['          ${abiertaCarpeta ? `<button data-accion="carpeta-borrar"',
   '          ${abiertaCarpeta ? `<button data-accion="carpeta-editar">${conIcono("carpeta", "Editar esta carpeta")}</button>` : ""}\n' +
   '          ${abiertaCarpeta ? `<button data-accion="carpeta-borrar"'],
  ["    if (botonBorrarCarpeta) botonBorrarCarpeta.onclick = carpetaBorrar;\n",
   "    if (botonBorrarCarpeta) botonBorrarCarpeta.onclick = carpetaBorrar;\n" +
   "    const botonEditarCarpeta = contenedor.querySelector('[data-accion=\"carpeta-editar\"]');\n" +
   "    if (botonEditarCarpeta) botonEditarCarpeta.onclick = carpetaEditar;\n"],
  // 2. El formulario, igual al de carpeta nueva pero con los datos cargados
  ["  function carpetaBorrar() {\n",
   `  function carpetaEditar() {
    const carpeta = carpetaPorId(carpetaAbierta);
    if (!carpeta) return;
    let color = carpeta.color;
    const lista = document.getElementById("no-lista");
    document.getElementById("no-menu").hidden = true;
    lista.innerHTML = \`
      <p class="tf-etiqueta">Editar carpeta</p>
      <input id="no-nombre-carpeta" class="tf-campo no-ancho" placeholder="Nombre de la carpeta" value="\${escapar(carpeta.nombre)}">
      <div class="no-colores" id="no-colores">
        \${COLORES_CARPETA.map((c) => \`<button data-color="\${c}" style="background:\${c}" aria-label="Color \${c}"></button>\`).join("")}
      </div>
      <div class="tf-fila tf-final">
        <button class="tf-boton secundario" id="no-cancelar-carpeta">Cancelar</button>
        <button class="tf-boton" id="no-guardar-carpeta">Guardar</button>
      </div>\`;
    const marcar = () => lista.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("activa", b.dataset.color === color));
    lista.querySelectorAll("[data-color]").forEach((b) => { b.onclick = () => { color = b.dataset.color; marcar(); }; });
    marcar();
    document.getElementById("no-cancelar-carpeta").onclick = dibujarLista;
    document.getElementById("no-guardar-carpeta").onclick = () => {
      const nombre = document.getElementById("no-nombre-carpeta").value.trim();
      if (!nombre) return;
      Object.assign(carpeta, { nombre, color, modificada: ahora() });
      guardarTodo();
      mostrarLista();
      anunciar("Carpeta guardada");
    };
  }

  function carpetaBorrar() {
`],
], "function carpetaEditar");

editar("www/funciones/ajustes.js", [
  ['window.QUIPU_VERSION = "1.1.1";', 'window.QUIPU_VERSION = "1.2.0";'],
], 'window.QUIPU_VERSION = "1.2.0";');

console.log("\nListo. Ahora: npx cap sync android");