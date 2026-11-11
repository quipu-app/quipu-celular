"""Notas: al seleccionar texto aparece sola la tira de formato, y sus botones no sueltan la selección."""
from pathlib import Path

WWW = Path(__file__).resolve().parent.parent / "www"

CAMBIOS = {
    "funciones/notas.js": [
        ("    if (texto.contains(rango.commonAncestorContainer)) rangoGuardado = rango.cloneRange();",
         """    if (texto.contains(rango.commonAncestorContainer)) {
      rangoGuardado = rango.cloneRange();
      if (!rango.collapsed) {                       // hay algo seleccionado: aparece la tira de formato
        const barra = document.getElementById("no-herramientas");
        if (barra && barra.hidden) {
          barra.hidden = false;
          document.getElementById("no-aa").classList.add("activa");
        }
      }
    }"""),
        ("""["no-herramientas", "no-paleta", "no-aa"].forEach((id) => $(id).addEventListener("mousedown", (e) => e.preventDefault()));""",
         """["no-herramientas", "no-paleta", "no-aa"].forEach((id) => {
      $(id).addEventListener("pointerdown", (e) => e.preventDefault());   // en el celular
      $(id).addEventListener("mousedown", (e) => e.preventDefault());     // con el mouse
    });"""),
    ],
}


def main():
    for nombre, cambios in CAMBIOS.items():
        ruta = WWW / nombre
        texto = ruta.read_text(encoding="utf-8-sig")
        for viejo, nuevo in cambios:
            if nuevo in texto:
                continue                      # ya estaba aplicado
            if viejo not in texto:
                print(f"  ¡OJO! No encontré esto en {nombre}: {viejo[:60]}")
                continue
            texto = texto.replace(viejo, nuevo, 1)
        ruta.write_text(texto, encoding="utf-8")
        print(f"  {nombre}: listo")


if __name__ == "__main__":
    main()
