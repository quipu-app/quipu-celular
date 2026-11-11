"""Tapa el micrófono del dibujo de la consola de celular y centra la placa Quipu."""
import sys
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent


def main():
    personaje = sys.argv[1] if len(sys.argv) > 1 else "moreira"
    ruta = RAIZ / "www" / "assets" / "personajes" / personaje / "celular" / "abierta.png"
    imagen = Image.open(ruta).convert("RGBA")
    ancho, alto = imagen.size

    # Si en el lugar original de la placa ya hay azul, el arreglo ya estaba hecho.
    azul = imagen.getpixel((int(ancho * 0.30), int(alto * 0.903)))
    if imagen.getpixel((int(ancho * 0.69), int(alto * 0.937))) == azul:
        print("Ya estaba arreglada, no se tocó nada.")
        return

    dibujo = ImageDraw.Draw(imagen)
    # 1. Tapar el micrófono con el azul de la consola.
    dibujo.rectangle((int(ancho * 0.135), int(alto * 0.912), int(ancho * 0.465), int(alto * 0.962)), fill=azul)
    # 2. Mover la placa Quipu al centro.
    caja = (int(ancho * 0.512), int(alto * 0.910), int(ancho * 0.860), int(alto * 0.964))
    placa = imagen.crop(caja)
    dibujo.rectangle(caja, fill=azul)
    imagen.paste(placa, ((ancho - placa.width) // 2, caja[1]))

    imagen.save(ruta)
    print(f"Listo: {ruta}")


if __name__ == "__main__":
    main()
