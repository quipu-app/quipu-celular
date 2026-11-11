// La consola de Quipu en el celular: abrir y cerrar, las teclas, las funciones y la pantallita.

const aparato = document.getElementById("aparato");
const cartel = document.getElementById("cartel");
const cartelTexto = document.getElementById("cartel-texto");
const funcionTitulo = document.getElementById("funcion-titulo");

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
  const funcion = FUNCIONES[nombre];
  funcionActual = nombre;
  funcionTitulo.textContent = funcion.titulo;
  aparato.dataset.modo = "funcion";    // el personaje salta a la pantallita
  setTimeout(() => {
    const frase = funcion.frase && datos && datos.frases[funcion.frase];
    decir(frase || funcion.titulo);
  }, 500);
}

function volverAlInicio() {
  funcionActual = null;
  aparato.dataset.modo = "inicio";     // el personaje vuelve a la pantalla grande
  terminarAviso();
}

// --- La pantallita: la hora, las frases y los avisos ---

// Muestra un texto en el cartel. Si no entra, lo hace correr como cartel luminoso.
// Devuelve cuánto tiempo (en milisegundos) va a estar a la vista.
function anunciar(texto) {
  mostrandoAviso = true;
  cartelTexto.className = "retro";
  cartelTexto.textContent = texto;

  let duracion = 2800;
  const anchoCartel = cartel.clientWidth;
  const anchoTexto = cartelTexto.scrollWidth;
  if (anchoTexto > anchoCartel) {
    const recorrido = anchoCartel + anchoTexto;
    duracion = (recorrido / 70) * 1000;              // 70 píxeles por segundo
    cartelTexto.style.setProperty("--desde", `${anchoCartel}px`);
    cartelTexto.style.setProperty("--hasta", `${-anchoTexto}px`);
    cartelTexto.style.setProperty("--duracion", `${duracion}ms`);
    void cartelTexto.offsetWidth;                    // reinicia la animación
    cartelTexto.classList.add("corre");
  }

  clearTimeout(anunciar.reloj);
  anunciar.reloj = setTimeout(terminarAviso, duracion + 300);
  return duracion;
}

function terminarAviso() {
  clearTimeout(anunciar.reloj);
  mostrandoAviso = false;
  cartelTexto.className = "";
  actualizarHora();
}

function actualizarHora() {
  if (mostrandoAviso) return;
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
document.querySelectorAll(".tecla").forEach((tecla) => {
  tecla.addEventListener("click", () => abrirFuncion(tecla.dataset.funcion));
});

actualizarHora();
setInterval(actualizarHora, 10000);
