"""Arma el ícono de la app y la pantalla de inicio de Android con la Q de Quipu."""
from pathlib import Path

from PIL import Image, ImageDraw

RAIZ = Path(__file__).resolve().parent.parent
LOGO = RAIZ / "www" / "assets" / "marca" / "q.png"
RES = RAIZ / "android" / "app" / "src" / "main" / "res"
FONDO = (14, 24, 52, 255)          # #0E1834, el azul de Quipu

# densidad de pantalla: (lado del ícono común, lado de la capa de adelante del ícono adaptable)
DENSIDADES = {"mdpi": (48, 108), "hdpi": (72, 162), "xhdpi": (96, 216),
              "xxhdpi": (144, 324), "xxxhdpi": (192, 432)}


def logo_en(lado: int, proporcion: float) -> Image.Image:
    """La Q achicada (o agrandada) para que ocupe esa proporción del lado."""
    tam = round(lado * proporcion)
    return Image.open(LOGO).convert("RGBA").resize((tam, tam), Image.LANCZOS)


def pegar_centrado(lienzo: Image.Image, logo: Image.Image):
    lienzo.alpha_composite(logo, ((lienzo.width - logo.width) // 2, (lienzo.height - logo.height) // 2))


def icono(lado: int, redondo: bool) -> Image.Image:
    """Ícono común: la Q sobre fondo azul, cuadrado redondeado o círculo."""
    mascara = Image.new("L", (lado, lado), 0)
    dibujo = ImageDraw.Draw(mascara)
    if redondo:
        dibujo.ellipse((0, 0, lado - 1, lado - 1), fill=255)
    else:
        dibujo.rounded_rectangle((0, 0, lado - 1, lado - 1), radius=lado // 5, fill=255)
    lienzo = Image.new("RGBA", (lado, lado), FONDO)
    pegar_centrado(lienzo, logo_en(lado, 0.68))
    lienzo.putalpha(mascara)
    return lienzo


def frente(lado: int) -> Image.Image:
    """Capa de adelante del ícono adaptable: la Q dentro de la zona segura (el centro)."""
    lienzo = Image.new("RGBA", (lado, lado), (0, 0, 0, 0))
    pegar_centrado(lienzo, logo_en(lado, 0.5))
    return lienzo


def main():
    for densidad, (lado, lado_frente) in DENSIDADES.items():
        carpeta = RES / f"mipmap-{densidad}"
        icono(lado, False).save(carpeta / "ic_launcher.png")
        icono(lado, True).save(carpeta / "ic_launcher_round.png")
        frente(lado_frente).save(carpeta / "ic_launcher_foreground.png")
        print(f"  ícono {densidad}: {lado} px")

    # el color de fondo del ícono adaptable
    (RES / "values" / "ic_launcher_background.xml").write_text(
        '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
        '    <color name="ic_launcher_background">#0E1834</color>\n</resources>\n',
        encoding="utf-8")

    # la pantalla de inicio: cada splash.png que trae Android, con su mismo tamaño
    for archivo in RES.glob("drawable*/splash.png"):
        ancho, alto = Image.open(archivo).size
        lienzo = Image.new("RGBA", (ancho, alto), FONDO)
        pegar_centrado(lienzo, logo_en(min(ancho, alto), 0.3))
        lienzo.convert("RGB").save(archivo)
        print(f"  inicio {archivo.parent.name}: {ancho} x {alto}")
    print("Listo.")


if __name__ == "__main__":
    main()
