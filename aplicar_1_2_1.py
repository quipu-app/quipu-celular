"""Quipu para celular 1.2.1: arreglos de las notas compartidas, quién hizo cada cambio, marca en la lista,
versión 1.2.1, y compilación firmada y comprobada.

Uso, desde la carpeta quipu-celular:
    python aplicar_1_2_1.py            -> aplica los cambios, sube la versión y arma el APK firmado
    python aplicar_1_2_1.py publicar   -> sube el código a GitHub y publica el release v1.2.1
Se puede correr más de una vez sin duplicar nada."""
import os
import re
import shutil
import subprocess
import sys
import zipfile
from pathlib import Path

VERSION = "1.2.1"
WWW = Path("www")
RESPALDOS = Path("respaldos")
APK = Path("publicar") / "Quipu.apk"
LLAVE = Path.home() / "ClavesQuipu" / "quipu-firma.jks"
HUELLA = "e7dbb4c3271baddaa637a34fde7b2f4a5a662469"
NOTAS_RELEASE = ("Notas compartidas mediante código: generá un código en una nota, pasáselo a quien quieras "
                 "y escriban la misma nota, cada uno desde su aparato (también entre la compu y el celu). "
                 "Además, Quipu ahora avisa cuando hay una versión nueva.")


# ---------------------------------------------------------------- herramientas para editar
def leer(ruta):
    crudo = ruta.read_bytes().decode("utf-8-sig")
    fin = "\r\n" if "\r\n" in crudo else "\n"
    return crudo.replace("\r\n", "\n"), fin, crudo


def escribir(ruta, texto, fin, original):
    RESPALDOS.mkdir(exist_ok=True)
    (RESPALDOS / (ruta.name + ".antes-1.2.1")).write_text(original, encoding="utf-8", newline="")
    ruta.write_text(texto.replace("\n", fin), encoding="utf-8", newline="")


def editar(ruta, cambios):
    """cambios: lista de (nombre, viejo, nuevo, marca). Si la marca ya está, ese cambio se saltea."""
    texto, fin, original = leer(ruta)
    nuevo_texto = texto
    for nombre, viejo, nuevo, marca in cambios:
        if marca in nuevo_texto:
            print(f"  {ruta}: {nombre} ya estaba")
            continue
        if viejo not in nuevo_texto:
            raise SystemExit(f"\nERROR en {ruta}: no encontré dónde va «{nombre}». No cambié nada en este archivo.")
        nuevo_texto = nuevo_texto.replace(viejo, nuevo, 1)
        print(f"  {ruta}: {nombre} listo")
    if nuevo_texto != texto:
        escribir(ruta, nuevo_texto, fin, original)


def reemplazar_bloque(ruta, nombre, desde, hasta, nuevo, marca):
    """Reemplaza el pedazo que va desde «desde» hasta «hasta» (incluido)."""
    texto, fin, original = leer(ruta)
    if marca in texto:
        print(f"  {ruta}: {nombre} ya estaba")
        return
    i = texto.find(desde)
    j = texto.find(hasta, i) if i >= 0 else -1
    if i < 0 or j < 0:
        raise SystemExit(f"\nERROR en {ruta}: no encontré «{nombre}». No cambié nada en este archivo.")
    texto_nuevo = texto[:i] + nuevo + texto[j + len(hasta):]
    escribir(ruta, texto_nuevo, fin, original)
    print(f"  {ruta}: {nombre} listo")


# ---------------------------------------------------------------- los cambios de código
NUBE_ESPERA_VIEJO = '''    try {
      respuesta = await fetch(url, opciones);
    } catch (e) {
      throw new NubeError("Sin conexión a internet");
    }'''
NUBE_ESPERA_NUEVO = '''    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 15000);   // si la red se cuelga, no esperar para siempre
    opciones.signal = corte.signal;
    try {
      respuesta = await fetch(url, opciones);
    } catch (e) {
      throw new NubeError("Sin conexión a internet");
    } finally {
      clearTimeout(reloj);
    }'''

