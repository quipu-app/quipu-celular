// Sincronización con Google Drive en el celular: el mismo archivo (quipu_datos.json, en la carpeta
// privada de la app) y las mismas reglas que la compu: gana el cambio más reciente, por uid.
// El celu guarda "modificada" donde la compu guarda "cambiado", y en las notas "carpeta" donde la
// compu guarda "carpeta_uid": acá se traducen, así Notas y Agenda no se enteran.

window.SINCRO = (function () {
  const WEB_CLIENT_ID = "238502844427-lltl51ij0uceam48k5h9m1a4ddcvrlhr.apps.googleusercontent.com";
  const PERMISO = "https://www.googleapis.com/auth/drive.appdata";
  const ARCHIVO = "quipu_datos.json";
  const FORMATO = 1;
  const API = "https://www.googleapis.com/drive/v3/files";
  const SUBIDA = "https://www.googleapis.com/upload/drive/v3/files";
  const CLAVE_ESTADO = "quipu.drive";
  const ESPERA_TRAS_CAMBIO = 8000;          // después de guardar algo
  const CADA_CUANTO = 10 * 60 * 1000;       // además, cada 10 minutos
  const REINTENTO = 2 * 60 * 1000;          // sin internet: a los 2 minutos

  const Login = () => window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.SocialLogin;
  const leer = (clave, vacio) => {
    try { return JSON.parse(localStorage.getItem(clave)) || vacio; } catch (error) { return vacio; }
  };

  let estado = leer(CLAVE_ESTADO, { conectado: false, ultima: 0 });
  const guardarEstado = () => localStorage.setItem(CLAVE_ESTADO, JSON.stringify(estado));
  let sincronizando = false;
  let sinConexion = false;
  let iniciado = false;
  let foto = null;            // cómo estaban los datos en la última sincronización
  let cambioDesde = null;     // cuándo se notó un cambio todavía sin subir
  let proxima = Date.now() + 5000;
  let paso = "";            // en qué parte de la conexión estamos, para explicar un error
  const CLAVE_ERROR = "quipu.drive_error";
  // Arma un texto legible con lo que trae cualquier error (los del plugin de Google vienen distintos)
  const detalle = (e) => {
    if (!e) return "sin detalle";
    const partes = [e.code, e.message || e.errorMessage].filter(Boolean);
    if (partes.length) return partes.join(" · ");
    try { return JSON.stringify(e); } catch (x) { return String(e); }
  };
  // Qué tipo de llave dio Google (sin mostrarla): las de Drive empiezan con ya29
  const tipoLlave = (t) => !t ? "vacía" : (String(t).startsWith("ya29.") ? "ya29" : String(t).slice(0, 3) + "…");
  // Si el archivo de Drive trae una barra invertida mal escrita (una barra seguida de algo que no es un
  // escape válido), la duplica para que se lea como texto común. Las barras bien escritas quedan igual.
  const repararJson = (texto) => texto.replace(/\\(["\\\/bfnrt]|u[0-9a-fA-F]{4})?/g,
    (todo, valido) => (valido ? todo : "\\\\"));
  const CLAVE_REPARADO = "quipu.drive_reparado";
  let archivoReparado = false;
  // Si Google no contesta, no esperar para siempre
  const conLimite = (promesa, segundos) => Promise.race([promesa, new Promise((_, rechazar) =>
    setTimeout(() => rechazar(new Error(`Google no respondió en ${segundos} segundos`)), segundos * 1000))]);
  let alCambiar = null;       // Ajustes se anota para redibujarse

  const avisar = () => { if (alCambiar) alCambiar(); };

  // --- Google: entrar y pedir la llave para Drive -------------------------------------------
  async function iniciar() {
    if (iniciado) return;
    await Login().initialize({ google: { webClientId: WEB_CLIENT_ID, mode: "online" } });
    iniciado = true;
  }

  async function llave(conectar) {
    const L = Login();
    if (!L) throw new Error("La sincronización funciona en la app del celular");
    paso = "preparar Google";
    await iniciar();
    if (conectar) {
      paso = "elegir cuenta y dar permiso";
      const r = await conLimite(L.login({ provider: "google", options: { scopes: [PERMISO] } }), 90);
      const t = r && r.result && r.result.accessToken && r.result.accessToken.token;
      if (t) return t;
    }
    paso = "renovar la sesión";
    try { await conLimite(L.refresh({ provider: "google", options: {} }), 30); } catch (error) { /* sigue con la guardada */ }
    paso = "pedir la llave de Drive";
    const c = await conLimite(L.getAuthorizationCode({ provider: "google" }), 30);
    if (!c || !c.accessToken) throw new Error("sin_llave");
    return c.accessToken;
  }

  // --- Drive: buscar, bajar y subir el archivo -------------------------------------------------
  async function pedir(url, opciones, t) {
    const r = await fetch(url, { ...opciones, headers: { ...(opciones.headers || {}), Authorization: `Bearer ${t}` } });
    if (!r.ok) {
      let cuerpo = "";
      try { cuerpo = (await r.text()).slice(0, 160); } catch (e) { /* sin texto */ }
      throw new Error(`Drive respondió ${r.status} ${cuerpo}`);
    }
    return r;
  }

  async function bajar(t) {
    const q = encodeURIComponent(`name = '${ARCHIVO}'`);
    const lista = await (await pedir(`${API}?spaces=appDataFolder&q=${q}&fields=files(id)`, {}, t)).json();
    const id = lista.files && lista.files[0] && lista.files[0].id;
    if (!id) return { archivo: null, id: null };
    const texto = await (await pedir(`${API}/${id}?alt=media`, {}, t)).text();
    archivoReparado = false;
    try {
      return { archivo: JSON.parse(texto), id };
    } catch (error) {
      const archivo = JSON.parse(repararJson(texto));   // si tampoco así se puede leer, sale el error original
      archivoReparado = true;
      const lugar = Number((String(error.message).match(/position (\d+)/) || [])[1] || 0);
      const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
      localStorage.setItem(CLAVE_REPARADO, `${hora} · «${texto.slice(Math.max(0, lugar - 40), lugar + 20)}»`);
      return { archivo, id };
    }
  }

  async function subir(t, datos, id) {
    const cuerpo = JSON.stringify(datos);
    if (id) {
      await pedir(`${SUBIDA}/${id}?uploadType=media`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: cuerpo,
      }, t);
      return;
    }
    const limite = "quipu" + Date.now();
    const meta = JSON.stringify({ name: ARCHIVO, parents: ["appDataFolder"] });
    const multipart = `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n` +
      `--${limite}\r\nContent-Type: application/json\r\n\r\n${cuerpo}\r\n--${limite}--`;
    await pedir(`${SUBIDA}?uploadType=multipart`, {
      method: "POST", headers: { "Content-Type": `multipart/related; boundary=${limite}` }, body: multipart,
    }, t);
  }

  // --- Del formato del celu al de la compu, y de vuelta ------------------------------------------
  const marcaDe = (r) => r.modificada || r.creada || 0;

  function exportar() {
    const notas = leer("quipu.notas", { version: 1, carpetas: [], notas: [] });
    const agenda = leer("quipu.agenda", { version: 1, eventos: [], respuestas: {} });
    const porUid = (lista, convertir) => Object.fromEntries((lista || []).filter((r) => r.uid).map((r) => [r.uid, convertir(r)]));
    const comun = (r) => ({ ...r, cambiado: marcaDe(r) });
    const respuestas = {};
    Object.entries(agenda.respuestas || {}).forEach(([clave, r]) => {
      const corte = clave.lastIndexOf("|");
      respuestas[clave] = { evento_uid: clave.slice(0, corte), dia: clave.slice(corte + 1), respuesta: r.respuesta, creada: r.creada || 0 };
    });
    return {
      carpetas: porUid(notas.carpetas, comun),
      notas: porUid(notas.notas, (n) => {
        const r = { ...n, cambiado: marcaDe(n), carpeta_uid: n.carpeta || null };
        delete r.carpeta;
        return r;
      }),
      eventos: porUid(agenda.eventos, comun),
      respuestas,
    };
  }

  function desdeArchivo(archivo) {
    const remoto = {};
    Object.entries((archivo && archivo.tablas) || {}).forEach(([tabla, lista]) => {
      remoto[tabla] = Object.fromEntries(lista.map((r) =>
        [tabla === "respuestas" ? `${r.evento_uid}|${r.dia}` : r.uid, r]));
    });
    return remoto;
  }

  const marca = (tabla, r) => (tabla === "respuestas" ? r.creada : r.cambiado) || 0;

  function unir(local, remoto) {
    const unido = {}, paraAplicar = {};
    let hayQueSubir = false;
    ["carpetas", "notas", "eventos", "respuestas"].forEach((tabla) => {
      const aca = local[tabla] || {}, alla = remoto[tabla] || {};
      unido[tabla] = {};
      paraAplicar[tabla] = [];
      new Set([...Object.keys(aca), ...Object.keys(alla)]).forEach((clave) => {
        const mio = aca[clave], suyo = alla[clave];
        let ganador;
        if (!suyo) { ganador = mio; hayQueSubir = true; }
        else if (!mio) { ganador = suyo; paraAplicar[tabla].push(suyo); }
        else if (marca(tabla, suyo) > marca(tabla, mio)) { ganador = suyo; paraAplicar[tabla].push(suyo); }
        else { ganador = mio; if (marca(tabla, mio) > marca(tabla, suyo)) hayQueSubir = true; }
        unido[tabla][clave] = ganador;
      });
    });
    return { unido, paraAplicar, hayQueSubir };
  }

  function aplicar(paraAplicar) {
    const notas = leer("quipu.notas", { version: 1, carpetas: [], notas: [] });
    const agenda = leer("quipu.agenda", { version: 1, eventos: [], respuestas: {} });
    notas.carpetas = notas.carpetas || [];
    notas.notas = notas.notas || [];
    agenda.eventos = agenda.eventos || [];
    agenda.respuestas = agenda.respuestas || {};
    const poner = (lista, r) => {
      const i = lista.findIndex((x) => x.uid === r.uid);
      if (i >= 0) lista[i] = { ...lista[i], ...r }; else lista.push(r);
    };
    const alCelu = (r) => {
      const c = { ...r, modificada: r.cambiado || r.modificada || r.creada || 0 };
      delete c.cambiado;
      return c;
    };
    paraAplicar.carpetas.forEach((r) => poner(notas.carpetas, alCelu(r)));
    paraAplicar.notas.forEach((r) => {
      const n = alCelu(r);
      n.carpeta = r.carpeta_uid || null;
      delete n.carpeta_uid;
      poner(notas.notas, n);
    });
    paraAplicar.eventos.forEach((r) => poner(agenda.eventos, alCelu(r)));
    paraAplicar.respuestas.forEach((r) => {
      agenda.respuestas[`${r.evento_uid}|${r.dia}`] = { respuesta: r.respuesta, creada: r.creada };
    });
    if (paraAplicar.carpetas.length || paraAplicar.notas.length) localStorage.setItem("quipu.notas", JSON.stringify(notas));
    if (paraAplicar.eventos.length || paraAplicar.respuestas.length) {
      localStorage.setItem("quipu.agenda", JSON.stringify(agenda));
      if (window.MODULOS && MODULOS.agenda && MODULOS.agenda.recargar) MODULOS.agenda.recargar();
    }
  }

  // --- Todo junto ------------------------------------------------------------------------------
  async function sincronizarDatos(conectar) {
    let t = await llave(conectar);
    paso = `leer tu Drive (llave ${tipoLlave(t)})`;
    let archivo, id;
    try {
      ({ archivo, id } = await bajar(t));
    } catch (error) {
      if (!/ 401/.test(String(error && error.message))) throw error;
      // Drive no aceptó la llave: pedimos otra por el otro camino y probamos una vez más
      const primera = tipoLlave(t);
      t = await llave(false);
      paso = `leer tu Drive (1ª llave ${primera}, 2ª llave ${tipoLlave(t)})`;
      ({ archivo, id } = await bajar(t));
    }
    if (archivo && (archivo.formato || 1) > FORMATO) return { estado: "formato_nuevo" };

    // El nombre de usuario: gana el que se cambió más recientemente
    const ajustes = leer("quipu.ajustes", {});
    const perfil = { nombre: ajustes.nombre || "", nombre_cambiado: ajustes.nombre_cambiado || 0 };
    const perfilDrive = (archivo && archivo.perfil) || {};
    let perfilFinal = perfil, perfilBajado = null, subirPerfil = false;
    if ((perfilDrive.nombre_cambiado || 0) > perfil.nombre_cambiado) perfilFinal = perfilBajado = perfilDrive;
    else if (perfil.nombre_cambiado > (perfilDrive.nombre_cambiado || 0)) subirPerfil = true;

    const { unido, paraAplicar, hayQueSubir } = unir(exportar(), desdeArchivo(archivo));
    aplicar(paraAplicar);
    if (perfilBajado) {
      localStorage.setItem("quipu.ajustes", JSON.stringify({
        ...ajustes, nombre: perfilBajado.nombre || "", nombre_cambiado: perfilBajado.nombre_cambiado || 0,
      }));
    }
    if (hayQueSubir || subirPerfil || !archivo || archivoReparado) {
      await subir(t, {
        formato: FORMATO,
        perfil: perfilFinal,
        actualizado: Date.now() / 1000,
        tablas: Object.fromEntries(Object.entries(unido).map(([tabla, r]) => [tabla, Object.values(r)])),
      }, id);
    }
    const bajados = Object.values(paraAplicar).reduce((s, l) => s + l.length, 0);
    return { estado: "listo", bajados, perfil: Boolean(perfilBajado) };
  }

  const fotoActual = () => (localStorage.getItem("quipu.notas") || "") + "\u0000" +
    (localStorage.getItem("quipu.agenda") || "") + "\u0000" + (leer("quipu.ajustes", {}).nombre_cambiado || 0);

  async function sincronizar({ conectar = false, silencioso = false } = {}) {
    if (sincronizando) return;
    sincronizando = true;
    const fotoInicio = fotoActual();
    avisar();
    if (!silencioso) anunciar("Sincronizando…");
    try {
      const r = await sincronizarDatos(conectar);
      if (r.estado === "formato_nuevo") {
        if (!silencioso) decir("Actualizá Quipu para poder sincronizar");
        proxima = Date.now() + REINTENTO;
      } else {
        sinConexion = false;
        estado.conectado = true;
        estado.ultima = Date.now() / 1000;
        guardarEstado();
        foto = r.bajados || r.perfil ? fotoActual() : fotoInicio;
        cambioDesde = null;
        proxima = Date.now() + CADA_CUANTO;
        if (!silencioso || r.bajados) anunciar("¡Listo!");
        if (conectar) { decir("¡Listo! Tus datos ya viajan con vos"); localStorage.removeItem(CLAVE_ERROR); }
      }
    } catch (error) {
      console.log("Sincronización: " + (error && error.message ? error.message : error));
      if (conectar) {
        const hora = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
        localStorage.setItem(CLAVE_ERROR, `${hora} · al ${paso}: ${detalle(error)}`);
      }
      proxima = Date.now() + REINTENTO;
      if (conectar) {
        decir("No pude conectarme con Google");
      } else if (error && /not logged in|sin_llave/i.test(String(error.message || error))) {
        estado.conectado = false;              // la sesión de Google se cerró: hay que volver a conectar
        guardarEstado();
        if (!silencioso) decir("Tenés que volver a conectar Google en Ajustes");
      } else {
        sinConexion = true;
        if (!silencioso) decir("No pude sincronizar. ¿Hay internet?");
      }
    } finally {
      sincronizando = false;
      avisar();
    }
  }

  async function desconectar() {
    try { await iniciar(); await Login().logout({ provider: "google" }); } catch (error) { /* ya estaba afuera */ }
    estado = { conectado: false, ultima: 0 };
    sinConexion = false;
    guardarEstado();
    decir("Listo, me desconecté de Google");
    avisar();
  }

  // --- Automática: cada 5 segundos mira si hay algo para subir ---------------------------------
  const editando = () => typeof funcionActual !== "undefined" && (funcionActual === "notas" || funcionActual === "agenda");

  setInterval(() => {
    if (!estado.conectado || sincronizando || !Login()) return;
    const ahora = Date.now();
    if (foto !== null && cambioDesde === null && fotoActual() !== foto) cambioDesde = ahora;
    const cambioListo = cambioDesde !== null && ahora - cambioDesde >= ESPERA_TRAS_CAMBIO;
    if ((cambioListo || ahora >= proxima) && !editando()) sincronizar({ silencioso: true });
  }, 5000);

  // Al volver a la app (o al salir de ella), una vuelta para traer o subir lo pendiente
  document.addEventListener("visibilitychange", () => {
    if (!estado.conectado || sincronizando || editando()) return;
    if (document.visibilityState === "visible" || fotoActual() !== foto) sincronizar({ silencioso: true });
  });

  // --- Lo que muestra Ajustes ----------------------------------------------------------------
  function cuando() {
    if (sinConexion) return "Sin conexión: reintento en un rato";
    if (!estado.ultima) return "Todavía no se sincronizó";
    const f = new Date(estado.ultima * 1000);
    const hora = f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    return "Última vez: " + (new Date().toDateString() === f.toDateString() ? "hoy " + hora : f.toLocaleDateString("es-AR") + " " + hora);
  }

  let confirmarHasta = 0;
  return {
    html() {
      if (!estado.conectado) {
        return `<p class="tf-etiqueta">Google Drive</p>
          <div class="tf-fila"><button class="tf-boton" id="dr-conectar" ${sincronizando ? "disabled" : ""}>${sincronizando ? "Esperando a Google…" : "Conectar"}</button></div>
          <p class="tf-mensaje aj-ayuda">Guarda una copia de tus notas y tu agenda en tu Drive, para tenerlas también en la compu.</p>
          ${localStorage.getItem(CLAVE_ERROR) ? `<p class="tf-mensaje aj-ayuda">Último error: ${String(localStorage.getItem(CLAVE_ERROR)).replace(/[<>&]/g, "")}</p>` : ""}`;
      }
      return `<p class="tf-etiqueta">Google Drive</p>
        <p class="tf-mensaje aj-ayuda">${cuando()}</p>
        ${localStorage.getItem(CLAVE_REPARADO) ? `<p class="tf-mensaje aj-ayuda">Reparé el archivo de Drive. Lo que estaba mal: ${String(localStorage.getItem(CLAVE_REPARADO)).replace(/[<>&]/g, "")}</p>` : ""}
        <div class="tf-fila">
          <button class="tf-boton" id="dr-sincro" ${sincronizando ? "disabled" : ""}>${sincronizando ? "Sincronizando…" : "Sincronizar ahora"}</button>
          <button class="tf-boton secundario" id="dr-desconectar">Desconectar</button>
        </div>`;
    },
    conectar(redibujar) {
      alCambiar = redibujar;
      const $ = (id) => document.getElementById(id);
      if ($("dr-conectar")) $("dr-conectar").onclick = () => sincronizar({ conectar: true });
      if ($("dr-sincro")) $("dr-sincro").onclick = () => sincronizar();
      if ($("dr-desconectar")) {
        $("dr-desconectar").onclick = () => {
          if (Date.now() < confirmarHasta) { confirmarHasta = 0; desconectar(); return; }
          confirmarHasta = Date.now() + 3000;
          $("dr-desconectar").textContent = "¿Seguro? Tocá de nuevo";
          setTimeout(() => { if ($("dr-desconectar")) $("dr-desconectar").textContent = "Desconectar"; }, 3000);
        };
      }
    },
  };
})();