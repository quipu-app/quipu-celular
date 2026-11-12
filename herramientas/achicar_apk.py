"""Achica la app del celu: saca las imágenes que no usa y pasa las que sí a WebP.
Lo que se saca va a respaldos/assets_quitados (fuera de www), por si hiciera falta volver atrás.
Se puede correr más de una vez sin problema."""
import shutil
from pathlib import Path

from PIL import Image

ASSETS = Path("www/assets")
GUARDADO = Path("respaldos/assets_quitados")


def tamano(carpeta):
    return sum(f.stat().st_size for f in carpeta.rglob("*") if f.is_file()) / 1024 / 1024


def guardar_aparte(archivo):
    destino = GUARDADO / archivo.relative_to(ASSETS)
    destino.parent.mkdir(parents=True, exist_ok=True)
    shutil.move(str(archivo), str(destino))


antes = tamano(ASSETS)

# 1. Lo que la app del celu no usa: las consolas de la compu, una copia repetida y la placa
quitar = list(ASSETS.glob("personajes/*/consola/*")) + list(ASSETS.glob("personajes/moreira/celular/*"))
quitar += [ASSETS / "marca" / "placa.png"]
for archivo in quitar:
    if archivo.exists():
        guardar_aparte(archivo)
for carpeta in list(ASSETS.glob("personajes/*/consola")) + [ASSETS / "personajes" / "moreira" / "celular"]:
    if carpeta.exists() and not any(carpeta.iterdir()):
        carpeta.rmdir()

# 2. Las imágenes grandes pasan a WebP (se ven igual y pesan mucho menos)
convertir = list(ASSETS.glob("personajes/*/medio.png")) + list(ASSETS.glob("personajes/*/cuerpo.png"))
convertir += list(ASSETS.glob("consola-celular/*.png"))
for png in convertir:
    webp = png.with_suffix(".webp")
    with Image.open(png) as imagen:
        imagen.save(webp, "WEBP", quality=90, method=6)
    guardar_aparte(png)
    print(f"  {png.relative_to(ASSETS)} → {webp.name}")

# 3. Que el código busque los archivos nuevos
cambios = {
    "medio.png": "medio.webp",
    "cuerpo.png": "cuerpo.webp",
    "consola-celular/abierta.png": "consola-celular/abierta.webp",
    "consola-celular/cerrada.png": "consola-celular/cerrada.webp",
}
for ruta in list(Path("www").glob("*.js")) + list(Path("www/funciones").glob("*.js")) + list(ASSETS.glob("personajes/*/datos.json")):
    texto = ruta.read_text(encoding="utf-8-sig")
    nuevo = texto
    for viejo, reemplazo in cambios.items():
        nuevo = nuevo.replace(viejo, reemplazo)
    if nuevo != texto:
        ruta.write_text(nuevo, encoding="utf-8")
        print(f"  actualizado: {ruta}")

print(f"\nImágenes y sonidos de la app: {antes:.1f} MB → {tamano(ASSETS):.1f} MB")