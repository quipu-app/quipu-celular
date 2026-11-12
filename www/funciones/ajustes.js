// Ajustes en el celular: elegir personaje (con sus cartas), tu nombre y los sonidos.

window.MODULOS = window.MODULOS || {};

(function () {
  const CLAVE = "quipu.ajustes";
  const PERSONAJES = ["anki", "compa", "luna", "moreira", "pachamama", "remedios"];   // Eric presenta: no se elige
  const TIPOS_TECLA = [["clic", "Clic"], ["suave", "Suave"], ["retro", "Retro"], ["ninguno", "Sin sonido"]];
  const ARCHIVOS_TECLA = { clic: "tecla_clic_v10", suave: "tecla_suave_v10", retro: "tecla_retro_v9" };
  const VERSION = "Quipu para celular · versión de prueba";

  const escapar = (t) => String(t ?? "").replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  let ajustes = { nombre: "", volumen_teclas: 7, volumen_avisos: 3, sonido_teclas: "clic" };
  try { ajustes = { ...ajustes, ...JSON.parse(localStorage.getItem(CLAVE)) }; } catch (error) { /* valores iniciales */ }
  const guardar = () => localStorage.setItem(CLAVE, JSON.stringify(ajustes));

  // --- Si el personaje elegido todavía no tiene consola de celular, usa la de Moreira ---
  ["imagen-abierta", "imagen-cerrada"].forEach((id) => {
    const imagen = document.getElementById(id);
    const respaldo = () => {
      if (!imagen.src.includes("/moreira/")) imagen.src = imagen.src.replace(/personajes\/[^/]+\//, "personajes/moreira/");
    };
    imagen.addEventListener("error", respaldo);
    if (imagen.complete && imagen.naturalWidth === 0) respaldo();
  });

  // --- El volumen de los avisos (el chiflido de Foco y Agenda) ---
  const reproducir = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function () {
    if (this.src.includes("chiflido")) this.volume = ajustes.volumen_avisos / 10;
    return reproducir.call(this);
  };

  // --- El sonido de las teclas de la consola ---
  const sonidosTecla = {};
  function sonarTecla() {
    const archivo = ARCHIVOS_TECLA[ajustes.sonido_teclas];
    if (!archivo || !ajustes.volumen_teclas) return;
    if (!sonidosTecla[archivo]) sonidosTecla[archivo] = new Audio(`assets/sonidos/${archivo}.wav`);
    const sonido = sonidosTecla[archivo];
    sonido.volume = ajustes.volumen_teclas / 10;
    sonido.currentTime = 0;
    sonido.play().catch(() => {});
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest(".tecla, #cerrar, #tapa")) sonarTecla();
  }, true);

  // --- La pantallita: las barritas del volumen mientras lo cambiás ---
  let volumenVisible = null;
  const textoAnterior = window.textoPantallita;
  window.textoPantallita = () => {
    const anterior = textoAnterior && textoAnterior();
    if (anterior) return anterior;
    if (volumenVisible && Date.now() < volumenVisible.hasta) {
      const llenas = Math.round(volumenVisible.nivel / 2);
      return "VOL " + "▮".repeat(llenas) + "▯".repeat(5 - llenas);
    }
    return null;
  };

  // --- Las cartas de los personajes ---
  let cartas = [];          // los datos.json de cada personaje
  let indice = 0;           // la carta que estás mirando
  let contenedor = null;
  let actual = localStorage.getItem("quipu.personaje") || "moreira";

  async function cargarCartas() {
    if (cartas.length) return;
    cartas = await Promise.all(PERSONAJES.map(async (id) => {
      const respuesta = await fetch(`assets/personajes/${id}/datos.json`);
      return { id, ...(await respuesta.json()) };
    }));
    indice = Math.max(0, cartas.findIndex((c) => c.id === actual));
  }

  // El primer cuadro del cuerpo (mirando al frente), recortado de la hoja de animación.
  function retrato(c) {
    const h = c.hojas.cuerpo;
    const g = h.grilla;
    const n = h.cuadros.mira_frente || 0;
    const alto = 28;                                   // en cqw
    const ancho = alto * g.cuadro_ancho / g.cuadro_alto;
    const col = n % g.columnas;
    const fila = Math.floor(n / g.columnas);
    return `<div class="aj-retrato" role="img" aria-label="${escapar(c.nombre)}" style="width:${ancho}cqw; height:${alto}cqw;
      background-image:url(assets/personajes/${c.id}/${h.sprite});
      background-size:${ancho * g.columnas}cqw auto;
      background-position:${-col * ancho}cqw ${-fila * alto}cqw"></div>`;
  }

  // --- El cambio de personaje: el ritual, sin cerrar la tapa ni reiniciar la app ---
  // 1. Escaneo del personaje actual. 2. Lluvia de código: "Creando…". 3. El nuevo aparece de a píxeles.
  let enRitual = false;
  const esperar = (ms) => new Promise((listo) => setTimeout(listo, ms));
  const COLOR_PANTALLA = "#C2E6F2";

  function cargarImagen(ruta) {
    return new Promise((listo) => {
      const imagen = new Image();
      imagen.onload = imagen.onerror = () => listo();
      imagen.src = ruta;
    });
  }

  // Cambia el personaje "en vivo": sus datos, sus dibujos, su consola y sus colores.
  async function cambiarPersonaje(c) {
    const carpeta = `assets/personajes/${c.id}/`;
    await Promise.all([cargarImagen(carpeta + c.hojas.medio.sprite)]);
    localStorage.setItem("quipu.personaje", c.id);
    datos = c;
    hoja = c.hojas.medio;
    document.documentElement.style.setProperty("--color-consola", c.consola);
    [figura, mini].forEach((el) => { el.style.backgroundImage = `url(${carpeta}${hoja.sprite})`; });
    acomodar();
    mostrar("mira_frente");
    actual = c.id;
  }

  function lluviaDeCodigo() {
    const signos = "01QUIPU<>{}[]=+*#";
    return Array.from({ length: 16 }, (_, i) => {
      const texto = Array.from({ length: 14 }, () => signos[Math.floor(Math.random() * signos.length)]).join("<br>");
      const duracion = (0.8 + Math.random() * 0.9).toFixed(2);
      const demora = (Math.random() * 0.8).toFixed(2);
      return `<div class="ritual-columna" style="left:${i * 6.25}%; animation-duration:${duracion}s; animation-delay:${demora}s">${texto}</div>`;
    }).join("");
  }

  function pixeles() {
    return Array.from({ length: 12 * 8 }, () =>
      `<i style="background:${COLOR_PANTALLA}; animation-delay:${(Math.random() * 1.2).toFixed(2)}s"></i>`).join("");
  }

  async function elegir(id) {
    if (id === actual || enRitual) return;
    enRitual = true;
    const nuevo = cartas.find((c) => c.id === id);
    decir((datos && datos.frases.ajustes_relevo) || "¡Ahí llega quien te acompaña!");
    await esperar(2000);

    volverAlInicio();                                  // el personaje vuelve a la pantalla grande
    const capa = document.createElement("div");
    capa.className = "ritual";
    document.getElementById("pantalla").appendChild(capa);
    let paso = 0;
    const semaforo = setInterval(() => {               // el semáforo: procesando
      ponerLuces([paso % 3 === 0, paso % 3 === 1, paso % 3 === 2], "ajustes");
      paso++;
    }, 400);

    // 1. Escaneo
    anunciar("Escaneando…");
    capa.innerHTML = '<div class="ritual-escaner"></div>';
    await esperar(1900);

    // 2. Lluvia de código: el personaje se va y se arma el nuevo
    anunciar("Creando…");
    figura.style.opacity = "0";
    capa.innerHTML = lluviaDeCodigo();
    await Promise.all([cambiarPersonaje(nuevo), esperar(1900)]);

    // 3. El nuevo aparece de a píxeles
    capa.innerHTML = `<div class="ritual-pixeles">${pixeles()}</div>`;
    figura.style.opacity = "1";
    await esperar(1500);

    capa.remove();
    clearInterval(semaforo);
    ponerLuces([false, false, true], "ajustes");
    setTimeout(() => ponerLuces(null, "ajustes"), 1200);
    anunciar("¡Listo!");
    hacer("saluda");
    enRitual = false;
  }

  const barras = (nivel) => Array.from({ length: 10 }, (_, i) => `<i class="${i < nivel ? "llena" : ""}"></i>`).join("");
  const control = (clave) => `<div class="so-control">
      <button class="so-mm" data-vol="${clave}" data-paso="-1" aria-label="Bajar">−</button>
      <span class="so-barras">${barras(ajustes[clave])}</span>
      <button class="so-mm" data-vol="${clave}" data-paso="1" aria-label="Subir">+</button>
    </div>`;

  function dibujar() {
    if (!contenedor) return;
    const c = cartas[indice];
    const color2 = c.detalle || c.consola;
    contenedor.innerHTML = `
      <p class="tf-etiqueta aj-primero">Personaje</p>
      <div class="aj-carrusel">
        <button class="no-tecla clara" id="aj-antes" aria-label="Personaje anterior">‹</button>
        <div class="aj-carta">
          ${retrato(c)}
          <div class="aj-datos">
            <b>${escapar(c.nombre)}</b>
            <small>${escapar(c.titulo || "")}</small>
            <span class="aj-colores">Colores <i style="background:${c.consola}"></i><i style="background:${color2}"></i></span>
            <span class="aj-puntos">${cartas.map((_, i) => `<i class="${i === indice ? "activo" : ""}"></i>`).join("")}</span>
          </div>
        </div>
        <button class="no-tecla clara" id="aj-despues" aria-label="Personaje siguiente">›</button>
      </div>
      <button class="tf-boton aj-elegir" id="aj-elegir" ${c.id === actual ? "disabled" : ""}>${c.id === actual ? "Es tu personaje" : "Elegir"}</button>

      <p class="tf-etiqueta">Tu nombre</p>
      <div class="tf-fila">
        <input id="aj-nombre" class="tf-campo" maxlength="20" placeholder="¿Cómo te llamás?" value="${escapar(ajustes.nombre)}">
        <button class="tf-boton" id="aj-guardar-nombre">Guardar</button>
      </div>
      <p class="tf-mensaje aj-ayuda">Es como te van a ver en las notas que compartas.</p>

      <p class="tf-etiqueta">Sonido</p>
      <div class="so-fila so-general"><span>Teclas</span>${control("volumen_teclas")}</div>
      <div class="so-fila so-general"><span>Avisos</span>${control("volumen_avisos")}</div>
      <div class="tf-fila">
        ${TIPOS_TECLA.map(([t, nombre]) => `<button class="tf-boton secundario ${ajustes.sonido_teclas === t ? "activa" : ""}" data-tipo="${t}">${nombre}</button>`).join("")}
      </div>

      ${window.SINCRO ? SINCRO.html() : ""}

      <p class="tf-etiqueta">Versión</p>
      <p class="tf-mensaje">${VERSION}</p>`;

    const $ = (id) => document.getElementById(id);
    $("aj-antes").onclick = () => { indice = (indice - 1 + cartas.length) % cartas.length; dibujar(); };
    $("aj-despues").onclick = () => { indice = (indice + 1) % cartas.length; dibujar(); };
    $("aj-elegir").onclick = () => elegir(c.id);
    $("aj-guardar-nombre").onclick = () => {
      ajustes.nombre = $("aj-nombre").value.trim();
      ajustes.nombre_cambiado = Date.now() / 1000;   // para saber qué nombre gana entre aparatos
      guardar();
      $("aj-nombre").blur();
      const frase = datos && datos.frases.ajustes_nombre;
      decir(frase && ajustes.nombre ? frase.replace("{nombre}", ajustes.nombre) : "Guardado");
    };
    contenedor.querySelectorAll("[data-vol]").forEach((b) => {
      b.onclick = () => {
        const clave = b.dataset.vol;
        ajustes[clave] = Math.max(0, Math.min(10, ajustes[clave] + Number(b.dataset.paso)));
        guardar();
        volumenVisible = { nivel: ajustes[clave], hasta: Date.now() + 1500 };
        if (clave === "volumen_teclas") sonarTecla();
        else new Audio("assets/sonidos/chiflido.wav").play().catch(() => {});
        dibujar();
      };
    });
    contenedor.querySelectorAll("[data-tipo]").forEach((b) => {
      b.onclick = () => { ajustes.sonido_teclas = b.dataset.tipo; guardar(); sonarTecla(); dibujar(); };
    });
    if (window.SINCRO) SINCRO.conectar(dibujar);
  }

  MODULOS.ajustes = {
    async abrir(lugar) {
      contenedor = lugar;
      try { ajustes = { ...ajustes, ...JSON.parse(localStorage.getItem(CLAVE)) }; } catch (error) { /* sigue igual */ }   // el nombre pudo llegar de la compu
      contenedor.innerHTML = '<p class="tf-mensaje">Cargando…</p>';
      await cargarCartas();
      dibujar();
      if (datos && datos.frases.ajustes_hola) decir(datos.frases.ajustes_hola);
    },
    cerrar() {
      contenedor = null;
    },
  };
})();

