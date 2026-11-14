"""Notas compartidas en el celu (1.2.1): crea funciones/nube.js y conecta el panel de colaborar en Notas.
Se corre desde la carpeta quipu-celular. Se puede correr más de una vez sin duplicar nada."""
from pathlib import Path

WWW = Path("www")
RESPALDOS = Path("respaldos")

NUBE_JS = r'''// La nube de las notas compartidas: habla con Firebase (Firestore) igual que la compu,
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
    try {
      respuesta = await fetch(url, opciones);
    } catch (e) {
      throw new NubeError("Sin conexión a internet");
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

  // Sube la nota y devuelve el momento en que quedó guardada.
  async function subir(codigo, titulo, html, texto) {
    const s = await sesion();
    const cambiado = Date.now() / 1000;
    const campos = { fields: {
      titulo: { stringValue: titulo || "" }, html: { stringValue: html || "" },
      texto: { stringValue: texto || "" }, cambiado: { doubleValue: cambiado },
      autor: { stringValue: s.uid },
    } };
    const { estado } = await pedir("PATCH", direccion(codigo), { datos: campos, token: s.token });
    if (estado === 403) throw new NubeError("La nota es muy pesada para compartir (¿muchas fotos?)");
    if (estado !== 200) throw new NubeError(`La nube respondió ${estado}`);
    return cambiado;
  }

  const mensaje = (error) => (error instanceof NubeError ? error.message : "Algo salió mal con la nube");

  window.NUBE = { normalizar, codigoLibre, subir, bajar, mensaje };
})();
'''