NUBE_SUBIR_VIEJO = '''  // Sube la nota y devuelve el momento en que quedó guardada.
  async function subir(codigo, titulo, html, texto) {
    const s = await sesion();
    const cambiado = Date.now() / 1000;
    const campos = { fields: {
      titulo: { stringValue: titulo || "" }, html: { stringValue: html || "" },
      texto: { stringValue: texto || "" }, cambiado: { doubleValue: cambiado },
      autor: { stringValue: s.uid },
    } };
    const { estado } = await pedir("PATCH", direccion(codigo), { datos: campos, token: s.token });
    if (estado === 403) throw new NubeError("La nota es muy pesada para compartir (¿muchas fotos?)");'''
NUBE_SUBIR_NUEVO = '''  // El nombre que pusiste en Ajustes, para que los demás vean quién cambió la nota.
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
    if (estado === 403) throw new NubeError("La nota es muy pesada para compartir (¿muchas fotos?)");'''

REVISAR_NUEVO = '''  // ¿Hay algo escrito que todavía no se guardó? ¿Se está subiendo algo ahora mismo?
  let sinGuardar = false;
  let subiendo = 0;
  let revisando = false;

  // "Eli, hoy 16:09": quién hizo el último cambio de la nota compartida y cuándo.
  function ultimoCambio() {
    if (!nota || !nota.codigo || !nota.remoto) return "";
    const f = new Date(nota.remoto * 1000);
    const hora = f.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
    const dia = new Date().toDateString() === f.toDateString() ? "hoy" : f.toLocaleDateString("es-AR");
    const quien = nota.ultimoMio ? "vos" : (nota.ultimoNombre || "otra persona");
    return `${escapar(quien)}, ${dia} ${hora}`;
  }

  // La línea fija arriba de una nota compartida: el ícono, el código y el último cambio.
  function dibujarLineaCompartida() {
    const linea = document.getElementById("no-compartida");
    if (!linea) return;
    if (!nota || !nota.codigo) { linea.hidden = true; return; }
    const ultimo = ultimoCambio();
    linea.innerHTML = `<span class="no-icono" aria-hidden="true">${ICONO.colaborar}</span>` +
      `<span>Compartida ${conGuion(nota.codigo)}${ultimo ? " · Último cambio: " + ultimo : ""}</span>`;
    linea.hidden = false;
  }

  // Se fija en la nube si la otra persona cambió la nota abierta.
  async function revisarNube() {
    const textoEl = document.getElementById("no-texto");
    const tituloEl = document.getElementById("no-titulo");
    if (!abierto || !nota || !nota.codigo || !textoEl || revisando || sinGuardar || subiendo) return;
    revisando = true;
    const actual = nota;
    const remotoAntes = actual.remoto;
    try {
      const d = await NUBE.bajar(actual.codigo);
      // Cualquier subida distinta de la última que conocemos es un cambio de otra persona.
      // No se compara "más nuevo", porque la compu y el celu pueden tener la hora un poco distinta.
      if (!d || Math.abs(d.cambiado - (actual.remoto || 0)) < 0.0005) return;
      if (sinGuardar || subiendo || actual.remoto !== remotoAntes) return;   // mientras tanto escribiste: gana lo tuyo
      Object.assign(actual, { titulo: d.titulo || "", html: limpiarHtml(d.html), texto: d.texto || "",
                              remoto: d.cambiado, ultimoNombre: d.nombre || "", ultimoMio: false, modificada: ahora() });
      guardarTodo();
      if (nota === actual && document.getElementById("no-texto") === textoEl) {
        tituloEl.value = actual.titulo;
        textoEl.innerHTML = actual.html;
        dibujarLineaCompartida();
      }
      anunciar(d.nombre ? `${d.nombre} cambió la nota` : "Nota compartida actualizada");
    } catch (error) {
      // Sin internet: se vuelve a probar en la próxima vuelta.
    } finally {
      revisando = false;
    }
  }

  // Cada 10 segundos con la nota abierta, y también apenas volvés a la app.
  setInterval(revisarNube, 10000);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") setTimeout(revisarNube, 500);
  });
'''

SUBIR_COMPARTIDA_VIEJO = '''  async function subirCompartida(n) {
    if (!n || !n.codigo) return;
    try {
      n.remoto = await NUBE.subir(n.codigo, n.titulo, n.html, n.texto);
      guardarTodo();
    } catch (error) {
      anunciar("No pude subir la nota compartida: " + NUBE.mensaje(error));
    }
  }'''
