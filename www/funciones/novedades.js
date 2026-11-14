// Novedades: se fija si hay una versión nueva de Quipu para celular.
// Lee novedades.json de la página; si la versión publicada es más nueva que la instalada,
// avisa en la pantallita durante 24 horas y deja la tarjeta en Ajustes hasta que se actualice.
(() => {
  const DIRECCION = "https://quipu-app.github.io/novedades.json";
  const PAGINA = "https://quipu-app.github.io/#nueva-version";
  const UN_DIA = 24 * 60 * 60 * 1000;
  const CLAVE = "quipu.aviso_version";

  // Compara versiones número por número: "1.10.0" es más nueva que "1.9.3".
  function esMasNueva(publicada, instalada) {
    const a = String(publicada).split(".").map(Number);
    const b = String(instalada).split(".").map(Number);
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i] || 0, y = b[i] || 0;
      if (x !== y) return x > y;
    }
    return false;
  }

  function escapar(texto) {
    return String(texto).replace(/[&<>"']/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  async function buscar() {
    try {
      const respuesta = await fetch(DIRECCION, { cache: "no-store" });
      if (!respuesta.ok) return;
      const datos = (await respuesta.json()).android;
      if (!datos || !esMasNueva(datos.version, window.QUIPU_VERSION)) return;
      // El enlace solo puede llevar a la página de Quipu; si no, va a la sección de siempre.
      if (!String(datos.enlace || "").startsWith("https://quipu-app.github.io/")) datos.enlace = PAGINA;
      NOVEDADES.nueva = datos;
      avisarEnPantallita(datos);
    } catch (e) {
      // Sin internet o sin archivo: no pasa nada, se vuelve a probar la próxima vez que se abra Quipu.
    }
  }

  // La pantallita avisa durante 24 horas desde la primera vez que se detectó esa versión.
  function avisarEnPantallita(datos) {
    let registro = {};
    try { registro = JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch (e) {}
    if (registro.version !== datos.version) {
      registro = { version: datos.version, desde: Date.now() };
      localStorage.setItem(CLAVE, JSON.stringify(registro));
    }
    if (Date.now() - registro.desde < UN_DIA) {
      anunciar(`Nueva versión ${datos.version}: ${datos.resumen}. Mirá en Ajustes`);
    }
  }

  window.NOVEDADES = {
    nueva: null,

    // La tarjeta de Ajustes: solo aparece si hay una versión más nueva.
    html() {
      if (!this.nueva) return "";
      return `
        <button class="aj-nueva" id="aj-nueva">
          <span class="aj-nueva-texto">
            <b>Nueva versión disponible: ${escapar(this.nueva.version)}</b>
            <small>${escapar(this.nueva.resumen)}</small>
          </span>
          <span class="aj-nueva-flecha">›</span>
        </button>`;
    },

    // Abre la página en el navegador del celu.
    abrir() {
      if (this.nueva) window.location.href = this.nueva.enlace;
    },
  };

  setTimeout(buscar, 4000);
})();