FUNCIONES_COLABORAR = r'''  // --- Colaborar con un código (la misma nube que la compu) ---
  const conGuion = (c) => c.slice(0, 4) + "-" + c.slice(4);
  const mensajeColab = (t) => { const m = document.getElementById("no-colab-mensaje"); if (m) m.textContent = t; };

  // Limpia el HTML que llega de la nube: deja el formato y las fotos, saca todo lo que pueda ejecutarse.
  function limpiarHtml(html) {
    const doc = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
    doc.querySelectorAll("script, style, iframe, object, embed, link, meta, form, input, button, textarea, select")
      .forEach((e) => e.remove());
    doc.querySelectorAll("*").forEach((e) => {
      [...e.attributes].forEach((a) => {
        const nombre = a.name.toLowerCase();
        const valor = a.value.trim().toLowerCase();
        if (nombre.startsWith("on")) e.removeAttribute(a.name);
        else if (nombre === "src" && !valor.startsWith("data:image/")) e.removeAttribute(a.name);
        else if (nombre === "href" && !valor.startsWith("http")) e.removeAttribute(a.name);
      });
    });
    return doc.body.firstChild.innerHTML;
  }

  function abrirColaborar() {
    const panel = document.getElementById("no-panel");
    const pie = `<p class="tf-mensaje" id="no-colab-mensaje"></p>
      <div class="tf-fila tf-final"><button class="tf-boton secundario" id="no-cerrar-panel">Volver a la nota</button></div>`;
    if (nota && nota.codigo) {
      panel.innerHTML = `
        <p class="tf-etiqueta">Nota compartida</p>
        <p class="no-codigo">${conGuion(nota.codigo)}</p>
        <p class="tf-mensaje">Quien tenga este código puede verla y escribir en ella. Los cambios se comparten solos.</p>
        <div class="tf-fila">
          <button class="tf-boton" id="no-mandar-codigo">Mandar código</button>
          <button class="tf-boton secundario" id="no-copiar-codigo">Copiar</button>
        </div>` + pie;
    } else {
      panel.innerHTML = `
        <p class="tf-etiqueta">Compartir esta nota</p>
        <button class="tf-boton" id="no-generar">Generar código</button>
        <p class="tf-etiqueta">¿Te pasaron un código?</p>
        <div class="tf-fila">
          <input id="no-entrada" class="tf-campo" maxlength="9" placeholder="XXXX-XXXX" autocapitalize="characters" autocomplete="off">
          <button class="tf-boton" id="no-unirme">Unirme</button>
        </div>` + pie;
    }
    panel.hidden = false;
    const $ = (id) => document.getElementById(id);
    $("no-cerrar-panel").onclick = () => { panel.hidden = true; };
    if ($("no-generar")) $("no-generar").onclick = generarCodigo;
    if ($("no-unirme")) $("no-unirme").onclick = unirme;
    if ($("no-entrada")) $("no-entrada").onkeydown = (e) => { if (e.key === "Enter") unirme(); };
    if ($("no-mandar-codigo")) $("no-mandar-codigo").onclick = mandarCodigo;
    if ($("no-copiar-codigo")) $("no-copiar-codigo").onclick = copiarCodigo;
  }

  async function generarCodigo() {
    guardarAhora();
    if (!nota) return mensajeColab("Escribí algo antes de compartir");
    const boton = document.getElementById("no-generar");
    boton.disabled = true;
    mensajeColab("Generando…");
    anunciar("Compartiendo");
    try {
      const codigo = await NUBE.codigoLibre();
      const cambiado = await NUBE.subir(codigo, nota.titulo, nota.html, nota.texto);
      Object.assign(nota, { codigo, remoto: cambiado, modificada: ahora() });
      guardarTodo();
      anunciar("¡Lista para compartir!");
      abrirColaborar();
    } catch (error) {
      boton.disabled = false;
      mensajeColab(NUBE.mensaje(error));
    }
  }

  async function unirme() {
    const codigo = NUBE.normalizar(document.getElementById("no-entrada").value);
    if (codigo.length !== 8) return mensajeColab("El código tiene 8 letras y números");
    const existente = base.notas.find((n) => n.codigo === codigo && !n.borrada);
    if (existente) return abrirNota(existente.uid);
    mensajeColab("Buscando…");
    anunciar("Buscando");
    try {
      const d = await NUBE.bajar(codigo);
      if (!d) return mensajeColab("No encontré ninguna nota con ese código");
      const nueva = {
        uid: nuevoId(), carpeta: null, titulo: d.titulo || "", html: limpiarHtml(d.html), texto: d.texto || "",
        fijada: 0, borrada: 0, creada: ahora(), modificada: ahora(), orden: 0,
        codigo, remoto: d.cambiado,
      };
      base.notas.push(nueva);
      guardarTodo();
      anunciar("¡Ya están conectados!");
      abrirNota(nueva.uid);
    } catch (error) {
      mensajeColab(NUBE.mensaje(error));
    }
  }

  async function mandarCodigo() {
    const texto = `Te comparto una nota de Quipu. Para abrirla, andá a Notas → Colaborar y poné el código ${conGuion(nota.codigo)}`;
    const Share = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
    try {
      if (Share) return await Share.share({ title: "Nota compartida de Quipu", text: texto });
    } catch (error) {
      if (String(error).includes("cancel")) return;
    }
    copiarCodigo();
  }

  async function copiarCodigo() {
    try {
      await navigator.clipboard.writeText(conGuion(nota.codigo));
      mensajeColab("¡Copiado!");
    } catch (error) {
      mensajeColab("No pude copiarlo");
    }
  }

  // Cada vez que se guarda una nota compartida, se sube a la nube.
  async function subirCompartida(n) {
    if (!n || !n.codigo) return;
    try {
      n.remoto = await NUBE.subir(n.codigo, n.titulo, n.html, n.texto);
      guardarTodo();
    } catch (error) {
      anunciar("No pude subir la nota compartida: " + NUBE.mensaje(error));
    }
  }

  // Con una nota compartida abierta, cada 10 segundos se fija si la otra persona la cambió.
  let revisando = false;
  setInterval(async () => {
    const textoEl = document.getElementById("no-texto");
    const tituloEl = document.getElementById("no-titulo");
    if (!abierto || !nota || !nota.codigo || !textoEl || revisando) return;
    if (textoEl.innerHTML !== nota.html || tituloEl.value.trim() !== nota.titulo) return;   // hay algo sin guardar
    revisando = true;
    const actual = nota;
    try {
      const d = await NUBE.bajar(actual.codigo);
      if (!d || d.cambiado <= (actual.remoto || 0) + 0.001) return;
      Object.assign(actual, { titulo: d.titulo || "", html: limpiarHtml(d.html), texto: d.texto || "",
                              remoto: d.cambiado, modificada: ahora() });
      guardarTodo();
      if (nota === actual && document.getElementById("no-texto") === textoEl) {
        tituloEl.value = actual.titulo;
        textoEl.innerHTML = actual.html;
      }
      anunciar("Nota compartida actualizada");
    } catch (error) {
      // Sin internet: se vuelve a probar en la próxima vuelta.
    } finally {
      revisando = false;
    }
  }, 10000);

'''

