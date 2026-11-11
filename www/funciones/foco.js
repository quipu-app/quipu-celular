// Foco en el celular: el temporizador para concentrarte, igual que en la compu.
// Sigue contando aunque cierres la app, y al terminar te avisa con una notificación.

window.MODULOS = window.MODULOS || {};

// --- Las tres luces de la consola (roja, amarilla, verde). Las puede usar cualquier función. ---
window.ponerLuces = (function () {
  const POSICIONES = [62.9, 71.9, 81.0];          // dónde están dibujadas, en % del ancho
  const COLORES = ["#FF5A4F", "#FFD23F", "#7CFF5A"];
  let luces = null;
  return function (estados) {
    if (!luces) {
      const aparato = document.getElementById("aparato");
      luces = POSICIONES.map((x, i) => {
        const luz = document.createElement("div");
        luz.className = "luz";
        luz.style.left = x + "%";
        luz.style.setProperty("--color-luz", COLORES[i]);
        aparato.appendChild(luz);
        return luz;
      });
    }
    luces.forEach((luz, i) => luz.classList.toggle("prendida", Boolean(estados && estados[i])));
  };
})();

(function () {
  const CLAVE = "quipu.foco";
  const MINUTOS = [15, 25, 45];
  const AVISO_FALTA = 0.25;                 // avisa cuando falta un cuarto del tiempo
  const ID_NOTIFICACION = 1001;
  const sonido = new Audio("assets/sonidos/chiflido.wav");

  // El estado se guarda con la hora real de finalización, así sigue aunque cierres la app.
  let estado = { duracion: 25 * 60, estado: "listo", restante: 25 * 60, fin: null, terminadoEn: null, avisoDado: false };
  let contenedor = null;

  function cargar() {
    try {
      const guardado = JSON.parse(localStorage.getItem(CLAVE));
      if (guardado) estado = { ...estado, ...guardado };
    } catch (error) { /* si falla, arranca de cero */ }
  }
  const guardar = () => localStorage.setItem(CLAVE, JSON.stringify(estado));
  const ahora = () => Date.now() / 1000;

  function restante() {
    if (estado.estado === "corriendo") return Math.max(0, estado.fin - ahora());
    return estado.restante;
  }

  function mmss(segundos) {
    const s = Math.ceil(segundos);          // nunca muestra 00:00 antes de tiempo
    return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
  }

  // --- El personaje: un gesto (si lo tiene) y una frase de foco ---
  function reaccionar(gesto, clave) {
    if (!datos) return;
    if (!ocupado && hoja.cuadros[gesto] !== undefined) {
      ocupado = true;
      mostrar(gesto);
      setTimeout(() => { mostrar("mira_frente"); ocupado = false; }, 1800);
    }
    const frase = datos.frases[clave];
    if (frase) decir(frase);
  }

  // --- Notificación para cuando termina (aunque estés en otra app) ---
  const Notificaciones = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;

  async function programarAviso() {
    const N = Notificaciones();
    if (!N) return;
    try {
      const permiso = await N.requestPermissions();
      if (permiso.display !== "granted") return;
      const frase = (datos && datos.frases.foco_fin) || "¡Terminó tu foco!";
      await N.schedule({ notifications: [{
        id: ID_NOTIFICACION,
        title: "Quipu · Foco",
        body: datos ? `${datos.nombre.split(" ")[0]}: ${frase}` : frase,
        schedule: { at: new Date(estado.fin * 1000), allowWhileIdle: true },
      }] });
    } catch (error) { /* sin notificación, el foco funciona igual */ }
  }

  function cancelarAviso() {
    const N = Notificaciones();
    if (N) N.cancel({ notifications: [{ id: ID_NOTIFICACION }] }).catch(() => {});
  }

  // --- Las acciones ---
  function elegir(minutos) {
    if (estado.estado !== "listo" && estado.estado !== "terminado") return;
    estado.duracion = minutos * 60;
    reiniciar();
  }

  function principal() {
    const antes = estado.estado;
    if (antes === "corriendo") {                       // pausar
      estado.restante = restante();
      estado.estado = "pausa";
      cancelarAviso();
    } else {                                            // iniciar o seguir
      if (antes === "terminado") estado.restante = estado.duracion;
      estado.fin = ahora() + estado.restante;
      estado.estado = "corriendo";
      if (antes === "pausa") {
        reaccionar("sonrie", "foco_seguimos");
      } else {
        estado.avisoDado = false;
        reaccionar("senala", "foco_inicio");
        sonido.play().catch(() => {});
      }
      programarAviso();
    }
    guardar();
    refrescar();
  }

  function reiniciar() {
    estado.restante = estado.duracion;
    estado.fin = null;
    estado.estado = "listo";
    cancelarAviso();
    guardar();
    refrescar();
  }

  // --- El reloj: corre siempre, aunque Foco no esté abierto ---
  function tic() {
    if (estado.estado === "corriendo") {
      const falta = restante();
      if (!estado.avisoDado && falta <= estado.duracion * AVISO_FALTA) {
        estado.avisoDado = true;
        guardar();
        reaccionar("sonrie", "foco_falta_poco");
      }
      if (falta <= 0) {
        estado.estado = "terminado";
        estado.restante = 0;
        estado.terminadoEn = ahora();
        guardar();
        reaccionar("festeja", "foco_fin");
        sonido.play().catch(() => {});
      }
    }
    actualizarLuces();
    if (contenedor) refrescar();
  }

  // Lenguaje de luces: verde corriendo (amarilla titila cuando falta poco), amarilla en pausa,
  // y al terminar corren de una a otra para festejar.
  function actualizarLuces() {
    const t = ahora();
    if (estado.estado === "corriendo") {
      const faltaPoco = restante() <= estado.duracion * AVISO_FALTA;
      ponerLuces([false, faltaPoco && Math.floor(t * 2) % 2 === 0, true]);
    } else if (estado.estado === "pausa") {
      ponerLuces([false, true, false]);
    } else if (estado.estado === "terminado" && t - estado.terminadoEn < 8) {
      ponerLuces([0, 1, 2].map((i) => Math.floor(t * 6) % 3 === i));
    } else {
      ponerLuces(null);
    }
  }

  // Lo que muestra la pantallita mientras hay un foco en marcha (la usa la consola).
  window.textoPantallita = function () {
    if (estado.estado === "corriendo" || estado.estado === "pausa") return mmss(restante());
    if (estado.estado === "terminado" && ahora() - estado.terminadoEn < 8) return "¡Listo!";
    return null;
  };

  // --- Lo que se ve en la pantalla grande ---
  function dibujar() {
    contenedor.innerHTML = `
      <div class="fo-raiz">
        <div class="fo-minutos">
          ${MINUTOS.map((m) => `<button class="tf-boton secundario" data-min="${m}">${m} min</button>`).join("")}
        </div>
        <div class="fo-tiempo" id="fo-tiempo"></div>
        <div class="fo-barra"><span id="fo-progreso"></span></div>
        <div class="fo-controles">
          <button class="tf-boton fo-principal" id="fo-principal"></button>
          <button class="tf-boton secundario" id="fo-reiniciar">Reiniciar</button>
        </div>
      </div>`;
    contenedor.querySelectorAll("[data-min]").forEach((b) => { b.onclick = () => elegir(Number(b.dataset.min)); });
    document.getElementById("fo-principal").onclick = principal;
    document.getElementById("fo-reiniciar").onclick = reiniciar;
    refrescar();
  }

  function refrescar() {
    if (!contenedor || !document.getElementById("fo-tiempo")) return;
    const falta = restante();
    document.getElementById("fo-tiempo").textContent = mmss(falta);
    document.getElementById("fo-progreso").style.width = `${100 * (1 - falta / estado.duracion)}%`;
    document.getElementById("fo-principal").textContent =
      { listo: "Iniciar", corriendo: "Pausar", pausa: "Seguir", terminado: "Otra vez" }[estado.estado];
    const libre = estado.estado === "listo" || estado.estado === "terminado";
    contenedor.querySelectorAll("[data-min]").forEach((b) => {
      b.classList.toggle("activa", Number(b.dataset.min) * 60 === estado.duracion);
      b.disabled = !libre;
    });
  }

  cargar();
  setInterval(tic, 250);

  MODULOS.foco = {
    abrir(lugar) {
      contenedor = lugar;
      dibujar();
      if (estado.estado === "listo") setTimeout(() => decir("¿Cuánto tiempo nos concentramos?"), 500);
    },
    cerrar() {
      contenedor = null;
    },
  };
})();
