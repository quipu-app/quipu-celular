"""Publica Quipu para celular 1.2.3: sube el código a GitHub, te guía con el release, comprueba que
quedó publicado y recién ahí avisa la versión nueva en la página (novedades.json).
Se corre desde la carpeta quipu-celular, con el APK de la 1.2.3 ya armado en publicar\\Quipu.apk."""
import json
import shutil
import subprocess
import time
import urllib.request
import zipfile
from pathlib import Path

VERSION = "1.2.3"
RESUMEN = "Conexión con Drive más firme: repara tu archivo si se daña y avisa si algo falla"
NOTAS_RELEASE = ("Conexión con Google Drive más firme: si Google no responde, Quipu ya no se queda esperando; "
                 "si el archivo de Drive se daña, lo repara solo; y en Ajustes muestra qué pasó si algo falla. "
                 "Instalala encima: no se borra nada.")
APK = Path("publicar") / "Quipu.apk"
PAGINA = Path.cwd().parent / "pagina-web"
REPO_PAGINA = "https://github.com/quipu-app/quipu-app.github.io.git"


def correr(comando, carpeta=None):
    print(f"\n> {comando}")
    if subprocess.run(comando, shell=True, cwd=carpeta).returncode != 0:
        raise SystemExit(f"\nFALLÓ: {comando}\nRevisá el mensaje de arriba. No se siguió con lo demás.")


def leer_web(url):
    pedido = urllib.request.Request(url, headers={"User-Agent": "quipu-publicar", "Cache-Control": "no-cache"})
    with urllib.request.urlopen(pedido, timeout=30) as r:
        return r.read().decode("utf-8")


def comprobar_apk():
    if not APK.exists():
        raise SystemExit("No hay APK en publicar\\. Primero corré: python aplicar_1_2_3c.py")
    with zipfile.ZipFile(APK) as z:
        a = lambda r: z.read(f"assets/public/{r}").decode("utf-8")
        ajustes, sincro = a("funciones/ajustes.js"), a("funciones/sincronizacion.js")
    pruebas = {
        f"es la {VERSION}": f'QUIPU_VERSION = "{VERSION}"' in ajustes,
        "tiene el botón Elegir": '$("aj-elegir").onclick = () => elegir(c.id);' in ajustes,
        "repara el archivo de Drive": "const repararJson =" in sincro,
        "no se traba esperando a Google": "conLimite(L.login" in sincro,
    }
    print("Comprobando el APK antes de publicar:")
    for prueba, ok in pruebas.items():
        print(f"  {'OK ' if ok else 'MAL'}  {prueba}")
    if not all(pruebas.values()):
        raise SystemExit("\nEse APK no es el correcto. Volvé a correr: python aplicar_1_2_3c.py")


def subir_codigo():
    correr("git add -A")
    if subprocess.run("git diff --cached --quiet", shell=True).returncode != 0:
        correr(f'git commit -m "Versión {VERSION}: conexión con Drive más firme"')
    correr("git push")
    if subprocess.run(f"git rev-parse -q --verify refs/tags/v{VERSION}", shell=True, capture_output=True).returncode:
        correr(f"git tag v{VERSION}")
    correr(f"git push origin v{VERSION}")


def esperar_release():
    destino = Path.home() / "Quipu.apk"
    shutil.copy(APK, destino)
    print(f"""
El código ya está en GitHub. Ahora el release, desde la web:
  1. Entrá a https://github.com/quipu-app/quipu-celular/releases/new?tag=v{VERSION}
  2. Título: Quipu {VERSION}
  3. Descripción: {NOTAS_RELEASE}
  4. Arrastrá {destino} (ya te lo copié ahí).
  5. Tocá "Publish release".""")
    while True:
        input("\nCuando hayas tocado Publish release, apretá Enter…")
        try:
            ultimo = json.loads(leer_web("https://api.github.com/repos/quipu-app/quipu-celular/releases/latest"))
            if ultimo.get("tag_name") == f"v{VERSION}" and any(a.get("name") == "Quipu.apk" for a in ultimo.get("assets", [])):
                print(f"  OK  el release v{VERSION} está publicado con su Quipu.apk")
                return
            print(f"  Todavía no lo veo: el último release es {ultimo.get('tag_name')}. "
                  "Fijate que esté publicado (no como borrador) y que el archivo se llame Quipu.apk.")
        except Exception as error:
            print(f"  No pude revisar GitHub ({error}). Probá de nuevo en un momento.")


def avisar_en_pagina():
    if PAGINA.exists():
        correr("git checkout -- .", carpeta=PAGINA)        # descarta cualquier cambio a medias
        correr("git pull --ff-only", carpeta=PAGINA)
    else:
        correr(f'git clone {REPO_PAGINA} "{PAGINA}"')
    archivo = PAGINA / "novedades.json"
    datos = json.loads(archivo.read_text(encoding="utf-8-sig"))
    datos["android"].update(version=VERSION, resumen=RESUMEN)
    archivo.write_text(json.dumps(datos, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    correr("git add novedades.json", carpeta=PAGINA)
    if subprocess.run("git diff --cached --quiet", shell=True, cwd=PAGINA).returncode != 0:
        correr(f'git commit -m "Novedades: versión {VERSION} del celu"', carpeta=PAGINA)
    correr("git push", carpeta=PAGINA)
    for _ in range(6):
        try:
            en_github = json.loads(leer_web(
                f"https://raw.githubusercontent.com/quipu-app/quipu-app.github.io/main/novedades.json?x={time.time()}"))
            if en_github["android"]["version"] == VERSION:
                print(f"\n  OK  novedades.json en GitHub dice {VERSION}")
                print(f"\nListo. En unos minutos, quien tenga la 1.2.1 o la 1.2.2 va a ver el aviso de la {VERSION}.")
                return
        except Exception:
            pass
        time.sleep(10)
    print("\nSubí novedades.json, pero todavía no lo veo actualizado en GitHub. Avisame y lo reviso.")


if __name__ == "__main__":
    if not Path("www/funciones/ajustes.js").exists():
        raise SystemExit("Corré este script desde la carpeta quipu-celular.")
    comprobar_apk()
    subir_codigo()
    esperar_release()
    avisar_en_pagina()