// Sonidos en el celular: los ambientes de la compu, varios a la vez, en loop,
// con volumen propio, volumen general, fundidos suaves y temporizador para apagarse.

window.MODULOS = window.MODULOS || {};

(function () {
  const CLAVE = "quipu.sonidos";
  const SONIDOS = { lluvia: "Lluvia", rio: "Río", fogon: "Fogón", viento: "Viento", campo: "Campo" };
  const NIVELES = 10;                       // cada volumen va de 0 a 10
  const MINUTOS = [15, 30, 60];

  // Los mismos íconos de la compu
  const ICONOS = {
    lluvia: '<path d="M9 22h22a6 6 0 0 0 0-12 9 9 0 0 0-17-1 6.5 6.5 0 0 0-5 13z" fill="#DDE6EE" stroke="#5E7B92" stroke-width="2"/><g stroke="#3FA9F5" stroke-width="3" stroke-linecap="round"><path d="M13 27l-2 6M21 27l-2 6M29 27l-2 6"/></g>',
    rio: '<g fill="none" stroke="#2F80ED" stroke-width="3" stroke-linecap="round"><path d="M4 14q6-5 12 0t12 0 8-2"/><path d="M4 22q6-5 12 0t12 0 8-2"/><path d="M4 30q6-5 12 0t12 0 8-2"/></g>',
    fogon: '<path d="M20 4c3 7 10 10 10 19a10 10 0 0 1-20 0c0-5 3-8 5-10 0 4 2 6 4 6-2-6 0-11 1-15z" fill="#F2994A" stroke="#B85A1A" stroke-width="2" stroke-linejoin="round"/><path d="M10 36h20" stroke="#7A4B2A" stroke-width="3" stroke-linecap="round"/>',
    viento: '<g fill="none" stroke="#5E7B92" stroke-width="3" stroke-linecap="round"><path d="M4 14h20a5 5 0 1 0-5-5"/><path d="M4 22h28a5 5 0 1 1-5 5"/><path d="M4 30h12"/></g>',
    campo: '<path d="M8 30q12-2 18-14l8-2-6 6q-4 10-20 10z" fill="#E5A23A" stroke="#8A5A1A" stroke-width="2" stroke-linejoin="round"/><circle cx="27" cy="18" r="1.6" fill="#2B2B33"/><path d="M4 36h32" stroke="#4E8F2E" stroke-width="3" stroke-linecap="round"/>',
  };

  let niveles = Object.fromEntries(Object.keys(SONIDOS).map((c) => [c, 6]));
  let general = 7;
  const encendidos = new Set();
  let fin = null;                 // cuándo se apagan solos (temporizador), o null
  let volumenVisible = null;      // { nivel, hasta } para mostrar "VOL ▮▮▮" en la pantallita
  let contenedor = null;

  // --- Guardar y leer los volúmenes ---
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE));
    if (guardado) { niveles = { ...niveles, ...guardado.niveles }; general = guardado.general ?? general; }
  } catch (error) { /* arranca con los volúmenes de siempre */ }
  const guardar = () => localStorage.setItem(CLAVE, JSON.stringify({ niveles, general }));

  // --- El audio: un canal por sonido, en loop sin cortes, con fundidos ---
  let audio = null;
  const canales = {};
  const memorias = {};

  function prepararAudio() {
    if (audio) return;
    audio = new (window.AudioContext || window.webkitAudioContext)();
    Object.keys(SONIDOS).forEach((c) => {
      const volumen = audio.createGain();
      volumen.gain.value = 0;
      volumen.connect(audio.destination);
      canales[c] = { volumen, fuente: null };
    });
  }

  async function cargarSonido(clave) {
    if (!memorias[clave]) {
      const respuesta = await fetch(`assets/sonidos/ambiente/${clave}.wav`);
      memorias[clave] = await audio.decodeAudioData(await respuesta.arrayBuffer());
    }
    return memorias[clave];
  }

  // El volumen real crece "en curva", como en la compu: así los niveles bajos se notan más suaves.
  const objetivo = (clave) => encendidos.has(clave) ? (niveles[clave] / NIVELES) ** 2 * (general / NIVELES) ** 2 : 0;

  function aplicar(clave, segundos = 1.5) {
    if (!audio) return;
    const g = canales[clave].volumen.gain;
    const t = audio.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(objetivo(clave), t + segundos);
  }

  function detenerDespues(clave, segundos) {
    const fuente = canales[clave].fuente;
    setTimeout(() => {
      if (!encendidos.has(clave) && fuente && canales[clave].fuente === fuente) {
        try { fuente.stop(); } catch (error) { /* ya estaba parado */ }
        canales[clave].fuente = null;
      }
    }, segundos * 1000 + 200);
  }

  const texto = () => encendidos.size ? "♪ " + Object.keys(SONIDOS).filter((c) => encendidos.has(c)).map((c) => SONIDOS[c]).join(" + ") : "";

  // --- El personaje ---
  function reaccionar(gesto, clave) {
    if (!datos) return;
    if (!ocupado && hoja.cuadros[gesto] !== undefined) {
      ocupado = true;
      mostrar(gesto);
      setTimeout(() => { mostrar("mira_frente"); ocupado = false; }, 1800);
    }
    if (datos.frases[clave]) decir(datos.frases[clave]);
  }

  // --- Las acciones ---
  async function alternar(clave) {
    prepararAudio();
    await audio.resume();
    if (encendidos.has(clave)) {
      encendidos.delete(clave);
      aplicar(clave);
      detenerDespues(clave, 1.5);
    } else {
      encendidos.add(clave);
      if (!canales[clave].fuente) {
        const fuente = audio.createBufferSource();
        fuente.buffer = await cargarSonido(clave);
        fuente.loop = true;
        fuente.connect(canales[clave].volumen);
        fuente.start();
        canales[clave].fuente = fuente;
      }
      aplicar(clave);
      reaccionar("disfruta", "sonidos_disfruta");
    }
    if (!encendidos.size) fin = null;
    if (encendidos.size) setTimeout(() => anunciar(texto()), 2900);
    dibujar();
  }

  function cambiarNivel(clave, paso) {
    niveles[clave] = Math.max(0, Math.min(NIVELES, niveles[clave] + paso));
    aplicar(clave, 0.3);
    mostrarVolumen(niveles[clave]);
    guardar();
    dibujar();
  }

  function cambiarGeneral(paso) {
    general = Math.max(0, Math.min(NIVELES, general + paso));
    Object.keys(SONIDOS).forEach((c) => aplicar(c, 0.3));
    mostrarVolumen(general);
    guardar();
    dibujar();
  }

  function apagarTodo(segundos = 1.5) {
    [...encendidos].forEach((c) => {
      encendidos.delete(c);
      aplicar(c, segundos);
      detenerDespues(c, segundos);
    });
    fin = null;
    dibujar();
  }

  function temporizador(minutos) {
    fin = encendidos.size ? Date.now() + minutos * 60000 : null;
    if (fin) anunciar(`Se apagan en ${minutos} min`);
    dibujar();
  }

  const mostrarVolumen = (nivel) => { volumenVisible = { nivel, hasta: Date.now() + 1500 }; };

  // --- La pantallita: las barritas del volumen mientras lo cambiás ---
  const textoAnterior = window.textoPantallita;
  window.textoPantallita = () => {
    const anterior = textoAnterior && textoAnterior();
    if (anterior) return anterior;
    if (volumenVisible && Date.now() < volumenVisible.hasta) {
      const llenas = Math.round(volumenVisible.nivel / 2);
      return "VOL " + "▮".repeat(llenas) + "▯".repeat(5 - llenas);
    }
    return null;
  };

  // --- El reloj: temporizador y luz verde latiendo mientras suena algo ---
  setInterval(() => {
    if (fin && Date.now() >= fin) apagarTodo(5);           // se apaga con un fundido largo
    const late = encendidos.size && Math.floor(Date.now() / 800) % 2 === 0;
    ponerLuces(late ? [false, false, true] : null, "sonidos");
    if (contenedor && fin) {
      const aviso = document.getElementById("so-aviso");
      if (aviso) aviso.textContent = `Se apagan en ${Math.max(1, Math.ceil((fin - Date.now()) / 60000))} min`;
    }
  }, 200);

  // --- Lo que se ve ---
  const barras = (nivel) => Array.from({ length: NIVELES }, (_, i) => `<i class="${i < nivel ? "llena" : ""}"></i>`).join("");

  function control(id, nivel) {
    return `<div class="so-control">
      <button class="so-mm" data-${id}="-1" aria-label="Bajar">−</button>
      <span class="so-barras">${barras(nivel)}</span>
      <button class="so-mm" data-${id}="1" aria-label="Subir">+</button>
    </div>`;
  }

  function dibujar() {
    if (!contenedor) return;
    contenedor.innerHTML = `
      ${Object.entries(SONIDOS).map(([c, nombre]) => `
        <div class="so-fila ${encendidos.has(c) ? "on" : ""}">
          <button class="so-alternar" data-clave="${c}" aria-pressed="${encendidos.has(c)}">
            <svg viewBox="0 0 40 40" aria-hidden="true">${ICONOS[c]}</svg>
            <b>${nombre}</b>
            <span class="so-estado">${encendidos.has(c) ? "ON" : "OFF"}</span>
          </button>
          ${control(`paso-${c}`, niveles[c])}
        </div>`).join("")}
      <div class="so-fila so-general">
        <span class="tf-etiqueta">General</span>
        ${control("general", general)}
      </div>
      <p class="tf-etiqueta">Apagar en</p>
      <div class="tf-fila">
        ${MINUTOS.map((m) => `<button class="tf-boton secundario" data-min="${m}">${m}'</button>`).join("")}
        <button class="tf-boton so-apagar" id="so-apagar">Apagar todo</button>
      </div>
      <p class="tf-mensaje" id="so-aviso">${fin ? `Se apagan en ${Math.max(1, Math.ceil((fin - Date.now()) / 60000))} min` : ""}</p>`;

    contenedor.querySelectorAll("[data-clave]").forEach((b) => { b.onclick = () => alternar(b.dataset.clave); });
    Object.keys(SONIDOS).forEach((c) => {
      contenedor.querySelectorAll(`[data-paso-${c}]`).forEach((b) => {
        b.onclick = () => cambiarNivel(c, Number(b.getAttribute(`data-paso-${c}`)));
      });
    });
    contenedor.querySelectorAll("[data-general]").forEach((b) => { b.onclick = () => cambiarGeneral(Number(b.dataset.general)); });
    contenedor.querySelectorAll("[data-min]").forEach((b) => { b.onclick = () => temporizador(Number(b.dataset.min)); });
    document.getElementById("so-apagar").onclick = () => apagarTodo();
  }

  MODULOS.sonidos = {
    abrir(lugar) {
      contenedor = lugar;
      dibujar();
      reaccionar("escucha", "sonidos_hola");
    },
    cerrar() {
      contenedor = null;          // los sonidos siguen sonando aunque cierres la función
    },
  };
})();
