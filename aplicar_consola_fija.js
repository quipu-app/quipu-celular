// La consola queda fija en la pantalla: la página nunca se corre para arriba ni para los costados.
// Se puede correr más de una vez sin duplicar nada.
const fs = require("fs");
const path = require("path");

function agregar(ruta, texto, marca) {
  const original = fs.readFileSync(ruta, "utf8");
  if (original.includes(marca)) { console.log(`  ${ruta}: ya estaba, no lo toqué`); return; }
  fs.mkdirSync("respaldos", { recursive: true });
  fs.writeFileSync(path.join("respaldos", path.basename(ruta) + ".antes"), original);
  const salto = original.includes("\r\n") ? "\r\n" : "\n";
  fs.writeFileSync(ruta, original.replace(/\s*$/, "") + salto + salto + texto.replace(/\n/g, salto) + salto);
  console.log(`  ${ruta}: actualizado (copia en respaldos)`);
}

agregar("www/estilos.css", `/* --- La consola queda fija: la página nunca se desplaza (solo las zonas "desplazable" de adentro) --- */
html { overflow: hidden; overscroll-behavior: none; }
body { position: fixed; inset: 0; overscroll-behavior: none; }

/* La tapa plegada se ve más ancha por la perspectiva: al terminar de abrir, se esconde del todo */
#tapa { transition: transform 0.45s ease-in, opacity 0.45s ease-in, visibility 0s; }
#aparato.abierto #tapa {
  visibility: hidden;
  transition: transform 0.45s ease-in, opacity 0.45s ease-in, visibility 0s linear 0.45s;
}`, "La consola queda fija");

agregar("www/quipu.js", `// --- Si algo corrió la pantalla (por ejemplo el teclado), vuelve a su lugar ---
const escribiendoAhora = () => document.activeElement &&
  (document.activeElement.tagName === "INPUT" || document.activeElement.isContentEditable);
window.addEventListener("scroll", () => {
  if ((window.scrollX || window.scrollY) && !escribiendoAhora()) window.scrollTo(0, 0);
});
document.addEventListener("focusout", () => setTimeout(() => window.scrollTo(0, 0), 60));`, "vuelve a su lugar");

console.log("\nListo. Ahora: npx cap sync android");