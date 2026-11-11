// La consola de Quipu en el celular: abrir y cerrar, las teclas, las funciones y la pantallita.

const aparato = document.getElementById("aparato");
const cartel = document.getElementById("cartel");
const cartelTexto = document.getElementById("cartel-texto");
const funcionTitulo = document.getElementById("funcion-titulo");
const contenido = document.getElementById("funcion-contenido");
const botonOpciones = document.getElementById("funcion-opciones");

// Cada tecla: su nombre y, si el personaje tiene, la frase con la que la presenta.
const FUNCIONES = {
  foco:    { titulo: "Foco",    frase: "foco_inicio" },
  notas:   { titulo: "Notas" },
  agenda:  { titulo: "Agenda",  frase: "agenda_hola" },
  tiempo:  { titulo: "Tiempo" },
  sonidos: { titulo: "Sonidos", frase: "sonidos_hola" },
  ajustes: { titulo: "Ajustes", frase: "ajustes_hola" },
};

let funcionActual = null;     // qué función está abierta (null = inicio)
let mostrandoAviso = false;   // true mientras el cartel muestra una frase o aviso

// --- El tamaño de la consola: se calcula una vez y no cambia al abrir el teclado ---

function medirAparato() {
  if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.isContentEditable)) return;
  const ancho = Math.min(window.innerWidth * 0.96, window.innerHeight * 0.94 * 1408 / 3040);
  aparato.style.width = ancho + "px";
}

// --- Abrir y cerrar la consola ---

function abrir() {
  aparato.classList.replace("cerrado", "abierto");
  setTimeout(() => hacer("saluda"), 500);
}

function cerrarQuipu() {
  volverAlInicio();
  aparato.classList.replace("abierto", "cerrado");
}

// --- Las funciones ---

function abrirFuncion(nombre) {
  if (funcionActual === nombre) {      // tocar la misma tecla otra vez: volver
    volverAlInicio();
    return;
  }
  if (funcionActual) cerrarModulo();
  const funcion = FUNCIONES[nombre];
  const modulo = window.MODULOS && MODULOS[nombre];
  funcionActual = nombre;
  funcionTitulo.textContent = funcion.titulo;
  botonOpciones.hidden = !(modulo && modulo.opciones);
  contenido.innerHTML = "";
  aparato.dataset.modo = "funcion";    // el personaje salta a la pantallita

  if (modulo) {
    modulo.abrir(contenido);           // la función se dibuja y presenta sola
  } else {
    contenido.innerHTML = '<p class="tf-mensaje">Muy pronto vas a poder usar esta función acá.</p>';
    setTimeout(() => {
      const frase = funcion.frase && datos && datos.frases[funcion.frase];
      decir(frase || funcion.titulo);
    }, 500);
  }
}

function cerrarModulo() {
  const modulo = window.MODULOS && MODULOS[funcionActual];
  if (modulo && modulo.cerrar) modulo.cerrar();
}

function volverAlInicio() {
  if (funcionActual) cerrarModulo();
  funcionActual = null;
  aparato.dataset.modo = "inicio";     // el personaje vuelve a la pantalla grande
  terminarAviso();
}

// --- La pantallita: la hora, las frases y los avisos ---

// Los mensajes se muestran de a uno, en fila. Si un mensaje no entra, primero se queda quieto
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

function actualizarHora() {
  if (mostrandoAviso) return; const propio = window.textoPantallita && window.textoPantallita(); if (propio) { cartelTexto.textContent = propio; return; }
  const ahora = new Date();
  cartelTexto.textContent = ahora.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
}

// --- Conexiones ---

document.getElementById("tapa").addEventListener("click", abrir);
document.getElementById("cerrar").addEventListener("click", cerrarQuipu);
document.getElementById("volver").addEventListener("click", volverAlInicio);
botonOpciones.addEventListener("click", () => {
  const modulo = window.MODULOS && MODULOS[funcionActual];
  if (modulo && modulo.opciones) modulo.opciones();
});
document.querySelectorAll(".tecla").forEach((tecla) => {
  tecla.addEventListener("click", () => abrirFuncion(tecla.dataset.funcion));
});

// Con el teclado abierto, la consola se pega arriba, así la pantalla grande queda a la vista.
document.addEventListener("focusin", (e) => {
  if ((e.target.tagName === "INPUT" || e.target.isContentEditable)) document.body.classList.add("escribiendo");
});
document.addEventListener("focusout", () => document.body.classList.remove("escribiendo"));
window.addEventListener("resize", medirAparato);

medirAparato();
actualizarHora();
setInterval(actualizarHora, 1000);


