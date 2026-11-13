// Notas en el celular: la lista, el editor y las opciones, con los menús agrupados en "Aa" y "⋯".
// Guarda las notas en el celular, con el mismo formato que la compu (para sincronizar más adelante).

window.MODULOS = window.MODULOS || {};

(function () {
  const CLAVE = "quipu.notas";
  const COLORES_LETRA = ["#17324D", "#E5484D", "#F2994A", "#27AE60", "#2F80ED", "#9B51E0"];
  const COLORES_CARPETA = ["#E5484D", "#F2994A", "#F2C230", "#3BB54A", "#3FA9F5", "#9B7BFF"];
  const RESALTADO = "#FFF176";
  const ALINEACIONES = ["justifyLeft", "justifyCenter", "justifyRight"];

  const escapar = (t) => String(t ?? "").replace(/[&<>"]/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const sinAcentos = (t) => String(t || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const nuevoId = () => (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, "") :
    Date.now().toString(16) + Math.random().toString(16).slice(2));
  const ahora = () => Date.now() / 1000;

  let contenedor = null;
  let abierto = false;
  let base = null;             // { version, carpetas: [...], notas: [...] }
  let vista = "todo";          // todo, sueltas o carpetas
  let carpetaAbierta = null;   // id de la carpeta que estás mirando
  let buscando = "";
  let nota = null;             // la nota que estás editando
  let relojGuardar = null;
  let alineacion = 0;
  let ultimaBorrada = null;
  let rangoGuardado = null;    // lo último que seleccionaste dentro de la nota

  // Recuerda lo que seleccionaste en la nota. Al tocar un botón de formato, el celular
  // suele "soltar" la selección; con esto la recuperamos antes de aplicar el formato.
  document.addEventListener("selectionchange", () => {
    const texto = document.getElementById("no-texto");
    const seleccion = window.getSelection();
    if (!texto || !seleccion.rangeCount) return;
    const rango = seleccion.getRangeAt(0);
    if (texto.contains(rango.commonAncestorContainer)) {
      rangoGuardado = rango.cloneRange();
      if (!rango.collapsed) {                       // hay algo seleccionado: aparece la tira de formato
        const barra = document.getElementById("no-herramientas");
        if (barra && barra.hidden) {
          barra.hidden = false;
          document.getElementById("no-aa").classList.add("activa");
        }
      }
    }
  });

  // --- Guardar y leer en el celular ---
  function cargar() {
    try {
      base = JSON.parse(localStorage.getItem(CLAVE)) || null;
    } catch (error) {
      base = null;
    }
    if (!base) base = { version: 1, carpetas: [], notas: [] };
  }

  function guardarTodo() {
    localStorage.setItem(CLAVE, JSON.stringify(base));
  }

  const carpetasVivas = () => base.carpetas.filter((c) => !c.borrada).sort((a, b) => a.orden - b.orden);
  const carpetaPorId = (id) => base.carpetas.find((c) => c.uid === id && !c.borrada);

  function notasVisibles() {
    let lista = base.notas.filter((n) => !n.borrada);
    if (carpetaAbierta) lista = lista.filter((n) => n.carpeta === carpetaAbierta);
    else if (vista === "sueltas") lista = lista.filter((n) => !n.carpeta || !carpetaPorId(n.carpeta));
    if (buscando) {
      const b = sinAcentos(buscando);
      lista = lista.filter((n) => sinAcentos(n.titulo).includes(b) || sinAcentos(n.texto).includes(b));
    }
    return lista.sort((a, b) => (b.fijada - a.fijada) || (b.modificada - a.modificada));
  }

  // La cabecera general de la consola se oculta: Notas trae la suya.
  function cabeceraConsola(visible) {
    const cabecera = document.querySelector("#funcion header");
    if (cabecera) cabecera.style.display = visible ? "" : "none";
  }

  function boton(id, texto, etiqueta, clase = "") {
    return `<button class="no-tecla ${clase}" id="${id}" aria-label="${etiqueta}">${texto}</button>`;
  }

  // Íconos chiquitos de los menús (los mismos del boceto)
  const ICONO = {
    fijar: '<svg viewBox="0 0 16 16"><path d="M8 1.5l2 4.2 4.5.6-3.3 3.1.8 4.5L8 11.7l-4 2.2.8-4.5L1.5 6.3 6 5.7z" fill="#F2C230" stroke="#B8862A" stroke-width="1"/></svg>',
    carpeta: '<svg viewBox="0 0 16 16"><path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5.5v6A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" fill="#F2994A" stroke="#1B2A4E" stroke-width="1"/></svg>',
    nueva: '<svg viewBox="0 0 16 16"><path d="M1.5 4A1.5 1.5 0 0 1 3 2.5h3.2l1.5 1.5H13A1.5 1.5 0 0 1 14.5 5.5v6A1.5 1.5 0 0 1 13 13H3a1.5 1.5 0 0 1-1.5-1.5z" fill="#F2994A" stroke="#1B2A4E" stroke-width="1"/><path d="M8 6.5v4M6 8.5h4" stroke="#FFFFFF" stroke-width="1.6" stroke-linecap="round"/></svg>',
    qr: '<svg viewBox="0 0 16 16" fill="none" stroke="#1B2A4E" stroke-width="1.4"><rect x="2" y="2" width="4.5" height="4.5"/><rect x="9.5" y="2" width="4.5" height="4.5"/><rect x="2" y="9.5" width="4.5" height="4.5"/><path d="M10 10h1.5v1.5H10zM12.5 12.5H14V14h-1.5z" fill="#1B2A4E" stroke="none"/></svg>',
    compartir: '<svg viewBox="0 0 16 16" fill="none" stroke="#1B2A4E" stroke-width="1.4" stroke-linecap="round"><circle cx="12" cy="3.5" r="1.8"/><circle cx="4" cy="8" r="1.8"/><circle cx="12" cy="12.5" r="1.8"/><path d="M5.6 7.1l4.8-2.7M5.6 8.9l4.8 2.7"/></svg>',
    colaborar: '<svg viewBox="0 0 16 16" fill="none" stroke="#1B2A4E" stroke-width="1.4"><circle cx="5.5" cy="5" r="2.3"/><circle cx="11" cy="5" r="2.3"/><path d="M1.5 13.5c0-3.2 8-3.2 8 0M7.5 13.5c0-3 7-3 7 0"/></svg>',
    borrar: '<svg viewBox="0 0 16 16" fill="none" stroke="#B3402F" stroke-width="1.4" stroke-linejoin="round"><path d="M2.5 4h11M6 4V2.5h4V4M4 4l.8 9.5h6.4L12 4"/></svg>',
  };
  const conIcono = (nombre, texto) => `<span class="no-icono" aria-hidden="true">${ICONO[nombre]}</span>${texto}`;

  const LUPA = '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M10.5 10.5 L14 14" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>';

  // ================= LA LISTA =================
  function mostrarLista() {
    nota = null;
    const abiertaCarpeta = carpetaAbierta && carpetaPorId(carpetaAbierta);
    contenedor.innerHTML = `
      <div class="no-raiz">
        <div class="no-barra">
          ${boton("no-volver", "‹", "Volver al inicio")}
          <h1 class="no-titulo">Notas</h1>
          ${boton("no-lupa", LUPA, "Buscar", "clara")}
          ${boton("no-nueva", "+", "Nueva nota")}
          ${boton("no-mas", "⋯", "Opciones")}
        </div>
        <div class="no-fila" id="no-fila-buscar" ${buscando ? "" : "hidden"}>
          <input id="no-buscar" class="tf-campo" placeholder="Buscar en tus notas…" value="${escapar(buscando)}" enterkeyhint="search">
        </div>
        ${abiertaCarpeta ? `
          <div class="no-migas">
            ${boton("no-salir-carpeta", "‹", "Salir de la carpeta", "chica")}
            <span class="no-punto" style="background:${abiertaCarpeta.color}"></span>
            <b>${escapar(abiertaCarpeta.nombre)}</b>
          </div>` : `
          <div class="no-pestanas">
            ${["todo", "sueltas", "carpetas"].map((v) =>
              `<button class="no-pestana ${vista === v ? "activa" : ""}" data-vista="${v}">${v[0].toUpperCase() + v.slice(1)}</button>`).join("")}
          </div>`}
        <div class="no-lista desplazable" id="no-lista"></div>
        <div class="no-menu" id="no-menu" hidden>
          <button data-accion="carpeta-nueva">${conIcono("nueva", "Nueva carpeta")}</button>
          ${abiertaCarpeta ? `<button data-accion="carpeta-editar">${conIcono("carpeta", "Editar esta carpeta")}</button>` : ""}
          ${abiertaCarpeta ? `<button data-accion="carpeta-borrar" class="no-peligro">${conIcono("borrar", "Borrar esta carpeta")}</button>` : ""}
        </div>
        <div class="no-aviso" id="no-aviso" hidden>
          <span>Nota borrada</span><button class="tf-boton" id="no-deshacer">Deshacer</button>
        </div>
      </div>`;

    dibujarLista();
    const $ = (id) => document.getElementById(id);
    $("no-volver").onclick = () => volverAlInicio();
    $("no-nueva").onclick = () => abrirNota(null);
    $("no-lupa").onclick = () => {
      const fila = $("no-fila-buscar");
      fila.hidden = !fila.hidden;
      if (!fila.hidden) $("no-buscar").focus();
      else { buscando = ""; dibujarLista(); }
    };
    $("no-buscar").oninput = () => { buscando = $("no-buscar").value; dibujarLista(); };
    $("no-mas").onclick = () => { $("no-menu").hidden = !$("no-menu").hidden; };
    contenedor.querySelector('[data-accion="carpeta-nueva"]').onclick = carpetaNueva;
    const botonBorrarCarpeta = contenedor.querySelector('[data-accion="carpeta-borrar"]');
    if (botonBorrarCarpeta) botonBorrarCarpeta.onclick = carpetaBorrar;
    const botonEditarCarpeta = contenedor.querySelector('[data-accion="carpeta-editar"]');
    if (botonEditarCarpeta) botonEditarCarpeta.onclick = carpetaEditar;
    contenedor.querySelectorAll(".no-pestana").forEach((p) => {
      p.onclick = () => { vista = p.dataset.vista; mostrarLista(); };
    });
    if ($("no-salir-carpeta")) $("no-salir-carpeta").onclick = () => { carpetaAbierta = null; mostrarLista(); };
    if (ultimaBorrada) {
      $("no-aviso").hidden = false;
      $("no-deshacer").onclick = () => {
        const n = base.notas.find((x) => x.uid === ultimaBorrada.uid);
        Object.assign(n, ultimaBorrada, { borrada: 0, modificada: ahora() });
        guardarTodo();
        ultimaBorrada = null;
        mostrarLista();
        anunciar("Nota recuperada");
      };
      setTimeout(() => { ultimaBorrada = null; const a = $("no-aviso"); if (a) a.hidden = true; }, 6000);
    }
  }

  function dibujarLista() {
    const lista = document.getElementById("no-lista");
    if (!lista) return;
    if (vista === "carpetas" && !carpetaAbierta && !buscando) {
      const carpetas = carpetasVivas();
      lista.innerHTML = carpetas.length ? carpetas.map((c) => {
        const cuantas = base.notas.filter((n) => !n.borrada && n.carpeta === c.uid).length;
        return `<button class="no-tarjeta" data-carpeta="${c.uid}">
          <span class="no-punto" style="background:${c.color}"></span>
          <span class="no-cuerpo"><b>${escapar(c.nombre)}</b><small>${cuantas} ${cuantas === 1 ? "nota" : "notas"}</small></span>
        </button>`;
      }).join("") : '<p class="tf-mensaje">Todavía no hay carpetas. Creá una con ⋯.</p>';
      lista.querySelectorAll("[data-carpeta]").forEach((b) => {
        b.onclick = () => { carpetaAbierta = b.dataset.carpeta; mostrarLista(); };
      });
      return;
    }
    const notas = notasVisibles();
    lista.innerHTML = notas.length ? notas.map((n) => {
      const c = n.carpeta && carpetaPorId(n.carpeta);
      const resumen = n.texto.replace(/\s+/g, " ").trim().slice(0, 80);
      return `<button class="no-tarjeta" data-nota="${n.uid}">
        <span class="no-punto" style="background:${c ? c.color : "#8A94AB"}"></span>
        <span class="no-cuerpo"><b>${escapar(n.titulo || "Sin título")}</b><small>${escapar(resumen)}</small></span>
        ${n.fijada ? '<span class="no-estrella">★</span>' : ""}
      </button>`;
    }).join("") : `<p class="tf-mensaje">${buscando ? "No encontré notas con eso." : "Todavía no hay notas. Tocá + para escribir la primera."}</p>`;
    lista.querySelectorAll("[data-nota]").forEach((b) => {
      b.onclick = () => abrirNota(b.dataset.nota);
    });
  }

  function carpetaNueva() {
    let color = COLORES_CARPETA[carpetasVivas().length % COLORES_CARPETA.length];
    const lista = document.getElementById("no-lista");
    document.getElementById("no-menu").hidden = true;
    lista.innerHTML = `
      <p class="tf-etiqueta">Nueva carpeta</p>
      <input id="no-nombre-carpeta" class="tf-campo no-ancho" placeholder="Nombre de la carpeta">
      <div class="no-colores" id="no-colores">
        ${COLORES_CARPETA.map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}
      </div>
      <div class="tf-fila tf-final">
        <button class="tf-boton secundario" id="no-cancelar-carpeta">Cancelar</button>
        <button class="tf-boton" id="no-crear-carpeta">Crear</button>
      </div>`;
    const marcar = () => lista.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("activa", b.dataset.color === color));
    lista.querySelectorAll("[data-color]").forEach((b) => { b.onclick = () => { color = b.dataset.color; marcar(); }; });
    marcar();
    document.getElementById("no-cancelar-carpeta").onclick = dibujarLista;
    document.getElementById("no-crear-carpeta").onclick = () => {
      const nombre = document.getElementById("no-nombre-carpeta").value.trim();
      if (!nombre) return;
      const orden = Math.max(0, ...base.carpetas.map((c) => c.orden || 0)) + 1;
      base.carpetas.push({ uid: nuevoId(), nombre, color, orden, borrada: 0, modificada: ahora() });
      guardarTodo();
      vista = "carpetas";
      mostrarLista();
      anunciar("Carpeta creada");
    };
    document.getElementById("no-nombre-carpeta").focus();
  }

  function carpetaEditar() {
    const carpeta = carpetaPorId(carpetaAbierta);
    if (!carpeta) return;
    let color = carpeta.color;
    const lista = document.getElementById("no-lista");
    document.getElementById("no-menu").hidden = true;
    lista.innerHTML = `
      <p class="tf-etiqueta">Editar carpeta</p>
      <input id="no-nombre-carpeta" class="tf-campo no-ancho" placeholder="Nombre de la carpeta" value="${escapar(carpeta.nombre)}">
      <div class="no-colores" id="no-colores">
        ${COLORES_CARPETA.map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}
      </div>
      <div class="tf-fila tf-final">
        <button class="tf-boton secundario" id="no-cancelar-carpeta">Cancelar</button>
        <button class="tf-boton" id="no-guardar-carpeta">Guardar</button>
      </div>`;
    const marcar = () => lista.querySelectorAll("[data-color]").forEach((b) => b.classList.toggle("activa", b.dataset.color === color));
    lista.querySelectorAll("[data-color]").forEach((b) => { b.onclick = () => { color = b.dataset.color; marcar(); }; });
    marcar();
    document.getElementById("no-cancelar-carpeta").onclick = dibujarLista;
    document.getElementById("no-guardar-carpeta").onclick = () => {
      const nombre = document.getElementById("no-nombre-carpeta").value.trim();
      if (!nombre) return;
      Object.assign(carpeta, { nombre, color, modificada: ahora() });
      guardarTodo();
      mostrarLista();
      anunciar("Carpeta guardada");
    };
  }

  function carpetaBorrar() {
    const carpeta = carpetaPorId(carpetaAbierta);
    if (!carpeta) return;
    const adentro = base.notas.filter((n) => !n.borrada && n.carpeta === carpeta.uid);
    const lista = document.getElementById("no-lista");
    document.getElementById("no-menu").hidden = true;
    lista.innerHTML = `
      <p class="tf-etiqueta">Borrar carpeta</p>
      <p class="tf-mensaje">¿Borrás la carpeta <b>${escapar(carpeta.nombre)}</b>?
        ${adentro.length === 1 ? "Su nota no se borra: queda suelta." : adentro.length ? `Sus ${adentro.length} notas no se borran: quedan sueltas.` : "Está vacía."}</p>
      <div class="tf-fila tf-final">
        <button class="tf-boton secundario" id="no-cancelar-borrar">Cancelar</button>
        <button class="tf-boton" id="no-confirmar-borrar">Borrar</button>
      </div>`;
    document.getElementById("no-cancelar-borrar").onclick = dibujarLista;
    document.getElementById("no-confirmar-borrar").onclick = () => {
      Object.assign(carpeta, { borrada: 1, modificada: ahora() });
      adentro.forEach((n) => Object.assign(n, { carpeta: null, modificada: ahora() }));
      guardarTodo();
      carpetaAbierta = null;
      vista = "carpetas";
      mostrarLista();
      anunciar("Carpeta borrada");
    };
  }

  // ================= EL EDITOR =================
  function abrirNota(id) {
    nota = id ? base.notas.find((n) => n.uid === id) : null;
    alineacion = 0;
    rangoGuardado = null;
    contenedor.innerHTML = `
      <div class="no-raiz">
        <div class="no-barra">
          ${boton("no-atras", "‹", "Volver a la lista")}
          <input id="no-titulo" class="no-campo-titulo" placeholder="Título" value="${escapar(nota ? nota.titulo : "")}">
          ${boton("no-aa", "Aa", "Edición", "clara")}
          ${boton("no-mas", "⋯", "Opciones")}
        </div>
        <div class="no-herramientas desplazable" id="no-herramientas" hidden>
          <button data-cmd="bold" aria-label="Negrita"><b>B</b></button>
          <button data-cmd="italic" aria-label="Cursiva"><i class="no-cursiva">I</i></button>
          <button data-cmd="underline" aria-label="Subrayado"><u>U</u></button>
          <button data-tam="-1" aria-label="Letra más chica">A-</button>
          <button data-tam="1" aria-label="Letra más grande">A+</button>
          <button id="no-btn-color" aria-label="Color de letra"><span class="no-rueda"></span></button>
          <button id="no-btn-resaltar" aria-label="Resaltar"><span class="no-marcador"></span></button>
          <button id="no-btn-casilla" aria-label="Casilla de pendiente"><span class="no-cuadradito"></span></button>
          <button data-cmd="insertUnorderedList" aria-label="Viñetas">•</button>
          <button id="no-btn-alinear" aria-label="Alinear">≡</button>
          <button id="no-btn-imagen" aria-label="Agregar imagen">▣</button>
        </div>
        <div class="no-colores" id="no-paleta" hidden>
          ${COLORES_LETRA.map((c) => `<button data-color="${c}" style="background:${c}" aria-label="Color ${c}"></button>`).join("")}
        </div>
        <div class="no-texto desplazable" id="no-texto" contenteditable="true" data-placeholder="Escribí tu nota…">${nota ? nota.html : ""}</div>
        <div class="no-menu" id="no-menu" hidden>
          <button data-accion="fijar">${conIcono("fijar", nota && nota.fijada ? "Desfijar" : "Fijar arriba")}</button>
          <button data-accion="carpeta">${conIcono("carpeta", "Mover a carpeta")}</button>
          <button data-accion="qr">${conIcono("qr", "Llevar al celu (QR)")}</button>
          <button data-accion="compartir">${conIcono("compartir", "Compartir como texto")}</button>
          <button data-accion="colaborar">${conIcono("colaborar", "Colaborar con un código")}</button>
          <button data-accion="borrar" class="no-peligro">${conIcono("borrar", "Borrar nota")}</button>
        </div>
        <div class="no-panel desplazable" id="no-panel" hidden></div>
        <input type="file" id="no-archivo" accept="image/*" hidden>
      </div>`;

    const $ = (id) => document.getElementById(id);
    const texto = $("no-texto");

    $("no-atras").onclick = () => { guardarAhora(); mostrarLista(); };
    $("no-titulo").oninput = programarGuardado;
    texto.oninput = programarGuardado;
    $("no-aa").onclick = () => {
      const barra = $("no-herramientas");
      barra.hidden = !barra.hidden;
      $("no-aa").classList.toggle("activa", !barra.hidden);
      if (barra.hidden) $("no-paleta").hidden = true;
    };
    $("no-mas").onclick = () => { $("no-menu").hidden = !$("no-menu").hidden; };

    // Que las herramientas no le saquen el cursor al texto
    ["no-herramientas", "no-paleta", "no-aa"].forEach((id) => {
      $(id).addEventListener("pointerdown", (e) => e.preventDefault());   // en el celular
      $(id).addEventListener("mousedown", (e) => e.preventDefault());     // con el mouse
    });

    contenedor.querySelectorAll("[data-cmd]").forEach((b) => { b.onclick = () => comando(b.dataset.cmd); });
    contenedor.querySelectorAll("[data-tam]").forEach((b) => {
      b.onclick = () => {
        const actual = Number(document.queryCommandValue("fontSize")) || 3;
        comando("fontSize", String(Math.max(1, Math.min(7, actual + Number(b.dataset.tam)))));
      };
    });
    $("no-btn-color").onclick = () => { $("no-paleta").hidden = !$("no-paleta").hidden; };
    $("no-paleta").querySelectorAll("[data-color]").forEach((b) => {
      b.onclick = () => { comando("foreColor", b.dataset.color); $("no-paleta").hidden = true; };
    });
    $("no-btn-resaltar").onclick = () => {
      const ya = document.queryCommandValue("backColor") === "rgb(255, 241, 118)";
      comando("hiliteColor", ya ? "transparent" : RESALTADO);
    };
    $("no-btn-casilla").onclick = () => comando("insertHTML", '<span class="caja" contenteditable="false">☐</span>&nbsp;');
    $("no-btn-alinear").onclick = () => { alineacion = (alineacion + 1) % ALINEACIONES.length; comando(ALINEACIONES[alineacion]); };
    $("no-btn-imagen").onclick = () => $("no-archivo").click();
    $("no-archivo").onchange = insertarImagen;

    // Tildar o destildar una casilla
    texto.addEventListener("click", (e) => {
      if (e.target.classList.contains("caja")) {
        const hecha = e.target.classList.toggle("hecha");
        e.target.textContent = hecha ? "☑" : "☐";
        programarGuardado();
      }
    });

    // Con el teclado abierto, la consola se pega arriba
    texto.addEventListener("focus", () => document.body.classList.add("escribiendo"));
    texto.addEventListener("blur", () => document.body.classList.remove("escribiendo"));

    contenedor.querySelectorAll("#no-menu [data-accion]").forEach((b) => {
      b.onclick = () => { $("no-menu").hidden = true; accion(b.dataset.accion); };
    });

    if (!nota) setTimeout(() => $("no-titulo").focus(), 300);
  }

  function comando(cmd, valor = null) {
    const texto = document.getElementById("no-texto");
    const rango = rangoGuardado;               // se copia antes, porque focus() lo puede cambiar
    texto.focus();
    if (rango && texto.contains(rango.commonAncestorContainer)) {
      const seleccion = window.getSelection();
      seleccion.removeAllRanges();
      seleccion.addRange(rango);
    }
    document.execCommand(cmd, false, valor);
    programarGuardado();
  }

  // Las fotos se achican antes de guardarlas, para que las notas no pesen demasiado.
  function insertarImagen(e) {
    const archivo = e.target.files[0];
    e.target.value = "";
    if (!archivo) return;
    const lector = new FileReader();
    lector.onload = () => {
      const imagen = new Image();
      imagen.onload = () => {
        const escala = Math.min(1, 800 / Math.max(imagen.width, imagen.height));
        const lienzo = document.createElement("canvas");
        lienzo.width = Math.round(imagen.width * escala);
        lienzo.height = Math.round(imagen.height * escala);
        lienzo.getContext("2d").drawImage(imagen, 0, 0, lienzo.width, lienzo.height);
        comando("insertHTML", `<img src="${lienzo.toDataURL("image/jpeg", 0.8)}">`);
      };
      imagen.src = lector.result;
    };
    lector.readAsDataURL(archivo);
  }

  // --- Guardado automático ---
  function programarGuardado() {
    clearTimeout(relojGuardar);
    relojGuardar = setTimeout(guardarAhora, 900);
  }

  function guardarAhora() {
    clearTimeout(relojGuardar);
    const tituloEl = document.getElementById("no-titulo");
    const textoEl = document.getElementById("no-texto");
    if (!tituloEl || !textoEl) return;
    const titulo = tituloEl.value.trim();
    const html = textoEl.innerHTML;
    const texto = textoEl.innerText.trim();
    if (!nota) {
      if (!titulo && !texto && !html.includes("<img")) return;   // una nota vacía no se guarda
      nota = {
        uid: nuevoId(), carpeta: carpetaAbierta, titulo: "", html: "", texto: "",
        fijada: 0, borrada: 0, creada: ahora(), modificada: ahora(), orden: 0,
      };
      base.notas.push(nota);
    }
    if (nota.titulo === titulo && nota.html === html) return;
    Object.assign(nota, { titulo, html, texto, modificada: ahora() });
    guardarTodo();
    anunciar("Guardado");
  }

  // --- Lo que hay en ⋯ ---
  function accion(nombre) {
    guardarAhora();
    const panel = document.getElementById("no-panel");
    if (nombre === "fijar") {
      if (!nota) return anunciar("Escribí algo primero");
      nota.fijada = nota.fijada ? 0 : 1;
      nota.modificada = ahora();
      guardarTodo();
      anunciar(nota.fijada ? "Fijada arriba" : "Desfijada");
      contenedor.querySelector('[data-accion="fijar"]').innerHTML = conIcono("fijar", nota.fijada ? "Desfijar" : "Fijar arriba");
    } else if (nombre === "carpeta") {
      if (!nota) return anunciar("Escribí algo primero");
      const opciones = [{ uid: null, nombre: "Sin carpeta", color: "#8A94AB" }, ...carpetasVivas()];
      panel.innerHTML = `<p class="tf-etiqueta">Mover a…</p>` + opciones.map((c) =>
        `<button class="no-tarjeta" data-mover="${c.uid || ""}"><span class="no-punto" style="background:${c.color}"></span>
          <span class="no-cuerpo"><b>${escapar(c.nombre)}</b></span>${(nota.carpeta || "") === (c.uid || "") ? "✓" : ""}</button>`).join("") +
        `<div class="tf-fila tf-final"><button class="tf-boton secundario" id="no-cerrar-panel">Volver a la nota</button></div>`;
      panel.hidden = false;
      panel.querySelectorAll("[data-mover]").forEach((b) => {
        b.onclick = () => {
          nota.carpeta = b.dataset.mover || null;
          nota.modificada = ahora();
          guardarTodo();
          panel.hidden = true;
          anunciar("Movida");
        };
      });
      document.getElementById("no-cerrar-panel").onclick = () => { panel.hidden = true; };
    } else if (nombre === "qr") {
      const contenido = textoParaCompartir();
      let interior;
      if (!contenido) {
        interior = '<p class="tf-mensaje">La nota está vacía.</p>';
      } else {
        try {
          qrcode.stringToBytes = qrcode.stringToBytesFuncs["UTF-8"];
          const qr = qrcode(0, "L");
          qr.addData(contenido);
          qr.make();
          interior = `<div class="no-qr">${qr.createSvgTag({ cellSize: 3, margin: 2, scalable: true })}</div>
            <p class="tf-mensaje">Escaneá con otro celular</p>`;
        } catch (error) {
          interior = '<p class="tf-mensaje">La nota es muy larga para un QR. Probá con "Compartir como texto".</p>';
        }
      }
      panel.innerHTML = interior + '<div class="tf-fila tf-final"><button class="tf-boton secundario" id="no-cerrar-panel">Volver a la nota</button></div>';
      panel.hidden = false;
      document.getElementById("no-cerrar-panel").onclick = () => { panel.hidden = true; };
    } else if (nombre === "compartir") {
      compartir();
    } else if (nombre === "colaborar") {
      anunciar("Colaborar llega con la sincronización");
    } else if (nombre === "borrar") {
      if (nota) {
        ultimaBorrada = { ...nota };
        Object.assign(nota, { borrada: 1, titulo: "", html: "", texto: "", modificada: ahora() });
        guardarTodo();
        anunciar("Nota borrada");
      }
      mostrarLista();
    }
  }

  function textoParaCompartir() {
    const titulo = (document.getElementById("no-titulo") || {}).value || "";
    const cuerpo = ((document.getElementById("no-texto") || {}).innerText || "").trim();
    return titulo.trim() ? `${titulo.trim()}\n\n${cuerpo}` : cuerpo;
  }

  // Abre el "Compartir" del celular (WhatsApp, mail, etc.). Si no se puede, lo copia.
  async function compartir() {
    const contenido = textoParaCompartir();
    if (!contenido) return anunciar("La nota está vacía");
    const Share = window.Capacitor && Capacitor.Plugins && Capacitor.Plugins.Share;
    try {
      if (Share) {
        await Share.share({ title: document.getElementById("no-titulo").value || "Nota de Quipu", text: contenido });
        return;
      }
    } catch (error) {
      if (String(error).includes("cancel")) return;
    }
    try {
      await navigator.clipboard.writeText(contenido);
      anunciar("Copiada: pegala donde quieras");
    } catch (error) {
      anunciar("No pude compartirla");
    }
  }

  MODULOS.notas = {
    abrir(lugar) {
      contenedor = lugar;
      abierto = true;
      cargar();
      cabeceraConsola(false);
      carpetaAbierta = null;
      buscando = "";
      mostrarLista();
      const cuantas = base.notas.filter((n) => !n.borrada).length;
      anunciar(cuantas === 1 ? "1 nota" : `${cuantas} notas`);
    },
    cerrar() {
      guardarAhora();
      abierto = false;
      cabeceraConsola(true);
      document.body.classList.remove("escribiendo");
    },
  };
})();