SUBIR_COMPARTIDA_NUEVO = '''  async function subirCompartida(n) {
    if (!n || !n.codigo) return;
    subiendo++;
    try {
      n.remoto = await NUBE.subir(n.codigo, n.titulo, n.html, n.texto);
      n.ultimoMio = true;
      guardarTodo();
      if (n === nota) dibujarLineaCompartida();
    } catch (error) {
      anunciar("No pude subir la nota compartida: " + NUBE.mensaje(error));
    } finally {
      subiendo--;
    }
  }'''

CSS_NUEVO = '''
/* Notas compartidas: la línea fija arriba de la nota y la marca en la lista */
.no-compartida {
  flex: none;
  display: flex;
  align-items: center;
  gap: 1.2cqw;
  font-size: 3cqw;
  opacity: 0.85;
  white-space: nowrap;
  overflow: hidden;
}
.no-compartida span:last-child { overflow: hidden; text-overflow: ellipsis; }
.no-compartida[hidden] { display: none; }
.no-marca-compartida { opacity: 0.85; }
'''


def aplicar_cambios():
    notas = WWW / "funciones" / "notas.js"
    if "function abrirColaborar()" not in leer(notas)[0]:
        raise SystemExit("Primero hay que correr aplicar_colaborar.py (falta el panel de colaborar).")

    print("\n1. La nube (nube.js): espera máxima y tu nombre en cada cambio")
    nube = WWW / "funciones" / "nube.js"
    editar(nube, [
        ("espera máxima", NUBE_ESPERA_VIEJO, NUBE_ESPERA_NUEVO, "corte.abort()"),
        ("tu nombre", NUBE_SUBIR_VIEJO, NUBE_SUBIR_NUEVO, "function miNombre()"),
        ("compartir miNombre",
         "window.NUBE = { normalizar, codigoLibre, subir, bajar, mensaje };",
         "window.NUBE = { normalizar, codigoLibre, subir, bajar, mensaje, miNombre };",
         "mensaje, miNombre }"),
    ])

    print("\n2. Notas (notas.js)")
    reemplazar_bloque(notas, "revisión arreglada",
                      "  // Con una nota compartida abierta, cada 10 segundos", "  }, 10000);\n",
                      REVISAR_NUEVO, "async function revisarNube()")
    editar(notas, [
        ("subida que avisa", SUBIR_COMPARTIDA_VIEJO, SUBIR_COMPARTIDA_NUEVO, "subiendo++"),
        ("guardado pendiente (1)",
         "  function programarGuardado() {\n    clearTimeout(relojGuardar);",
         "  function programarGuardado() {\n    sinGuardar = true;\n    clearTimeout(relojGuardar);",
         "    sinGuardar = true;\n    clearTimeout(relojGuardar);"),
        ("guardado pendiente (2)",
         "  function guardarAhora() {\n    clearTimeout(relojGuardar);",
         "  function guardarAhora() {\n    sinGuardar = false;\n    clearTimeout(relojGuardar);",
         "    sinGuardar = false;\n    clearTimeout(relojGuardar);"),
        ("línea de compartida en la nota",
         '        <div class="no-herramientas desplazable" id="no-herramientas" hidden>',
         '        <div class="no-compartida" id="no-compartida" hidden></div>\n'
         '        <div class="no-herramientas desplazable" id="no-herramientas" hidden>',
         'id="no-compartida"'),
        ("revisar al abrir la nota",
         '    if (!nota) setTimeout(() => $("no-titulo").focus(), 300);\n  }',
         '    if (!nota) setTimeout(() => $("no-titulo").focus(), 300);\n'
         '    dibujarLineaCompartida();\n'
         '    if (nota && nota.codigo) setTimeout(revisarNube, 300);\n  }',
         "if (nota && nota.codigo) setTimeout(revisarNube, 300);"),
        ("marca en la lista",
         "        ${n.fijada ? '<span class=\"no-estrella\">★</span>' : \"\"}",
         "        ${n.codigo ? `<span class=\"no-icono no-marca-compartida\" aria-label=\"Compartida\">${ICONO.colaborar}</span>` : \"\"}\n"
         "        ${n.fijada ? '<span class=\"no-estrella\">★</span>' : \"\"}",
         "no-marca-compartida"),
        ("último cambio en el panel",
         '        <p class="no-codigo">${conGuion(nota.codigo)}</p>',
         '        <p class="no-codigo">${conGuion(nota.codigo)}</p>\n'
         '        ${ultimoCambio() ? `<p class="tf-mensaje">Último cambio: ${ultimoCambio()}</p>` : ""}\n'
         '        ${NUBE.miNombre() ? "" : `<p class="tf-mensaje">Poné tu nombre en Ajustes para que los demás vean quién hizo cada cambio.</p>`}',
         "Poné tu nombre en Ajustes para que los demás"),
        ("al generar el código",
         "      Object.assign(nota, { codigo, remoto: cambiado, modificada: ahora() });",
         "      Object.assign(nota, { codigo, remoto: cambiado, ultimoMio: true, modificada: ahora() });",
         "remoto: cambiado, ultimoMio: true"),
        ("al unirse",
         "        codigo, remoto: d.cambiado,\n",
         "        codigo, remoto: d.cambiado, ultimoNombre: d.nombre || \"\", ultimoMio: false,\n",
         "codigo, remoto: d.cambiado, ultimoNombre"),
    ])

    print("\n3. Estilos (notas.css)")
    css = WWW / "funciones" / "notas.css"
    texto, fin, original = leer(css)
    if ".no-compartida" in texto:
        print(f"  {css}: estilos ya estaban")
    else:
        escribir(css, texto.rstrip("\n") + "\n" + CSS_NUEVO, fin, original)
        print(f"  {css}: estilos listos")

    print(f"\n4. Versión {VERSION}")
    ajustes = WWW / "funciones" / "ajustes.js"
    texto, fin, original = leer(ajustes)
    nuevo = re.sub(r'window\.QUIPU_VERSION = "[^"]*"', f'window.QUIPU_VERSION = "{VERSION}"', texto, count=1)
    if nuevo != texto:
        escribir(ajustes, nuevo, fin, original)
    print(f"  {ajustes}: versión {VERSION}")
    gradle = Path("android") / "app" / "build.gradle"
    texto, fin, original = leer(gradle)
    if f'versionName "{VERSION}"' not in texto:
        codigo = int(re.search(r"versionCode (\d+)", texto).group(1)) + 1
        texto_nuevo = re.sub(r"versionCode \d+", f"versionCode {codigo}", texto, count=1)
        texto_nuevo = re.sub(r'versionName "[^"]*"', f'versionName "{VERSION}"', texto_nuevo, count=1)
        escribir(gradle, texto_nuevo, fin, original)
        print(f"  {gradle}: versionCode {codigo}, versionName {VERSION}")
    else:
        print(f"  {gradle}: ya estaba en {VERSION}")


