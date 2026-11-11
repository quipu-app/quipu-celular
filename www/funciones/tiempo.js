// Tiempo en el celular: el pronóstico de Open-Meteo (gratis, sin clave), igual que en la compu.

window.MODULOS = window.MODULOS || {};

(function () {
  const URL_CIUDADES = "https://geocoding-api.open-meteo.com/v1/search";
  const URL_PRONOSTICO = "https://api.open-meteo.com/v1/forecast";
  const CLAVE = "quipu.tiempo";                       // dónde se guardan los ajustes en el celular
  const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const AJUSTES_INICIALES = {
    ciudad: "Bahía Blanca", provincia: "Buenos Aires", pais: "Argentina",
    lat: -38.7196, lon: -62.2724, unidad: "C", dias: 5,
  };

  // Códigos del tiempo (estándar WMO) -> descripción, ícono y reacción del personaje
  const CODIGOS = {
    0: ["Despejado", "sol", "sol"], 1: ["Mayormente despejado", "sol", "sol"],
    2: ["Parcialmente nublado", "nube", "nubes"], 3: ["Nublado", "nube", "nubes"],
    45: ["Niebla", "niebla", "nubes"], 48: ["Niebla con escarcha", "niebla", "frio"],
    51: ["Llovizna leve", "lluvia", "paraguas"], 53: ["Llovizna", "lluvia", "paraguas"],
    55: ["Llovizna intensa", "lluvia", "paraguas"],
    56: ["Llovizna helada", "lluvia", "frio"], 57: ["Llovizna helada intensa", "lluvia", "frio"],
    61: ["Lluvia leve", "lluvia", "paraguas"], 63: ["Lluvia", "lluvia", "paraguas"],
    65: ["Lluvia fuerte", "lluvia", "paraguas"],
    66: ["Lluvia helada", "lluvia", "frio"], 67: ["Lluvia helada fuerte", "lluvia", "frio"],
    71: ["Nevada leve", "nieve", "frio"], 73: ["Nevada", "nieve", "frio"], 75: ["Nevada fuerte", "nieve", "frio"],
    77: ["Granitos de nieve", "nieve", "frio"],
    80: ["Chaparrones leves", "lluvia", "paraguas"], 81: ["Chaparrones", "lluvia", "paraguas"],
    82: ["Chaparrones fuertes", "lluvia", "paraguas"],
    85: ["Chaparrones de nieve", "nieve", "frio"], 86: ["Chaparrones de nieve fuertes", "nieve", "frio"],
    95: ["Tormenta", "tormenta", "paraguas"],
    96: ["Tormenta con granizo", "tormenta", "paraguas"], 99: ["Tormenta con granizo fuerte", "tormenta", "paraguas"],
  };

  // Íconos del tiempo, los mismos de la compu (dibujados, nítidos a cualquier tamaño)
  const NUBE = '<path d="M12 34h22a7 7 0 0 0 0-14 10 10 0 0 0-19-1 7.5 7.5 0 0 0-3 15z" fill="#F4FBFD" stroke="#5E7B92" stroke-width="2"/>';
  const ICONOS = {
    sol: '<circle cx="22" cy="22" r="9" fill="#F2C230" stroke="#B8862A" stroke-width="2"/><g stroke="#F2C230" stroke-width="3" stroke-linecap="round"><path d="M22 4v5M22 35v5M4 22h5M35 22h5M9 9l3.5 3.5M31.5 31.5L35 35M35 9l-3.5 3.5M9 35l3.5-3.5"/></g>',
    nube: '<circle cx="15" cy="15" r="8" fill="#F2C230"/>' + NUBE,
    lluvia: NUBE.replace("34h", "28h").replace("#F4FBFD", "#DDE6EE") +
      '<g stroke="#3FA9F5" stroke-width="3" stroke-linecap="round"><path d="M15 33l-2 6M23 33l-2 6M31 33l-2 6"/></g>',
    tormenta: NUBE.replace("#F4FBFD", "#C9D3DC") + '<path d="M22 32l-4 7h5l-3 6" fill="none" stroke="#F2C230" stroke-width="3" stroke-linejoin="round"/>',
    nieve: NUBE + '<g fill="#7FB8E0"><circle cx="15" cy="39" r="2"/><circle cx="23" cy="41" r="2"/><circle cx="31" cy="39" r="2"/></g>',
    niebla: '<g stroke="#8AA5B8" stroke-width="3" stroke-linecap="round"><path d="M8 16h28M5 23h34M8 30h28"/></g>',
  };
  const icono = (nombre) => `<svg viewBox="0 0 44 44" aria-hidden="true">${ICONOS[nombre] || ICONOS.nube}</svg>`;
  const escapar = (t) => String(t ?? "").replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let contenedor = null;   // dónde se dibuja (la pantalla grande)
  let abierto = false;     // para no dibujar si ya cerraste la función
  let ajustes = null;      // ciudad, unidad y días guardados
  let ultimo = null;       // el último pronóstico que llegó

  // --- Guardar y leer los ajustes en el celular ---
  function cargarAjustes() {
    try {
      return { ...AJUSTES_INICIALES, ...JSON.parse(localStorage.getItem(CLAVE) || "{}") };
    } catch (error) {
      return { ...AJUSTES_INICIALES };
    }
  }

  function guardarAjustes(nuevos) {
    localStorage.setItem(CLAVE, JSON.stringify(nuevos));
  }

  // --- Internet ---
  async function pedir(url, parametros) {
    try {
      const respuesta = await fetch(url + "?" + new URLSearchParams(parametros));
      if (!respuesta.ok) throw new Error(respuesta.status);
      return await respuesta.json();
    } catch (error) {
      throw new Error("No pude conectarme para ver el tiempo. ¿Hay internet?");
    }
  }

  function describir(codigo) {
    const [descripcion, nombreIcono, reaccion] = CODIGOS[codigo] || ["Sin datos", "nube", "nubes"];
    return { descripcion, icono: nombreIcono, reaccion };
  }

  async function buscarCiudades(nombre) {
    if (nombre.trim().length < 2) return [];
    const datos = await pedir(URL_CIUDADES, { name: nombre.trim(), count: 5, language: "es", format: "json" });
    return (datos.results || []).map((r) => ({
      ciudad: r.name, provincia: r.admin1 || "", pais: r.country || "", lat: r.latitude, lon: r.longitude,
    }));
  }

  async function pronostico(a) {
    const datos = await pedir(URL_PRONOSTICO, {
      latitude: a.lat, longitude: a.lon,
      current: "temperature_2m,weather_code,wind_speed_10m",
      daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
      temperature_unit: a.unidad === "F" ? "fahrenheit" : "celsius",
      forecast_days: a.dias, timezone: "auto",
    });
    const actual = datos.current;
    const d = datos.daily;
    return {
      ciudad: a.ciudad, unidad: a.unidad,
      actual: { temp: Math.round(actual.temperature_2m), viento: Math.round(actual.wind_speed_10m), ...describir(actual.weather_code) },
      dias: d.time.map((fecha, i) => ({
        nombre: i === 0 ? "Hoy" : DIAS_SEMANA[new Date(fecha + "T12:00").getDay()],
        max: Math.round(d.temperature_2m_max[i]), min: Math.round(d.temperature_2m_min[i]),
        lluvia: d.precipitation_probability_max[i] || 0,
        ...describir(d.weather_code[i]),
      })),
    };
  }

  // --- Lo que se ve ---
  async function actualizar(presentar) {
    contenedor.innerHTML = '<p class="tf-mensaje">Consultando el tiempo…</p>';
    try {
      const p = await pronostico(ajustes);
      if (!abierto) return;
      ultimo = p;
      dibujar(p);
      if (presentar) reaccionar(p);
    } catch (error) {
      if (!abierto) return;
      contenedor.innerHTML = `<p class="tf-mensaje">${escapar(error.message)}</p>
        <button class="tf-boton" id="ti-reintentar">Reintentar</button>`;
      document.getElementById("ti-reintentar").onclick = () => actualizar(presentar);
    }
  }

  function dibujar(p) {
    contenedor.innerHTML = `
      <div class="ti-actual">
        ${icono(p.actual.icono)}
        <div>
          <div class="ti-temp">${p.actual.temp}°${p.unidad}</div>
          <div class="ti-desc">${escapar(p.ciudad)} · ${escapar(p.actual.descripcion)} · viento ${p.actual.viento} km/h</div>
        </div>
      </div>
      <div class="ti-dias desplazable" style="--n: ${p.dias.length}">
        ${p.dias.map((d) => `
          <div class="ti-dia">
            <b>${d.nombre}</b>
            ${icono(d.icono)}
            <span>${d.max}° <i>${d.min}°</i></span>
            <span class="ti-lluvia">${d.lluvia ? d.lluvia + "%" : ""}</span>
          </div>`).join("")}
      </div>`;
  }

  // El personaje comenta el tiempo y el cartel de la pantallita lo resume.
  function reaccionar(p) {
    const a = p.actual;
    const celsius = p.unidad === "C" ? a.temp : (a.temp - 32) * 5 / 9;
    let r = a.reaccion;
    if (r !== "paraguas") {
      if (celsius <= 8) r = "frio";
      else if (r === "sol" && celsius < 15) r = "nubes";
    }
    if (hoja && hoja.cuadros[r]) hacer(r);
    const frase = datos && datos.frases[`tiempo_${r}`];
    const cartelTiempo = `${p.ciudad} · ${a.temp}° · ${a.descripcion}`;
    if (frase) {
      decir(frase);
      setTimeout(() => { if (abierto) anunciar(cartelTiempo); }, 3200);
    } else {
      anunciar(cartelTiempo);
    }
  }

  // --- Opciones (⋯): ciudad, unidad y días ---
  function opciones() {
    const borrador = { ...ajustes };
    contenedor.innerHTML = `
      <p class="tf-etiqueta">Ciudad</p>
      <div class="tf-fila">
        <input id="ti-buscar" class="tf-campo" placeholder="Escribí tu ciudad" enterkeyhint="search">
        <button class="tf-boton" id="ti-btn-buscar">Buscar</button>
      </div>
      <div id="ti-resultados"></div>
      <p class="tf-mensaje" id="ti-elegida"></p>
      <p class="tf-etiqueta">Unidad</p>
      <div class="tf-fila">
        <button class="tf-boton secundario" data-unidad="C">°C</button>
        <button class="tf-boton secundario" data-unidad="F">°F</button>
      </div>
      <p class="tf-etiqueta">Días</p>
      <div class="tf-fila">
        <button class="tf-boton secundario" data-dias="3">3</button>
        <button class="tf-boton secundario" data-dias="5">5</button>
      </div>
      <div class="tf-fila tf-final">
        <button class="tf-boton secundario" id="ti-cancelar">Cancelar</button>
        <button class="tf-boton" id="ti-guardar">Guardar</button>
      </div>`;

    const $ = (id) => document.getElementById(id);
    function marcar() {
      $("ti-elegida").textContent = `Elegida: ${borrador.ciudad} (${borrador.provincia}, ${borrador.pais})`;
      contenedor.querySelectorAll("[data-unidad]").forEach((b) => b.classList.toggle("activa", b.dataset.unidad === borrador.unidad));
      contenedor.querySelectorAll("[data-dias]").forEach((b) => b.classList.toggle("activa", Number(b.dataset.dias) === borrador.dias));
    }

    async function buscar() {
      const lista = $("ti-resultados");
      lista.innerHTML = '<p class="tf-mensaje">Buscando…</p>';
      try {
        const ciudades = await buscarCiudades($("ti-buscar").value);
        if (!ciudades.length) { lista.innerHTML = '<p class="tf-mensaje">No encontré esa ciudad.</p>'; return; }
        lista.innerHTML = ciudades.map((c, i) =>
          `<button class="tf-boton secundario tf-ancho" data-i="${i}">${escapar(c.ciudad)} <small>${escapar(c.provincia)}, ${escapar(c.pais)}</small></button>`).join("");
        lista.querySelectorAll("[data-i]").forEach((b) => {
          b.onclick = () => {
            Object.assign(borrador, ciudades[Number(b.dataset.i)]);
            lista.innerHTML = "";
            $("ti-buscar").value = "";
            $("ti-buscar").blur();
            marcar();
          };
        });
      } catch (error) {
        lista.innerHTML = `<p class="tf-mensaje">${escapar(error.message)}</p>`;
      }
    }

    $("ti-btn-buscar").onclick = buscar;
    $("ti-buscar").addEventListener("keydown", (e) => { if (e.key === "Enter") buscar(); });
    contenedor.querySelectorAll("[data-unidad]").forEach((b) => { b.onclick = () => { borrador.unidad = b.dataset.unidad; marcar(); }; });
    contenedor.querySelectorAll("[data-dias]").forEach((b) => { b.onclick = () => { borrador.dias = Number(b.dataset.dias); marcar(); }; });
    $("ti-cancelar").onclick = () => (ultimo ? dibujar(ultimo) : actualizar(false));
    $("ti-guardar").onclick = () => {
      ajustes = { ...borrador };
      guardarAjustes(ajustes);
      anunciar("Guardando…");
      actualizar(true);
    };
    marcar();
  }

  MODULOS.tiempo = {
    abrir(lugar) {
      contenedor = lugar;
      abierto = true;
      ajustes = cargarAjustes();
      actualizar(true);
    },
    opciones,
    cerrar() {
      abierto = false;
    },
  };
})();

