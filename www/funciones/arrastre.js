// Desplazar con el dedo (o con el mouse, en el emulador) cualquier zona "desplazable",
// en vertical y en horizontal. Si arrastrás, no cuenta como toque.

(function () {
  let inicio = null;   // dónde empezó el arrastre y si ya se movió

  // Busca, desde lo que tocaste hacia afuera, la primera zona que puede moverse en ese eje.
  function zonaPara(elemento, eje) {
    let caja = elemento.closest(".desplazable");
    while (caja) {
      const sobra = eje === "x" ? caja.scrollWidth > caja.clientWidth : caja.scrollHeight > caja.clientHeight;
      if (sobra) return caja;
      caja = caja.parentElement ? caja.parentElement.closest(".desplazable") : null;
    }
    return null;
  }

  document.addEventListener("pointerdown", (e) => {
    if (!e.target.closest(".desplazable")) return;
    inicio = { x: e.clientX, y: e.clientY, objetivo: e.target, movido: false };
  });

  document.addEventListener("pointermove", (e) => {
    if (!inicio) return;
    const dx = e.clientX - inicio.x;
    const dy = e.clientY - inicio.y;
    if (!inicio.movido && Math.hypot(dx, dy) < 6) return;   // un toque no es un arrastre
    inicio.movido = true;
    const zonaX = zonaPara(inicio.objetivo, "x");
    const zonaY = zonaPara(inicio.objetivo, "y");
    if (zonaX) zonaX.scrollLeft -= dx;
    if (zonaY) zonaY.scrollTop -= dy;
    inicio.x = e.clientX;
    inicio.y = e.clientY;
  });

  document.addEventListener("pointerup", () => {
    if (inicio && inicio.movido) {
      // Si arrastraste, el "clic" que viene al soltar se ignora.
      const ignorar = (ev) => { ev.stopPropagation(); ev.preventDefault(); };
      window.addEventListener("click", ignorar, { capture: true, once: true });
      setTimeout(() => window.removeEventListener("click", ignorar, { capture: true }), 0);
    }
    inicio = null;
  });

  document.addEventListener("pointercancel", () => { inicio = null; });
})();
