"""Ajustes: el cambio de personaje con el ritual (escaneo, lluvia de código y píxeles), sin cerrar la tapa."""
from pathlib import Path

WWW = Path(__file__).resolve().parent.parent / "www"

ELEGIR_VIEJO = '''  // --- El cambio de personaje: "Creando…", el semáforo y la app vuelve a arrancar ---
  function elegir(id) {
    if (id === actual) return;
    decir((datos && datos.frases.ajustes_relevo) || "¡Ahí llega quien te acompaña!");
    setTimeout(() => anunciar("Creando…"), 1500);
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]].forEach((luces, i) => {
      setTimeout(() => ponerLuces(luces, "ajustes"), 1500 + i * 500);
    });
    setTimeout(() => {
      localStorage.setItem("quipu.personaje", id);
      location.reload();
    }, 3300);
  }'''

ELEGIR_NUEVO = '''  // --- El cambio de personaje: el ritual, sin cerrar la tapa ni reiniciar la app ---
  // 1. Escaneo del personaje actual. 2. Lluvia de código: "Creando…". 3. El nuevo aparece de a píxeles.
  let enRitual = false;
  const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
  const COLOR_PANTALLA = "#C2E6F2";

  function cargarImagen(ruta) {
    return new Promise((listo) => {
      const imagen = new Image();
      imagen.onload = imagen.onerror = () => listo();
      imagen.src = ruta;
    });
  }

  // Cambia el personaje "en vivo": sus datos, sus dibujos, su consola y sus colores.
  async function cambiarPersonaje(c) {
    const carpeta = `assets/personajes/${c.id}/`;
    await Promise.all([cargarImagen(carpeta + c.hojas.medio.sprite), cargarImagen(carpeta + "celular/abierta.png")]);
    localStorage.setItem("quipu.personaje", c.id);
    datos = c;
    hoja = c.hojas.medio;
    document.documentElement.style.setProperty("--color-consola", c.consola);
    [figura, mini].forEach((el) => { el.style.backgroundImage = `url(${carpeta}${hoja.sprite})`; });
    document.getElementById("imagen-abierta").src = carpeta + "celular/abierta.png";
    document.getElementById("imagen-cerrada").src = carpeta + "celular/cerrada.png";
    acomodar();
    mostrar("mira_frente");
    actual = c.id;
  }

  function lluviaDeCodigo() {
    const signos = "01QUIPU<>{}[]=+*#";
    return Array.from({ length: 16 }, (_, i) => {
      const texto = Array.from({ length: 14 }, () => signos[Math.floor(Math.random() * signos.length)]).join("<br>");
      const duracion = (0.8 + Math.random() * 0.9).toFixed(2);
      const demora = (Math.random() * 0.8).toFixed(2);
      return `<div class="ritual-columna" style="left:${i * 6.25}%; animation-duration:${duracion}s; animation-delay:${demora}s">${texto}</div>`;
    }).join("");
  }

  function pixeles() {
    return Array.from({ length: 12 * 8 }, () =>
      `<i style="background:${COLOR_PANTALLA}; animation-delay:${(Math.random() * 1.2).toFixed(2)}s"></i>`).join("");
  }

  async function elegir(id) {
    if (id === actual || enRitual) return;
    enRitual = true;
    const nuevo = cartas.find((c) => c.id === id);
    decir((datos && datos.frases.ajustes_relevo) || "¡Ahí llega quien te acompaña!");
    await esperar(2000);

    volverAlInicio();                                  // el personaje vuelve a la pantalla grande
    const capa = document.createElement("div");
    capa.className = "ritual";
    document.getElementById("pantalla").appendChild(capa);
    let paso = 0;
    const semaforo = setInterval(() => {               // el semáforo: procesando
      ponerLuces([paso % 3 === 0, paso % 3 === 1, paso % 3 === 2], "ajustes");
      paso++;
    }, 400);

    // 1. Escaneo
    anunciar("Escaneando…");
    capa.innerHTML = '<div class="ritual-escaner"></div>';
    await esperar(1900);

    // 2. Lluvia de código: el personaje se va y se arma el nuevo
    anunciar("Creando…");
    figura.style.opacity = "0";
    capa.innerHTML = lluviaDeCodigo();
    await Promise.all([cambiarPersonaje(nuevo), esperar(1900)]);

    // 3. El nuevo aparece de a píxeles
    capa.innerHTML = `<div class="ritual-pixeles">${pixeles()}</div>`;
    figura.style.opacity = "1";
    await esperar(1500);

    capa.remove();
    clearInterval(semaforo);
    ponerLuces([false, false, true], "ajustes");
    setTimeout(() => ponerLuces(null, "ajustes"), 1200);
    anunciar("¡Listo!");
    hacer("saluda");
    enRitual = false;
  }'''

CSS_RITUAL = '''
/* El ritual de cambio de personaje, dentro de la pantalla grande */
.ritual {
  position: absolute;
  inset: 0;
  z-index: 4;
  overflow: hidden;
  border-radius: inherit;
  pointer-events: none;
}
.ritual-escaner {
  position: absolute;
  left: 0;
  right: 0;
  height: 3cqw;
  background: linear-gradient(transparent, rgba(60, 255, 170, 0.85), transparent);
  box-shadow: 0 0 4cqw 1cqw rgba(60, 255, 170, 0.5);
  animation: escanear 0.9s linear 2;
}
@keyframes escanear { from { top: -5%; } to { top: 100%; } }

.ritual-columna {
  position: absolute;
  top: 0;
  width: 6.25%;
  text-align: center;
  font-family: "Consolas", monospace;
  font-size: 3cqw;
  line-height: 1.1;
  color: #1FB86A;
  text-shadow: 0 0 1.5cqw rgba(31, 184, 106, 0.8);
  transform: translateY(-110%);
  animation-name: caer;
  animation-timing-function: linear;
  animation-iteration-count: infinite;
}
@keyframes caer { from { transform: translateY(-110%); } to { transform: translateY(110%); } }

.ritual-pixeles {
  position: absolute;
  inset: 0;
  display: grid;
  grid-template-columns: repeat(12, 1fr);
  grid-template-rows: repeat(8, 1fr);
}
.ritual-pixeles i { animation: desaparecer 0.18s forwards; }
@keyframes desaparecer { to { opacity: 0; } }
#personaje { transition: opacity 0.3s; }
'''

CAMBIOS = {
    "funciones/ajustes.js": [
        ('  const actual = localStorage.getItem("quipu.personaje") || "moreira";',
         '  let actual = localStorage.getItem("quipu.personaje") || "moreira";'),
        (ELEGIR_VIEJO, ELEGIR_NUEVO),
    ],
    "funciones/ajustes.css": [
        (".aj-ayuda { font-size: 3cqw; opacity: 0.75; }", ".aj-ayuda { font-size: 3cqw; opacity: 0.75; }\n" + CSS_RITUAL),
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