CSS_CODIGO = '''
/* El código de una nota compartida, grande y fácil de dictar */
.no-codigo {
  margin: 1cqw 0;
  text-align: center;
  font-family: "Consolas", monospace;
  font-size: 8cqw;
  font-weight: 600;
  letter-spacing: 1cqw;
}
'''


def leer(ruta):
    crudo = ruta.read_bytes().decode("utf-8-sig")
    fin = "\r\n" if "\r\n" in crudo else "\n"
    return crudo.replace("\r\n", "\n"), fin, crudo


def escribir(ruta, texto, fin, original):
    RESPALDOS.mkdir(exist_ok=True)
    (RESPALDOS / (ruta.name + ".antes")).write_text(original, encoding="utf-8", newline="")
    ruta.write_text(texto.replace("\n", fin), encoding="utf-8", newline="")


def editar(ruta, cambios):
    """cambios: lista de (nombre, viejo, nuevo[, marca]). Cada uno se aplica solo si todavía no está."""
    texto, fin, original = leer(ruta)
    nuevo_texto = texto
    for nombre, viejo, nuevo, *marca in cambios:
        if (marca[0] if marca else nuevo) in nuevo_texto:
            print(f"  {ruta}: {nombre} ya estaba")
            continue
        if viejo not in nuevo_texto:
            raise SystemExit(f"  ERROR en {ruta}: no encontré dónde va «{nombre}». No cambié nada en este archivo.")
        nuevo_texto = nuevo_texto.replace(viejo, nuevo, 1)
        print(f"  {ruta}: {nombre} listo")
    if nuevo_texto != texto:
        escribir(ruta, nuevo_texto, fin, original)


def main():
    if not (WWW / "funciones" / "notas.js").exists():
        raise SystemExit("Corré este script desde la carpeta quipu-celular.")
    print("Notas compartidas en el celu:")

    # 1. El módulo de la nube
    nube = WWW / "funciones" / "nube.js"
    if nube.exists():
        print(f"  {nube}: ya existía, no lo toqué")
    else:
        nube.write_text(NUBE_JS, encoding="utf-8")
        print(f"  {nube}: creado")

    # 2. Cargarlo en index.html, antes de notas.js
    editar(WWW / "index.html", [
        ("cargar nube.js",
         '<script src="funciones/notas.js"></script>',
         '<script src="funciones/nube.js"></script><script src="funciones/notas.js"></script>',
         'funciones/nube.js'),
    ])

    # 3. Notas: el botón, la subida al guardar y las funciones de colaborar
    editar(WWW / "funciones" / "notas.js", [
        ("botón Colaborar",
         '      anunciar("Colaborar llega con la sincronización");',
         '      abrirColaborar();',
         'nombre === "colaborar") {\n      abrirColaborar();'),
        ("subir al guardar",
         '    guardarTodo();\n    anunciar("Guardado");\n  }',
         '    guardarTodo();\n    anunciar("Guardado");\n    subirCompartida(nota);\n  }',
         "subirCompartida(nota);"),
        ("panel de colaborar",
         '  function textoParaCompartir() {',
         FUNCIONES_COLABORAR + '  function textoParaCompartir() {',
         "function abrirColaborar()"),
    ])

    # 4. El estilo del código grande
    css = WWW / "funciones" / "notas.css"
    texto, fin, original = leer(css)
    if ".no-codigo" in texto:
        print(f"  {css}: estilo del código ya estaba")
    else:
        escribir(css, texto.rstrip("\n") + "\n" + CSS_CODIGO, fin, original)
        print(f"  {css}: estilo del código listo")

    print("Terminado. Copias de lo anterior en la carpeta respaldos.")


if __name__ == "__main__":
    main()