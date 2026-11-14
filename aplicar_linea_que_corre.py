"""Quipu celu 1.2.1: la línea "Compartida · Último cambio" corre de lado a lado si no entra en la pantalla.
Se corre desde la carpeta quipu-celular, después de aplicar_1_2_1.py. Se puede correr más de una vez."""
from pathlib import Path

RESPALDOS = Path("respaldos")


def leer(ruta):
    crudo = ruta.read_bytes().decode("utf-8-sig")
    fin = "\r\n" if "\r\n" in crudo else "\n"
    return crudo.replace("\r\n", "\n"), fin, crudo


def cambiar(ruta, nombre, viejo, nuevo, marca):
    texto, fin, original = leer(ruta)
    if marca in texto:
        print(f"  {ruta}: {nombre} ya estaba")
        return
    if viejo not in texto:
        raise SystemExit(f"ERROR en {ruta}: no encontré dónde va «{nombre}». No cambié nada.")
    RESPALDOS.mkdir(exist_ok=True)
    (RESPALDOS / (ruta.name + ".antes-linea")).write_text(original, encoding="utf-8", newline="")
    ruta.write_text(texto.replace(viejo, nuevo, 1).replace("\n", fin), encoding="utf-8", newline="")
    print(f"  {ruta}: {nombre} listo")


JS_VIEJO = '''    linea.innerHTML = `<span class="no-icono" aria-hidden="true">${ICONO.colaborar}</span>` +
      `<span>Compartida ${conGuion(nota.codigo)}${ultimo ? " · Último cambio: " + ultimo : ""}</span>`;
    linea.hidden = false;'''
JS_NUEVO = '''    linea.innerHTML = `<span class="no-icono" aria-hidden="true">${ICONO.colaborar}</span>` +
      `<span class="no-compartida-ventana"><span class="no-compartida-texto">` +
      `Compartida ${conGuion(nota.codigo)}${ultimo ? " · Último cambio: " + ultimo : ""}</span></span>`;
    linea.hidden = false;
    // Si el texto no entra, corre despacio de un lado al otro, como la pantallita
    requestAnimationFrame(() => {
      const ventana = linea.querySelector(".no-compartida-ventana");
      const texto = linea.querySelector(".no-compartida-texto");
      if (!ventana || !texto) return;
      const sobra = texto.scrollWidth - ventana.clientWidth;
      texto.classList.toggle("corre", sobra > 0);
      if (sobra > 0) {
        texto.style.setProperty("--sobra", `${-sobra}px`);
        texto.style.setProperty("--duracion", `${(3 + sobra / 30).toFixed(1)}s`);
      }
    });'''

CSS_VIEJO = ".no-compartida span:last-child { overflow: hidden; text-overflow: ellipsis; }"
CSS_NUEVO = """.no-compartida-ventana { flex: 1; min-width: 0; overflow: hidden; }
.no-compartida-texto { display: inline-block; white-space: nowrap; }
.no-compartida-texto.corre { animation: no-correr var(--duracion) ease-in-out infinite alternate; }
@keyframes no-correr {
  0%, 20%   { transform: translateX(0); }
  80%, 100% { transform: translateX(var(--sobra)); }
}"""

if __name__ == "__main__":
    funciones = Path("www") / "funciones"
    if not (funciones / "notas.js").exists():
        raise SystemExit("Corré este script desde la carpeta quipu-celular.")
    print("Línea de compartida que corre:")
    cambiar(funciones / "notas.js", "texto que corre", JS_VIEJO, JS_NUEVO, "no-compartida-ventana")
    cambiar(funciones / "notas.css", "animación", CSS_VIEJO, CSS_NUEVO, "@keyframes no-correr")
    print("Terminado. Ahora volvé a correr: python aplicar_1_2_1.py")