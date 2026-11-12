// Agenda en el celular: la semana (o el mes), los eventos del día, avisos y "¿Hiciste...?".
// Los avisos llegan como notificación aunque la app esté cerrada.

window.MODULOS = window.MODULOS || {};

(function () {
  const CLAVE = "quipu.agenda";
  const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
  const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio",
    "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const LETRAS = ["L", "M", "M", "J", "V", "S", "D"];
  const AVISOS = [[0, "No"], [5, "5'"], [10, "10'"], [30, "30'"]];
  const REPETIR = [["no", "No"], ["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"], ["anio", "Año"]];
  const COLORES = ["#E5484D", "#F2994A", "#F2C230", "#3BB54A", "#3FA9F5", "#9B7BFF"];
  const PREGUNTAR_DESPUES_MIN = 30;    // minutos después del evento para preguntar si se hizo
  const PRIMER_ID_AVISO = 2000;        // los números de notificación de la Agenda
  const MAX_AVISOS = 50;
  const sonido = new Audio("assets/sonidos/chiflido.wav");

  const escapar = (t) => String(t ?? "").replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") :
    Date.now().toString(16) + Math.random().toString(16).slice(2));
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const desdeIso = (t) => { const [a, m, d] = t.split("-").map(Number); return new Date(a, m - 1, d); };
  const sumarDias = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const hoy = () => { const a = new Date(); return new Date(a.getFullYear(), a.getMonth(), a.getDate()); };
  const momento = (o) => { const [h, m] = o.hora.split(":").map(Number); const d = desdeIso(o.dia); d.setHours(h, m); return d; };

  let base = null;          // { version, eventos: [...], respuestas: { "uid|dia": {...} } }
  let contenedor = null;
  let elegido = hoy();      // el día que estás mirando
  let vistaMes = false;     // false = la semana, true = el mes entero
  let pendiente = null;     // el evento avisado que todavía no empezó
  let pregunta = null;      // el evento que pasó y espera "¿Hiciste...?"
  const avisados = new Set();

  // --- Guardar y leer en el celular ---
  function cargar() {
    try { base = JSON.parse(localStorage.getItem(CLAVE)); } catch (error) { base = null; }
    if (!base) base = { version: 1, eventos: [], respuestas: {} };
  }
  const guardarTodo = () => localStorage.setItem(CLAVE, JSON.stringify(base));

  // --- Cuándo ocurre cada evento (igual que en la compu, con las repeticiones) ---
  function ocurre(ev, dia) {
    const inicio = desdeIso(ev.fecha);
    if (dia < inicio) return false;
    switch (ev.repetir) {
      case "no": return iso(dia) === ev.fecha;
      case "dia": return true;
      case "semana": return dia.getDay() === inicio.getDay();
      case "mes": {
        const ultimo = new Date(dia.getFullYear(), dia.getMonth() + 1, 0).getDate();
        return dia.getDate() === Math.min(inicio.getDate(), ultimo);   // un 31 cae el último día
      }
      case "anio": return dia.getMonth() === inicio.getMonth() && dia.getDate() === inicio.getDate();
      default: return false;
    }
  }

  function ocurrencias(desde, hasta) {
    const vivos = base.eventos.filter((e) => !e.borrada);
    const resultado = [];
    for (let d = desde; d <= hasta; d = sumarDias(d, 1)) {
      vivos.forEach((ev) => { if (ocurre(ev, d)) resultado.push({ ...ev, dia: iso(d) }); });
    }
    return resultado.sort((a, b) => (a.dia + (a.hora || "00:00")).localeCompare(b.dia + (b.hora || "00:00")));
  }
  const delDia = (d) => ocurrencias(d, d);

  // --- El personaje: un gesto (si lo tiene) y una frase ---
  function reaccionar(gesto, claveOTexto) {
    if (!datos) return;
    if (!ocupado && hoja.cuadros[gesto] !== undefined) {
      ocupado = true;
      mostrar(gesto);
      setTimeout(() => { mostrar("mira_frente"); ocupado = false; }, 1800);
    }
    const frase = datos.frases[claveOTexto] || (claveOTexto.includes(" ") ? claveOTexto : null);   // una clave sin frase no se dice
    if (frase) decir(frase);
  }

  // --- Las luces: se combinan con las del Foco (cada función prende las suyas) ---
  if (!window.ponerLuces.combinadas) {
    const original = window.ponerLuces;
    const fuentes = {};
    window.ponerLuces = function (estados, fuente = "foco") {
      fuentes[fuente] = estados;
      const juntas = [0, 1, 2].map((i) => Object.values(fuentes).some((e) => e && e[i]));
      original(juntas);
    };
    window.ponerLuces.combinadas = true;
  }

  // --- La pantallita: la hora del evento que viene (si no hay un foco en marcha) ---
  const textoAnterior = window.textoPantallita;
  window.textoPantallita = () => (textoAnterior && textoAnterior()) || (pendiente ? pendiente.hora : null);

  // --- Notificaciones: los avisos de los próximos días, aunque la app esté cerrada ---
  const Notificaciones = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.LocalNotifications;

  async function programarAvisos(pedirPermiso = false) {
    const N = Notificaciones();
    if (!N) return;
    try {
      let permiso = await N.checkPermissions();
      if (permiso.display !== "granted" && pedirPermiso) permiso = await N.requestPermissions();
      const anteriores = Number(localStorage.getItem(CLAVE + ".avisos") || 0);
      if (anteriores) {
        await N.cancel({ notifications: Array.from({ length: anteriores }, (_, i) => ({ id: PRIMER_ID_AVISO + i })) });
      }
      if (permiso.display !== "granted") return;
      const ahora = new Date();
      const proximos = ocurrencias(hoy(), sumarDias(hoy(), 30))
        .filter((o) => o.hora && o.aviso_min)
        .map((o) => ({ o, cuando: new Date(momento(o).getTime() - o.aviso_min * 60000) }))
        .filter((x) => x.cuando > ahora)
        .slice(0, MAX_AVISOS);
      if (proximos.length) {
        await N.schedule({ notifications: proximos.map((x, i) => ({
          id: PRIMER_ID_AVISO + i,
          title: "Quipu · Agenda",
          body: `En ${x.o.aviso_min} minutos: ${x.o.titulo} (${x.o.hora})`,
          schedule: { at: x.cuando, allowWhileIdle: true },
        })) });
      }
      localStorage.setItem(CLAVE + ".avisos", String(proximos.length));
    } catch (error) { /* sin notificaciones, la Agenda funciona igual */ }
  }

  // --- Mientras la app está abierta: avisar y preguntar ---
  function revisar() {
    const ahora = new Date();
    if (!pregunta) {
      pregunta = delDia(hoy()).find((o) => o.hora &&
        new Date(momento(o).getTime() + PREGUNTAR_DESPUES_MIN * 60000) <= ahora &&
        !base.respuestas[`${o.uid}|${o.dia}`]) || null;
      if (pregunta) {
        reaccionar("senala", `¿Hiciste: ${pregunta.titulo}?`);
        sonido.play().catch(() => {});
        if (contenedor) dibujar();
      }
    }
    if (pendiente && ahora >= momento(pendiente)) pendiente = null;   // ya empezó
    const proximos = ocurrencias(hoy(), sumarDias(hoy(), 1)).filter((o) => o.hora && o.aviso_min);
    for (const o of proximos) {
      const inicio = momento(o);
      const avisarEn = new Date(inicio.getTime() - o.aviso_min * 60000);
      const clave = `${o.uid}|${o.dia}`;
      if (avisarEn <= ahora && ahora < inicio && !avisados.has(clave)) {
        avisados.add(clave);
        pendiente = o;
        const minutos = Math.max(1, Math.round((inicio - ahora) / 60000));
        reaccionar("campana", `¡En ${minutos} minutos tenés ${o.titulo}!`);
        sonido.play().catch(() => {});
        break;                                          // de a un aviso por vez
      }
    }
    // Luces: roja titilando = ya viene; roja fija = espera tu respuesta
    const t = Math.floor(Date.now() / 1000);
    ponerLuces(pendiente ? [t % 2 === 0, false, false] : pregunta ? [true, false, false] : null, "agenda");
  }

  function responder(respuesta) {
    const o = pregunta;
    if (!o) return;
    base.respuestas[`${o.uid}|${o.dia}`] = { respuesta, creada: Date.now() / 1000 };
    guardarTodo();
    pregunta = null;
    const [gesto, frase] = { si: ["festeja", "¡Bien ahí!"], no: ["sonrie", "Bueno, otra vez será"],
      reprogramar: ["senala", "Elegí el nuevo día y la hora"] }[respuesta];
    reaccionar(gesto, frase);
    if (respuesta === "reprogramar") {
      const ev = base.eventos.find((e) => e.uid === o.uid);
      if (ev && ev.repetir === "no") formulario(ev);
      else formulario({ ...ev, uid: null, repetir: "no", fecha: iso(hoy()) });   // una vez suelta, otro día
    } else if (contenedor) {
      dibujar();
    }
  }

  // ================= LO QUE SE VE =================
  function dibujar() {
    if (!contenedor) return;
    const titulo = `${MESES[elegido.getMonth()]} ${elegido.getFullYear()}`;
    contenedor.innerHTML = `
      <div class="ag-raiz">
        <div class="ag-barra">
          <button class="no-tecla" id="ag-volver" aria-label="Volver al inicio">‹</button>
          <button class="ag-titulo" id="ag-titulo" aria-label="Ver ${vistaMes ? "la semana" : "el mes"}">${titulo} <span>${vistaMes ? "▴" : "▾"}</span></button>
          <button class="no-tecla clara" id="ag-antes" aria-label="Anterior">‹</button>
          <button class="no-tecla clara" id="ag-despues" aria-label="Siguiente">›</button>
          <button class="no-tecla" id="ag-nuevo" aria-label="Nuevo evento">+</button>
        </div>
        <div class="ag-cuerpo desplazable" id="ag-cuerpo">
          ${pregunta ? `
            <div class="ag-pregunta">
              <span><i style="background:${pregunta.color}"></i>¿Hiciste: <b>${escapar(pregunta.titulo)}</b>?</span>
              <div class="tf-fila">
                <button class="tf-boton" data-resp="si">Sí</button>
                <button class="tf-boton secundario" data-resp="no">No</button>
                <button class="tf-boton secundario" data-resp="reprogramar">Reprogramar</button>
              </div>
            </div>` : ""}
          ${vistaMes ? dibujarMes() : dibujarSemana()}
          ${vistaMes ? "" : dibujarDia()}
        </div>
      </div>`;

    const $ = (id) => document.getElementById(id);
    $("ag-volver").onclick = () => volverAlInicio();
    $("ag-titulo").onclick = () => { vistaMes = !vistaMes; dibujar(); };
    $("ag-antes").onclick = () => mover(-1);
    $("ag-despues").onclick = () => mover(1);
    $("ag-nuevo").onclick = () => formulario(null);
    contenedor.querySelectorAll("[data-dia]").forEach((b) => {
      b.onclick = () => { elegido = desdeIso(b.dataset.dia); vistaMes = false; dibujar(); };
    });
    contenedor.querySelectorAll("[data-evento]").forEach((b) => {
      b.onclick = () => formulario(base.eventos.find((e) => e.uid === b.dataset.evento));
    });
    contenedor.querySelectorAll("[data-resp]").forEach((b) => { b.onclick = () => responder(b.dataset.resp); });
  }

  function mover(paso) {
    elegido = vistaMes
      ? new Date(elegido.getFullYear(), elegido.getMonth() + paso, 1)
      : sumarDias(elegido, 7 * paso);
    dibujar();
  }

  function celda(d, deOtroMes = false) {
    const puntos = [...new Set(delDia(d).map((o) => o.color))].slice(0, 3)
      .map((c) => `<i style="background:${c}"></i>`).join("");
    const clases = ["ag-dia", iso(d) === iso(hoy()) ? "hoy" : "", iso(d) === iso(elegido) ? "elegido" : "",
      deOtroMes ? "otro" : ""].join(" ");
    return `<button class="${clases}" data-dia="${iso(d)}"><b>${d.getDate()}</b><span class="ag-puntos">${puntos}</span></button>`;
  }

  function dibujarSemana() {
    const lunes = sumarDias(elegido, -((elegido.getDay() + 6) % 7));
    const dias = Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
    return `<div class="ag-letras">${LETRAS.map((l) => `<span>${l}</span>`).join("")}</div>
      <div class="ag-grilla">${dias.map((d) => celda(d)).join("")}</div>`;
  }

  function dibujarMes() {
    const primero = new Date(elegido.getFullYear(), elegido.getMonth(), 1);
    const inicio = sumarDias(primero, -((primero.getDay() + 6) % 7));
    const ultimo = new Date(elegido.getFullYear(), elegido.getMonth() + 1, 0);
    const semanas = Math.ceil((((primero.getDay() + 6) % 7) + ultimo.getDate()) / 7);
    const dias = Array.from({ length: semanas * 7 }, (_, i) => sumarDias(inicio, i));
    return `<div class="ag-letras">${LETRAS.map((l) => `<span>${l}</span>`).join("")}</div>
      <div class="ag-grilla">${dias.map((d) => celda(d, d.getMonth() !== elegido.getMonth())).join("")}</div>`;
  }

  function dibujarDia() {
    const eventos = delDia(elegido);
    return `<p class="tf-etiqueta">${DIAS[elegido.getDay()]} ${elegido.getDate()}</p>
      ${eventos.length ? eventos.map((o) => `
        <button class="no-tarjeta" data-evento="${o.uid}">
          <span class="no-punto" style="background:${o.color}"></span>
          <span class="ag-hora">${o.hora || "Todo el día"}</span>
          <span class="no-cuerpo"><b>${escapar(o.titulo)}</b></span>
          ${o.repetir !== "no" ? '<span class="ag-repite" aria-label="Se repite">↻</span>' : ""}
        </button>`).join("") : '<p class="tf-mensaje">No hay nada anotado. Tocá + para agregar.</p>'}`;
  }

  // ================= NUEVO O EDITAR EVENTO =================
  function formulario(ev) {
    if (!contenedor) return;
    const f = ev ? { ...ev } : { uid: null, titulo: "", fecha: iso(elegido), hora: "10:00", aviso_min: 10, repetir: "no", color: COLORES[0] };
    const chips = (lista, clave) => lista.map(([valor, texto]) =>
      `<button class="tf-boton secundario ${f[clave] === valor ? "activa" : ""}" data-${clave}="${valor}">${texto}</button>`).join("");
    contenedor.innerHTML = `
      <div class="ag-raiz">
        <div class="ag-barra">
          <button class="no-tecla" id="ag-atras" aria-label="Volver a la agenda">‹</button>
          <span class="ag-titulo-form">${f.uid ? "Editar evento" : "Nuevo evento"}</span>
        </div>
        <div class="ag-cuerpo desplazable">
          <input id="ag-f-titulo" class="tf-campo no-ancho" placeholder="¿Qué tenés?" value="${escapar(f.titulo)}">
          <div class="tf-fila ag-fila">
            <input id="ag-f-fecha" class="tf-campo" type="date" value="${f.fecha}">
            <input id="ag-f-hora" class="tf-campo ag-chico" type="time" value="${f.hora || ""}" ${f.hora ? "" : "disabled"}>
          </div>
          <label class="ag-check"><input type="checkbox" id="ag-f-todo" ${f.hora ? "" : "checked"}> Todo el día</label>
          <p class="tf-etiqueta">Avisar antes</p>
          <div class="tf-fila" id="ag-f-aviso">${chips(AVISOS, "aviso_min")}</div>
          <p class="tf-etiqueta">Repetir</p>
          <div class="tf-fila" id="ag-f-repetir">${chips(REPETIR, "repetir")}</div>
          <p class="tf-etiqueta">Color</p>
          <div class="no-colores">${COLORES.map((c) => `<button data-color="${c}" class="${f.color === c ? "activa" : ""}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}</div>
          <div class="tf-fila tf-final">
            ${f.uid ? '<button class="tf-boton secundario ag-peligro" id="ag-borrar">Borrar</button>' : ""}
            <button class="tf-boton" id="ag-guardar">Guardar</button>
          </div>
        </div>
      </div>`;

    const $ = (id) => document.getElementById(id);
    $("ag-atras").onclick = dibujar;
    $("ag-f-todo").onchange = () => {
      $("ag-f-hora").disabled = $("ag-f-todo").checked;
      if (!$("ag-f-todo").checked && !$("ag-f-hora").value) $("ag-f-hora").value = "10:00";
    };
    contenedor.querySelectorAll("[data-aviso_min]").forEach((b) => {
      b.onclick = () => { f.aviso_min = Number(b.dataset.aviso_min); contenedor.querySelectorAll("[data-aviso_min]").forEach((x) => x.classList.toggle("activa", x === b)); };
    });
    contenedor.querySelectorAll("[data-repetir]").forEach((b) => {
      b.onclick = () => { f.repetir = b.dataset.repetir; contenedor.querySelectorAll("[data-repetir]").forEach((x) => x.classList.toggle("activa", x === b)); };
    });
    contenedor.querySelectorAll("[data-color]").forEach((b) => {
      b.onclick = () => { f.color = b.dataset.color; contenedor.querySelectorAll("[data-color]").forEach((x) => x.classList.toggle("activa", x === b)); };
    });
    if ($("ag-borrar")) {
      $("ag-borrar").onclick = () => {
        const real = base.eventos.find((e) => e.uid === f.uid);
        Object.assign(real, { borrada: 1, modificada: Date.now() / 1000 });
        guardarTodo();
        programarAvisos();
        anunciar("Borrado");
        dibujar();
      };
    }
    $("ag-guardar").onclick = () => {
      const titulo = $("ag-f-titulo").value.trim();
      if (!titulo) { $("ag-f-titulo").focus(); return anunciar("Falta el título"); }
      const nuevo = {
        titulo, fecha: $("ag-f-fecha").value || iso(elegido),
        hora: $("ag-f-todo").checked ? "" : ($("ag-f-hora").value || "10:00"),
        color: f.color, aviso_min: f.aviso_min, repetir: f.repetir, borrada: 0, modificada: Date.now() / 1000,
      };
      const real = f.uid && base.eventos.find((e) => e.uid === f.uid);
      if (real) Object.assign(real, nuevo);
      else base.eventos.push({ uid: nuevoId(), creada: Date.now() / 1000, ...nuevo });
      guardarTodo();
      programarAvisos(true);                       // la primera vez, pide permiso para avisar
      elegido = desdeIso(nuevo.fecha);
      anunciar("Guardando…");
      reaccionar("tacha", "agenda_guardado");
      dibujar();
    };
    if (!f.uid) setTimeout(() => $("ag-f-titulo").focus(), 300);
  }

  // Hace pasar lo próximo de hoy por la pantallita.
  function pasarCartel() {
    const ahora = new Date();
    for (const o of delDia(hoy())) {
      if (!o.hora) return anunciar(`Hoy · ${o.titulo}`);
      if (momento(o) >= ahora) return anunciar(`Hoy ${o.hora} · ${o.titulo}`);
    }
  }

  cargar();
  setInterval(revisar, 20000);
  setTimeout(() => { revisar(); programarAvisos(); }, 3000);

  MODULOS.agenda = {
    recargar() { cargar(); },          // lo usa la sincronización cuando llegan eventos de la compu
    abrir(lugar) {
      contenedor = lugar;
      cargar();
      document.querySelector("#funcion header").style.display = "none";
      elegido = hoy();
      vistaMes = false;
      dibujar();
      reaccionar("calendario", "agenda_hola");
      setTimeout(() => { if (contenedor) pasarCartel(); }, 3200);
    },
    cerrar() {
      contenedor = null;
      document.querySelector("#funcion header").style.display = "";
    },
  };
})();
