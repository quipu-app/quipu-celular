"""Prepara las consolas verticales que dibuja Gemini para la app del celular: les saca el fondo blanco."""
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

RAIZ = Path(__file__).resolve().parent.parent
PERSONAJES = RAIZ / "www" / "assets" / "personajes"


def sacar_fondo(origen: Path) -> Image.Image:
    """Vuelve transparente el blanco que rodea al aparato, sin tocar el blanco de adentro."""
    pixeles = np.array(Image.open(origen).convert("RGBA"))
    rgb = pixeles[..., :3].astype(int)

    # 1. El blanco casi puro que toca los bordes de la imagen es el fondo.
    casi_blanco = rgb.min(axis=2) > 235
    etiquetas, _ = ndimage.label(casi_blanco)
    en_borde = np.concatenate([etiquetas[0], etiquetas[-1], etiquetas[:, 0], etiquetas[:, -1]])
    fondo = np.isin(etiquetas, en_borde[en_borde > 0])

    # 2. Avanza sobre el halo claro que deja el dibujo en el contorno.
    claro = rgb.mean(axis=2) > 170
    for _ in range(3):
        fondo |= ndimage.binary_dilation(fondo) & claro
    fondo = ndimage.binary_dilation(fondo, iterations=1)

    pixeles[fondo, 3] = 0
    return Image.fromarray(pixeles)


def main():
    if len(sys.argv) != 4:
        print("Uso: python herramientas\\preparar_consola.py <personaje> <abierta.jpg> <cerrada.jpg>")
        sys.exit(1)
    personaje, abierta, cerrada = sys.argv[1], Path(sys.argv[2]), Path(sys.argv[3])
    destino = PERSONAJES / personaje / "celular"
    destino.mkdir(parents=True, exist_ok=True)
    for origen, nombre in ((abierta, "abierta.png"), (cerrada, "cerrada.png")):
        imagen = sacar_fondo(origen)
        imagen.save(destino / nombre)
        print(f"  {nombre}: {imagen.width} x {imagen.height}")
    print(f"Listo, quedaron en: {destino}")


if __name__ == "__main__":
    main()
