// La nube de las notas compartidas: habla con Firebase (Firestore) igual que la compu,
// con la misma base y el mismo formato, así una nota se comparte entre compu y celu.
(() => {
  const CONFIG = { apiKey: "AIzaSyANcjafD4CsUufOB3zJgZRYrMjZLMRsnS8", projectId: "quipu-a14a5" };
  const ALFABETO = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";   // sin 0/O ni 1/I/L: fáciles de dictar
  const CLAVE_SESION = "quipu.nube_sesion";

  class NubeError extends Error {}

  // Hace un pedido a Firebase y devuelve { estado, cuerpo }.
  async function pedir(metodo, url, { datos = null, token = null, formulario = false } = {}) {
    const opciones = { method: metodo, headers: {} };
    if (datos !== null) {
      if (formulario) {
        opciones.headers["Content-Type"] = "application/x-www-form-urlencoded";
        opciones.body = new URLSearchParams(datos).toString();
      } else {
        opciones.headers["Content-Type"] = "application/json";
        opciones.body = JSON.stringify(datos);
      }
    }
    if (token) opciones.headers["Authorization"] = `Bearer ${token}`;
    let respuesta;
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 15000);   // si la red se cuelga, no esperar para siempre
    opciones.signal = corte.signal;
    try {
      respuesta = await fetch(url, opciones);
    } catch (e) {
      throw new NubeError("Sin conexión a internet");
    } finally {
      clearTimeout(reloj);
    }
    let cuerpo = {};
    try { cuerpo = await respuesta.json(); } catch (e) {}
    return { estado: respuesta.status, cuerpo };
  }

  // La identidad anónima de este celu: la renueva si venció, o pide una nueva.
  let pidiendoSesion = null;
  function sesion() {
    if (!pidiendoSesion) pidiendoSesion = obtenerSesion().finally(() => { pidiendoSesion = null; });
    return pidiendoSesion;
  }

  async function obtenerSesion() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(CLAVE_SESION)); } catch (e) {}
    const ahora = Date.now() / 1000;
    if (s && s.expira > ahora + 60) return s;
    if (s) {
      const { estado, cuerpo } = await pedir("POST",
        `https://securetoken.googleapis.com/v1/token?key=${CONFIG.apiKey}`,
        { datos: { grant_type: "refresh_token", refresh_token: s.refresco }, formulario: true });
      s = estado === 200 ? { token: cuerpo.id_token, refresco: cuerpo.refresh_token, uid: cuerpo.user_id,
                             expira: ahora + Number(cuerpo.expires_in) } : null;
    }
    if (!s) {
      const { estado, cuerpo } = await pedir("POST",
        `https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${CONFIG.apiKey}`,
        { datos: { returnSecureToken: true } });
      if (estado !== 200) throw new NubeError("No pude conectarme con la nube");
      s = { token: cuerpo.idToken, refresco: cuerpo.refreshToken, uid: cuerpo.localId,
            expira: ahora + Number(cuerpo.expiresIn) };
    }
    localStorage.setItem(CLAVE_SESION, JSON.stringify(s));
    return s;
  }

  const direccion = (codigo) =>
    `https://firestore.googleapis.com/v1/projects/${CONFIG.projectId}/databases/(default)/documents/compartidas/${codigo}`;

  // "k7m4-qx2p " -> "K7M4QX2P"
  function normalizar(texto) {
    return String(texto || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  }

  // La nota compartida con ese código, o null si no existe.
  async function bajar(codigo) {
    const s = await sesion();
    const { estado, cuerpo } = await pedir("GET", direccion(codigo), { token: s.token });
    if (estado === 404) return null;
    if (estado !== 200) throw new NubeError(`La nube respondió ${estado}`);
    const d = {};
    Object.entries(cuerpo.fields || {}).forEach(([campo, valor]) => { d[campo] = Object.values(valor)[0]; });
    d.cambiado = Number(d.cambiado || 0);
    return d;
  }

  // Inventa un código de 8 que no esté usado.
  async function codigoLibre() {
    for (let i = 0; i < 5; i++) {
      const azar = crypto.getRandomValues(new Uint32Array(8));
      const codigo = Array.from(azar, (n) => ALFABETO[n % ALFABETO.length]).join("");
      if ((await bajar(codigo)) === null) return codigo;
    }
    throw new NubeError("No pude generar un código, probá de nuevo");
  }

  // El nombre que pusiste en Ajustes, para que los demás vean quién cambió la nota.
  function miNombre() {
    try { return ((JSON.parse(localStorage.getItem("quipu.ajustes")) || {}).nombre || "").trim(); }
    catch (e) { return ""; }
  }
  let nombreRechazado = false;   // por si las reglas de la nube no aceptan el campo "nombre"

  // Sube la nota y devuelve el momento en que quedó guardada.
  async function subir(codigo, titulo, html, texto) {
    const s = await sesion();
    const cambiado = Date.now() / 1000;
    const campos = { fields: {
      titulo: { stringValue: titulo || "" }, html: { stringValue: html || "" },
      texto: { stringValue: texto || "" }, cambiado: { doubleValue: cambiado },
      autor: { stringValue: s.uid },
    } };
    const nombre = miNombre();
    if (nombre && !nombreRechazado) campos.fields.nombre = { stringValue: nombre };
    let { estado } = await pedir("PATCH", direccion(codigo), { datos: campos, token: s.token });
    if (estado === 403 && campos.fields.nombre) {        // probamos sin el nombre
      delete campos.fields.nombre;
      ({ estado } = await pedir("PATCH", direccion(codigo), { datos: campos, token: s.token }));
      if (estado === 200) nombreRechazado = true;
    }
    if (estado === 403) throw new NubeError("La nota es muy pesada para compartir (¿muchas fotos?)");
    if (estado !== 200) throw new NubeError(`La nube respondió ${estado}`);
    return cambiado;
  }

  const mensaje = (error) => (error instanceof NubeError ? error.message : "Algo salió mal con la nube");

  window.NUBE = { normalizar, codigoLibre, subir, bajar, mensaje, miNombre };
})();