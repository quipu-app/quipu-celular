// El personaje de Quipu en el celular: grande en la pantalla grande o chiquito en la pantallita.

const PERSONAJE = localStorage.getItem("quipu.personaje") || "moreira";
const CARPETA = `assets/personajes/${PERSONAJE}/`;

const figura = document.getElementById("personaje");    // el grande
const mini = document.getElementById("mini");           // el chiquito
const pantalla = document.getElementById("pantalla");
const pantallita = document.getElementById("pantallita");
const globo = document.getElementById("globo");
const lente = document.getElementById("lente");
let datos = null;          // todo el datos.json del personaje
let hoja = null;           // la hoja de animación que usamos ("medio")
let ocupado = false;       // true mientras hace una acción, para no pisarla
let cuadroActual = "mira_frente";

// Las imágenes de la consola de este personaje
document.getElementById("imagen-abierta").src = `assets/consola-celular/abierta.webp`;
document.getElementById("imagen-cerrada").src = `assets/consola-celular/cerrada.webp`;

async function cargarPersonaje() {
  const respuesta = await fetch(CARPETA + "datos.json");
  datos = await respuesta.json();
  hoja = datos.hojas.medio;

  document.documentElement.style.setProperty("--color-consola", datos.consola);
  for (const el of [figura, mini]) {
    el.style.backgroundImage = `url(${CARPETA}${hoja.sprite})`;
    el.addEventListener("click", alTocar);
  }

  acomodar();
  mostrar("mira_frente");
  parpadear();
  programarAccionSola();
  window.addEventListener("resize", acomodar);
}

// Le da tamaño a una figura para que entre en el espacio indicado, sin deformarse.
function medir(el, maxAncho, maxAlto) {
  const g = hoja.grilla;
  let alto = maxAlto;
  let ancho = alto * g.cuadro_ancho / g.cuadro_alto;
  if (ancho > maxAncho) {
    ancho = maxAncho;
    alto = ancho * g.cuadro_alto / g.cuadro_ancho;
  }
  el.style.width = ancho + "px";
  el.style.height = alto + "px";
  el.style.backgroundSize = `${ancho * g.columnas}px auto`;
}

// Calcula los dos tamaños: el grande (pantalla grande) y el chiquito (pantallita).
function acomodar() {
  medir(figura, pantalla.clientWidth * 0.9, pantalla.clientHeight * 0.78);
  const altoPantallita = pantallita.clientHeight;
  medir(mini, altoPantallita * 1.2, altoPantallita * 0.92);
  mostrar(cuadroActual);
}

// Muestra un cuadro de la hoja en las dos figuras, buscándolo por su nombre en datos.json.
function mostrar(nombreCuadro) {
  const indice = hoja.cuadros[nombreCuadro];
  if (indice === undefined) return;
  const g = hoja.grilla;
  const columna = indice % g.columnas;
  const fila = Math.floor(indice / g.columnas);
  for (const el of [figura, mini]) {
    const ancho = parseFloat(el.style.width);
    const alto = parseFloat(el.style.height);
    el.style.backgroundPosition = `${-columna * ancho}px ${-fila * alto}px`;
  }
  cuadroActual = nombreCuadro;
}

// El personaje habla: en el inicio, con el globo; con una función abierta, en el cartel de la pantallita.
// La lente queda encendida mientras habla.
function decir(texto) {
  let duracion = 2800;
  if (aparato.dataset.modo === "funcion") {
    duracion = anunciar(texto);
  } else {
    globo.textContent = texto;
    globo.classList.add("visible");
  }
  lente.classList.add("encendida");
  clearTimeout(decir.reloj);
  decir.reloj = setTimeout(() => {
    globo.classList.remove("visible");
    lente.classList.remove("encendida");
  }, duracion);
}

// Hace una acción (saludar, festejar...) con su frase, y vuelve a mirar al frente.
function hacer(accion) {
  if (ocupado || !datos) return;
  ocupado = true;
  mostrar(accion);
  const frase = datos.frases[accion];
  if (frase) decir(frase);
  setTimeout(() => {
    mostrar("mira_frente");
    ocupado = false;
  }, 1800);
}

function alAzar(lista) {
  return lista[Math.floor(Math.random() * lista.length)];
}

function alTocar() {
  hacer(alAzar(hoja.acciones_al_tocar));
}

// Parpadea cada tantos segundos, a intervalos al azar para que se vea natural.
function parpadear() {
  setTimeout(() => {
    if (!ocupado) {
      mostrar("parpadeo");
      setTimeout(() => { if (!ocupado) mostrar("mira_frente"); }, 150);
    }
    parpadear();
  }, 2500 + Math.random() * 3500);
}

// De vez en cuando hace algo por su cuenta (tomar mate, bostezar...).
function programarAccionSola() {
  setTimeout(() => {
    hacer(alAzar(hoja.acciones_solo));
    programarAccionSola();
  }, 15000 + Math.random() * 10000);
}

cargarPersonaje();