# ---------------------------------------------------------------- compilar, firmar y comprobar
def correr(comando, carpeta=None, entorno=None):
    print(f"\n> {comando}")
    r = subprocess.run(comando, shell=True, cwd=carpeta, env=entorno)
    if r.returncode != 0:
        raise SystemExit(f"\nFALLÓ: {comando}\nRevisá el mensaje de arriba. No se siguió con lo demás.")


def herramientas_android():
    base = Path(os.environ["LOCALAPPDATA"]) / "Android" / "Sdk" / "build-tools"
    carpetas = [c for c in base.iterdir() if c.is_dir() and re.match(r"^\d+(\.\d+)*$", c.name)]
    return max(carpetas, key=lambda c: tuple(int(x) for x in c.name.split(".")))


def compilar():
    if not LLAVE.exists():
        raise SystemExit(f"No encuentro la llave de firma en {LLAVE}.")
    entorno = dict(os.environ, JAVA_HOME=str(next(Path(r"C:\Program Files\Eclipse Adoptium").glob("jdk-21*"))))
    correr("npx cap sync android")
    correr("gradlew.bat assembleRelease", carpeta="android", entorno=entorno)

    salida = Path("android/app/build/outputs/apk/release")
    sin_firmar, alineado = salida / "app-release-unsigned.apk", salida / "app-release-alineado.apk"
    APK.parent.mkdir(exist_ok=True)
    if APK.exists():
        APK.unlink()                       # así nunca queda uno viejo haciéndose pasar por nuevo
    h = herramientas_android()
    correr(f'"{h / "zipalign.exe"}" -p -f 4 "{sin_firmar}" "{alineado}"')
    print("\nAhora te pide la contraseña de la llave (no se ve mientras la escribís):")
    correr(f'"{h / "apksigner.bat"}" sign --ks "{LLAVE}" --ks-key-alias quipu --out "{APK}" "{alineado}"')

    print("\nComprobando el APK…")
    firma = subprocess.run(f'"{h / "apksigner.bat"}" verify --print-certs "{APK}"',
                           shell=True, capture_output=True, text=True).stdout.lower()
    with zipfile.ZipFile(APK) as z:
        notas_js = z.read("assets/public/funciones/notas.js").decode("utf-8")
        ajustes_js = z.read("assets/public/funciones/ajustes.js").decode("utf-8")
    pruebas = {
        "firmado con tu llave de siempre": HUELLA in firma,
        f"dice versión {VERSION}": f'QUIPU_VERSION = "{VERSION}"' in ajustes_js,
        "tiene las notas compartidas arregladas": "async function revisarNube()" in notas_js,
        "tiene la marca de compartida en la lista": "no-marca-compartida" in notas_js,
    }
    for prueba, ok in pruebas.items():
        print(f"  {'OK ' if ok else 'MAL'}  {prueba}")
    if not all(pruebas.values()):
        raise SystemExit("\nEl APK no pasó la comprobación. No lo instales ni lo publiques.")
    print(f"\nTodo bien. El APK está en {APK.resolve()}")
    subprocess.run(f'explorer "{APK.parent.resolve()}"', shell=True)


