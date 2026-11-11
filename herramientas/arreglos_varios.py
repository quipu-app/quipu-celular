"""Dos arreglos para la app del celular:
1. Repara las letras raras (Ã³, â€¦, Â¡...) que quedaron en algunos archivos.
2. La pantallita muestra los mensajes de a uno, en fila, y a un ritmo que se puede leer."""
import re
from pathlib import Path

WWW = Path(__file__).resolve().parent.parent / "www"
SEÑALES = ("Ã", "â€", "Â")      # cómo se ven las letras rotas


def a_bytes(texto: str) -> bytes:
    """Deshace la lectura equivocada: cada letra vuelve a ser el byte que era."""
    salida = bytearray()
    for letra in texto:
        try:
            salida += letra.encode("cp1252")
        except UnicodeEncodeError:
            if ord(letra) < 256:
                salida.append(ord(letra))
            else:
                raise
    return bytes(salida)


def reparar(texto: str) -> str | None:
    if not any(s in texto for s in SEÑALES):
        return None
    try:
        arreglado = a_bytes(texto).decode("utf-8")
    except (UnicodeEncodeError, UnicodeDecodeError):
        return None
    if sum(arreglado.count(s) for s in SEÑALES) >= sum(texto.count(s) for s in SEÑALES):
        return None
    return arreglado


AVISOS_NUEVO = '''// Los mensajes se muestran de a uno, en fila. Si un mensaje no entra, primero se queda quieto
// un momento, después corre despacio hasta el final y se queda quieto otro momento.
const colaAvisos = [];
let avisoEnCurso = false;

function anunciar(texto) {
  if (!colaAvisos.includes(texto)) colaAvisos.push(texto);
  if (!avisoEnCurso) siguienteAviso();
  return 2800;
}

function siguienteAviso() {
  const texto = colaAvisos.shift();
  if (texto === undefined) {
    avisoEnCurso = false;
    mostrandoAviso = false;
    cartelTexto.className = "";
    actualizarHora();
    return;
  }
  avisoEnCurso = true;
  mostrandoAviso = true;
  cartelTexto.className = "retro";
  cartelTexto.style.animationDelay = "";
  cartelTexto.textContent = texto;

  let duracion = 2800;
  const anchoCartel = cartel.clientWidth;
  const anchoTexto = cartelTexto.scrollWidth;
  if (anchoTexto > anchoCartel) {
    const recorrido = anchoTexto - anchoCartel;
    const tiempoCorriendo = (recorrido / 45) * 1000;     // 45 píxeles por segundo: se lee tranquilo
    duracion = 1000 + tiempoCorriendo + 1200;             // quieto, corre, quieto
    cartelTexto.style.setProperty("--desde", "0px");
    cartelTexto.style.setProperty("--hasta", `${-recorrido}px`);
    cartelTexto.style.setProperty("--duracion", `${tiempoCorriendo}ms`);
    cartelTexto.style.animationDelay = "1s";
    void cartelTexto.offsetWidth;                        // reinicia la animación
    cartelTexto.classList.add("corre");
  }
  clearTimeout(anunciar.reloj);
  anunciar.reloj = setTimeout(siguienteAviso, duracion);
}

function terminarAviso() {
  clearTimeout(anunciar.reloj);
  colaAvisos.length = 0;
  avisoEnCurso = false;
  mostrandoAviso = false;
  cartelTexto.className = "";
  cartelTexto.style.animationDelay = "";
  actualizarHora();
}

function actualizarHora() {'''


def main():
    # 1. Las letras raras
    for ruta in sorted(WWW.rglob("*")):
        if ruta.suffix not in (".js", ".css", ".html") or "lib" in ruta.parts:
            continue
        texto = ruta.read_text(encoding="utf-8-sig")
        arreglado = reparar(texto)
        if arreglado:
            ruta.write_text(arreglado, encoding="utf-8")
            print(f"  Letras reparadas: {ruta.relative_to(WWW)}")

    # 2. Los mensajes de la pantallita, en fila
    ruta = WWW / "quipu.js"
    texto = ruta.read_text(encoding="utf-8-sig")
    if "colaAvisos" in texto:
        print("  quipu.js: los mensajes ya estaban en fila")
    else:
        nuevo, cambios = re.subn(r"// Muestra un texto en el cartel\..*?function actualizarHora\(\) \{",
                                 lambda _: AVISOS_NUEVO, texto, count=1, flags=re.S)
        if cambios:
            ruta.write_text(nuevo, encoding="utf-8")
            print("  quipu.js: mensajes en fila, listo")
        else:
            print("  ¡OJO! No encontré la parte de los mensajes en quipu.js")


if __name__ == "__main__":
    main()
