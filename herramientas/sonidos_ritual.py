"""Genera los sonidos del ritual (escaneo, captura, código, listo y carta) para el celu,
con las mismas recetas que usa la compu en quipu/sonido.py."""
from pathlib import Path

ORIGEN = Path("../pythonProject/quipu/sonido.py")
DESTINO = Path("www/assets/sonidos")

codigo = ORIGEN.read_text(encoding="utf-8-sig").replace("\r", "")
desde = codigo.index("# --- Generadores")
hasta = codigo.index("def ruta_sonido")
recetas = {}
exec("import math, random, struct, wave\nFRECUENCIA = 44100\n" + codigo[desde:hasta], recetas)

for nombre, generar in recetas["EFECTOS_INTERFAZ"].items():
    archivo = DESTINO / f"{nombre}.wav"
    recetas["guardar_wav"](archivo, generar())
    print(f"  {archivo} ({archivo.stat().st_size // 1024} KB)")