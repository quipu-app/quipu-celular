"""Arreglos de Notas en el celular: íconos en los menús y formato sobre el texto seleccionado."""
from pathlib import Path

WWW = Path(__file__).resolve().parent.parent / "www"

ICONOS = '''  // Íconos chiquitos de los menús (los mismos del boceto)
  const ICONO = {
    fijar: '<svg viewBox="0 0 16 16"><path d="M8 1.5l2 4.2 4.5.6-3.3 3.1.8 4.5L8 11.7l-4 2.2.8-4.5L1.5 6.3 6 5.7z" fill="#F2C230" stroke="#B8862A" stroke-width="1"/></svg>',
    carpeta: '<svg viewBox="0 0 16 16"><path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5.5v6A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" fill="#F2994A" stroke="#1B2A4E" stroke-width="1"/></svg>',
    nueva: '<svg viewBox="0 0 16 16"><path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5.5v6A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" fill="#F2994A" stroke="#1B2A4E" stroke-width="1"/><path d="M8 6.5v4M6 8.5h4" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/></svg>',
    qr: '<svg viewBox="0 0 16 16" fill="none" stroke="#1B2A4E" stroke-width="1.4"><rect x="2" y="2" width="4.5" height="4.5"/><rect x="9.5" y="2" width="4.5" height="4.5"/><rect x="2" y="9.5" width="4.5" height="4.5"/><path d="M10 10h1.5v1.5H10zM12.5 12.5H14V14h-1.5z" fill="#1B2A4E" stroke="none"/></svg>',
    compartir: '<svg viewBox="0 0 16 16" fill="none" stroke="#1B2A4E" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="3.5" r="1.8"/><circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="12.5" r="1.8"/><path d="M5.6 7.1l4.8-2.7M5.6 8.9l4.8 2.7"/></svg>',
    colaborar: '<svg viewBox="0 0 16 16" fill="none" stroke="#1B2A4E" stroke-width="1.4"><circle cx="5.5" cy="5" r="2.3"/><circle cx="11" cy="5" r="2.3"/><path d="M1.5 13.5c0-3.2 8-3.2 8 0M7.5 13.5c0-3 7-3 7 0"/></svg>',
    borrar: '<svg viewBox="0 0 16 16" fill="none" stroke="#B3402F" stroke-width="1.4" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.8 9.5h6.4L12 4"/></svg>',
  };
  const conIcono = (nombre, texto) => `<span class="no-icono" aria-hidden="true">${ICONO[nombre]}</span>${texto}`;

  const LUPA ='''

CAMBIOS = {
    "funciones/notas.js": [
        # 1. Los íconos de los menús
        ("  const LUPA =", ICONOS),
        ('<button data-accion="carpeta-nueva">Nueva carpeta</button>',
         '<button data-accion="carpeta-nueva">${conIcono("nueva", "Nueva carpeta")}</button>'),
        ('<button data-accion="fijar">${nota && nota.fijada ? "Desfijar" : "Fijar arriba"}</button>',
         '<button data-accion="fijar">${conIcono("fijar", nota && nota.fijada ? "Desfijar" : "Fijar arriba")}</button>'),
        ('<button data-accion="carpeta">Mover a carpeta</button>',
         '<button data-accion="carpeta">${conIcono("carpeta", "Mover a carpeta")}</button>'),
        ('<button data-accion="qr">Llevar al celu (QR)</button>',
         '<button data-accion="qr">${conIcono("qr", "Llevar al celu (QR)")}</button>'),
        ('<button data-accion="compartir">Compartir como texto</button>',
         '<button data-accion="compartir">${conIcono("compartir", "Compartir como texto")}</button>'),
        ('<button data-accion="colaborar">Colaborar con un código</button>',
         '<button data-accion="colaborar">${conIcono("colaborar", "Colaborar con un código")}</button>'),
        ('<button data-accion="borrar" class="no-peligro">Borrar nota</button>',
         '<button data-accion="borrar" class="no-peligro">${conIcono("borrar", "Borrar nota")}</button>'),
        ("""contenedor.querySelector('[data-accion="fijar"]').textContent = nota.fijada ? "Desfijar" : "Fijar arriba";""",
         """contenedor.querySelector('[data-accion="fijar"]').innerHTML = conIcono("fijar", nota.fijada ? "Desfijar" : "Fijar arriba");"""),
        # 2. Recordar lo seleccionado y recuperarlo antes de aplicar el formato
        ("  let ultimaBorrada = null;\n", """  let ultimaBorrada = null;
  let rangoGuardado = null;    // lo último que seleccionaste dentro de la nota

  // Recuerda lo que seleccionaste en la nota. Al tocar un botón de formato, el celular
  // suele "soltar" la selección; con esto la recuperamos antes de aplicar el formato.
  document.addEventListener("selectionchange", () => {
    const texto = document.getElementById("no-texto");
    const seleccion = window.getSelection();
    if (!texto || !seleccion.rangeCount) return;
    const rango = seleccion.getRangeAt(0);
    if (texto.contains(rango.commonAncestorContainer)) rangoGuardado = rango.cloneRange();
  });
"""),
        ("""    const texto = document.getElementById("no-texto");
    texto.focus();
    document.execCommand(cmd, false, valor);""",
         """    const texto = document.getElementById("no-texto");
    const rango = rangoGuardado;               // se copia antes, porque focus() lo puede cambiar
    texto.focus();
    if (rango && texto.contains(rango.commonAncestorContainer)) {
      const seleccion = window.getSelection();
      seleccion.removeAllRanges();
      seleccion.addRange(rango);
    }
    document.execCommand(cmd, false, valor);"""),
        ('["no-herramientas", "no-paleta"].forEach(',
         '["no-herramientas", "no-paleta", "no-aa"].forEach('),
        ("""    alineacion = 0;
    contenedor.innerHTML""", """    alineacion = 0;
    rangoGuardado = null;
    contenedor.innerHTML"""),
    ],
    "funciones/notas.css": [
        (".no-menu button.no-peligro { color: #B3402F; }",
         ".no-menu button.no-peligro { color: #B3402F; }\n"
         ".no-menu button { display: flex; align-items: center; gap: 2.2cqw; }\n"
         ".no-icono { flex: none; display: flex; width: 4.2cqw; height: 4.2cqw; }\n"
         ".no-icono svg { width: 100%; height: 100%; }"),
    ],
    "funciones/arrastre.js": [
        ("movido: false };", "movido: false, momento: Date.now() };"),
        ("if (!inicio.movido && Math.hypot(dx, dy) < 6) return;",
         "if (!inicio.movido && Date.now() - inicio.momento > 350) { inicio = null; return; }   // dedo quieto: está seleccionando\n"
         "    if (!inicio.movido && Math.hypot(dx, dy) < 6) return;"),
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