# ---------------------------------------------------------------- publicar
def publicar():
    if not APK.exists():
        raise SystemExit("No hay APK en publicar\\. Primero corré: python aplicar_1_2_1.py")
    with zipfile.ZipFile(APK) as z:
        if f'QUIPU_VERSION = "{VERSION}"' not in z.read("assets/public/funciones/ajustes.js").decode("utf-8"):
            raise SystemExit(f"El APK de publicar\\ no es la {VERSION}. Volvé a correr: python aplicar_1_2_1.py")

    ignorar = Path(".gitignore")
    texto = ignorar.read_text(encoding="utf-8-sig") if ignorar.exists() else ""
    faltan = [l for l in ("publicar/", "respaldos/", "aplicar_*.py") if l not in texto.splitlines()]
    if faltan:
        ignorar.write_text(texto.rstrip("\n") + "\n" + "\n".join(faltan) + "\n", encoding="utf-8")

    correr("git add -A")
    hay_cambios = subprocess.run("git diff --cached --quiet", shell=True).returncode != 0
    if hay_cambios:
        correr(f'git commit -m "Versión {VERSION}: notas compartidas con código y aviso de versiones nuevas"')
    correr("git push")
    if subprocess.run(f"git rev-parse -q --verify refs/tags/v{VERSION}", shell=True,
                      capture_output=True).returncode != 0:
        correr(f"git tag v{VERSION}")
    correr(f"git push origin v{VERSION}")

    if shutil.which("gh") and subprocess.run("gh auth status", shell=True, capture_output=True).returncode == 0:
        correr(f'gh release create v{VERSION} "{APK}" --repo quipu-app/quipu-celular '
               f'--title "Quipu {VERSION}" --notes "{NOTAS_RELEASE}"')
        print(f"\nPublicado. El botón de la página ya baja la {VERSION}.")
    else:
        escritorio = Path.home() / "Desktop"
        destino = (escritorio if escritorio.exists() else Path.home()) / "Quipu.apk"
        shutil.copy(APK, destino)
        print(f"""
El código ya está en GitHub. Falta el release, que se hace desde la página de GitHub:
  1. Entrá a https://github.com/quipu-app/quipu-celular/releases/new?tag=v{VERSION}
  2. Título: Quipu {VERSION}
  3. Descripción: {NOTAS_RELEASE}
  4. Arrastrá el archivo {destino} (ya te lo copié ahí).
  5. Tocá "Publish release".""")


if __name__ == "__main__":
    if not (WWW / "funciones" / "notas.js").exists():
        raise SystemExit("Corré este script desde la carpeta quipu-celular.")
    if len(sys.argv) > 1 and sys.argv[1] == "publicar":
        publicar()
    else:
        aplicar_cambios()
        compilar()