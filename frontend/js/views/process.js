import { html, useState, useEffect, useCallback } from "../react.js";
import { api } from "../api.js";
import { lineaValida, METODO_ES, CAT_ES, totalDe } from "../utils.js";

const PRESETS = [
  { nombre: "Horizontal (el tráfico viene de frente o de espaldas)", linea: [0.28, 0.5, 0.95, 0.5] },
  { nombre: "Vertical (el tráfico cruza de lado a lado)", linea: [0.5, 0.3, 0.5, 0.65] },
];
const EXTENSIONES = [".mp4", ".avi", ".mov", ".mkv"];
const MAX_MB = 200;

// Dibujo de la línea de conteo sobre un rectángulo con la proporción del video vertical (464x832)
export function VistaLinea({ linea }) {
  const ok = lineaValida(linea);
  const W = 116, H = 208;
  return html`
    <svg className="vista-linea" width=${W} height=${H} viewBox=${`0 0 ${W} ${H}`} role="img"
         aria-label=${ok ? "Posición de la línea de conteo sobre el encuadre" : "Línea no válida"}>
      ${ok && html`<line x1=${linea[0] * W} y1=${linea[1] * H} x2=${linea[2] * W} y2=${linea[3] * H}
                         stroke="#d33" strokeWidth="3" />`}
    </svg>`;
}

export function FormFuente({ onCreada }) {
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [linea, setLinea] = useState(PRESETS[0].linea.map(String));
  const [autorizada, setAutorizada] = useState(true);
  const [error, setError] = useState("");
  const [guardando, setGuardando] = useState(false);
  const numeros = linea.map((v) => (v === "" ? NaN : Number(v)));
  const valida = lineaValida(numeros);
  const nombres = ["x1", "y1", "x2", "y2"];

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setGuardando(true);
    try {
      const f = await api("/sources", {
        method: "POST",
        json: { name: nombre.trim(), description: descripcion.trim(), line: numeros, authorized: autorizada },
      });
      onCreada(f);
      setNombre(""); setDescripcion("");
    } catch (err) {
      setError(err.message);
    }
    setGuardando(false);
  }

  return html`
    <form className="formulario" onSubmit=${enviar}>
      <label htmlFor="f-nombre">Nombre de la fuente
        <input id="f-nombre" value=${nombre} required minLength="2" maxLength="100" onChange=${(e) => setNombre(e.target.value)} />
      </label>
      <label htmlFor="f-desc">Descripción (opcional)
        <input id="f-desc" value=${descripcion} maxLength="500" onChange=${(e) => setDescripcion(e.target.value)} />
      </label>
      <fieldset>
        <legend>Línea de conteo (valores entre 0 y 1: 0 = borde izquierdo/superior, 1 = borde derecho/inferior)</legend>
        <p>
          ${PRESETS.map((p) => html`
            <button key=${p.nombre} type="button" className="boton secundario"
                    onClick=${() => setLinea(p.linea.map(String))}>${p.nombre}</button> `)}
        </p>
        <div className="fila">
          ${nombres.map((n, i) => html`
            <label key=${n} htmlFor=${"l-" + n}>${n}
              <input id=${"l-" + n} type="number" min="0" max="1" step="0.01" value=${linea[i]}
                     onChange=${(e) => setLinea(linea.map((v, j) => (j === i ? e.target.value : v)))} />
            </label>`)}
          <${VistaLinea} linea=${numeros} />
        </div>
        ${!valida && html`<div className="aviso alerta" role="alert">La línea debe tener 4 valores entre 0 y 1 y dos puntos distintos.</div>`}
      </fieldset>
      <label><span><input type="checkbox" checked=${autorizada} onChange=${(e) => setAutorizada(e.target.checked)} />
        La fuente de video está autorizada para su procesamiento</span></label>
      ${error && html`<div className="aviso error" role="alert">${error}</div>`}
      <button className="boton" type="submit" disabled=${guardando || !valida}>${guardando ? "Guardando…" : "Crear fuente"}</button>
    </form>`;
}

export function EstadoTrabajo({ job }) {
  if (!job) return html`<p className="muted" role="status">Consultando el estado…</p>`;
  const totales = job.totals || {};
  return html`
    <div role="status" aria-live="polite">
      <p>Estado: <span className=${"estado-trabajo " + job.status}>${job.status}</span>
        ${(job.status === "pendiente" || job.status === "procesando") && " — procesando en CPU, puede tardar uno o dos minutos…"}</p>
      ${job.status === "error" && html`<div className="aviso error" role="alert">${job.error || "Error desconocido"}</div>`}
      ${job.status === "completado" && html`
        <div className="aviso ok">
          Listo: ${totalDe(totales)} vehículos contados
          (${Object.entries(totales).map(([c, n]) => `${CAT_ES[c] || c}: ${n}`).join(", ") || "ninguno"}).
          Velocidad: ${job.ai_meta?.processing_fps ?? "—"} FPS. Revísalo en el Dashboard.
        </div>`}
    </div>`;
}

export function SeguimientoTrabajo({ jobId }) {
  const [job, setJob] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let activo = true;
    let timer;
    setJob(null);
    const consultar = async () => {
      try {
        const j = await api(`/jobs/${jobId}`);
        if (!activo) return;
        setJob(j);
        setError("");
        if (j.status === "completado" || j.status === "error") return;
      } catch (e) {
        if (!activo) return;
        setError(e.message);
      }
      timer = setTimeout(consultar, 3000);
    };
    consultar();
    return () => { activo = false; clearTimeout(timer); };
  }, [jobId]);

  return html`
    <div>
      <p className="muted">Trabajo <code>${jobId}</code></p>
      ${error && html`<div className="aviso alerta" role="alert">${error}</div>`}
      <${EstadoTrabajo} job=${job} />
    </div>`;
}

export function FormTrabajo({ fuentes, onCreado }) {
  const autorizadas = fuentes.filter((f) => f.authorized);
  const [fuenteId, setFuenteId] = useState(autorizadas[0]?.id || "");
  const [metodo, setMetodo] = useState("yolo26");
  const [intervalo, setIntervalo] = useState(10);
  const [fecha, setFecha] = useState("");
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    if (!archivo) { setError("Elige un archivo de video."); return; }
    const ext = archivo.name.slice(archivo.name.lastIndexOf(".")).toLowerCase();
    if (!EXTENSIONES.includes(ext)) { setError(`Formato no permitido. Usa: ${EXTENSIONES.join(", ")}`); return; }
    if (archivo.size > MAX_MB * 1024 * 1024) { setError(`El archivo supera ${MAX_MB} MB.`); return; }
    setEnviando(true);
    try {
      const fd = new FormData();
      fd.append("source_id", fuenteId);
      fd.append("method", metodo);
      fd.append("interval_seconds", String(intervalo));
      if (fecha) fd.append("recorded_at", new Date(fecha).toISOString());
      fd.append("file", archivo);
      const r = await api("/jobs", { method: "POST", form: fd });
      onCreado(r.id);
    } catch (err) {
      setError(err.message);
    }
    setEnviando(false);
  }

  if (autorizadas.length === 0) {
    return html`<p className="aviso info">Primero crea una fuente autorizada (formulario de arriba).</p>`;
  }
  return html`
    <form className="formulario" onSubmit=${enviar}>
      <label htmlFor="t-fuente">Fuente de video
        <select id="t-fuente" value=${fuenteId} onChange=${(e) => setFuenteId(e.target.value)}>
          ${autorizadas.map((f) => html`<option key=${f.id} value=${f.id}>${f.name}</option>`)}
        </select>
      </label>
      <label htmlFor="t-metodo">Método de análisis
        <select id="t-metodo" value=${metodo} onChange=${(e) => setMetodo(e.target.value)}>
          ${Object.entries(METODO_ES).map(([k, v]) => html`<option key=${k} value=${k}>${v}</option>`)}
        </select>
      </label>
      <label htmlFor="t-int">Intervalo de agregación (segundos)
        <input id="t-int" type="number" min="1" max="3600" value=${intervalo} onChange=${(e) => setIntervalo(Number(e.target.value) || 10)} />
      </label>
      <label htmlFor="t-fecha">Fecha y hora de la grabación (opcional)
        <input id="t-fecha" type="datetime-local" value=${fecha} onChange=${(e) => setFecha(e.target.value)} />
        <small>Si la dejas vacía se usa la hora actual.</small>
      </label>
      <label htmlFor="t-archivo">Video (${EXTENSIONES.join(", ")}; máx. ${MAX_MB} MB)
        <input id="t-archivo" type="file" accept="video/*" onChange=${(e) => setArchivo(e.target.files[0] || null)} />
      </label>
      ${error && html`<div className="aviso error" role="alert">${error}</div>`}
      <button className="boton" type="submit" disabled=${enviando}>${enviando ? "Subiendo video…" : "Procesar video"}</button>
    </form>`;
}

export function Procesar({ sesion }) {
  const [fuentes, setFuentes] = useState(null);
  const [error, setError] = useState("");
  const [jobId, setJobId] = useState("");

  const cargar = useCallback(async () => {
    try {
      setFuentes(await api("/sources"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  if (sesion.role === "usuario") {
    return html`<section className="panel"><h2>Procesar video</h2>
      <p className="aviso info">Tu rol es <strong>usuario</strong>: puedes consultar resultados, pero no procesar videos.
      Pide a un administrador que te asigne el rol de operador.</p></section>`;
  }
  return html`
    <div>
      ${error && html`<div className="aviso error" role="alert">${error}</div>`}
      <section className="panel">
        <h2>1. Fuente de video y línea de conteo</h2>
        <p className="muted">La línea decide qué vehículos se cuentan: se cuenta cada vehículo cuando la cruza.
          Cada ángulo de cámara necesita su propia fuente.</p>
        <${FormFuente} onCreada=${() => cargar()} />
        ${fuentes && fuentes.length > 0 && html`<p className="muted">Fuentes existentes: ${fuentes.map((f) => f.name).join(" · ")}</p>`}
      </section>
      <section className="panel">
        <h2>2. Subir y procesar un video</h2>
        ${fuentes === null ? html`<p className="cargando" role="status">Cargando fuentes…</p>`
          : html`<${FormTrabajo} key=${fuentes.length} fuentes=${fuentes} onCreado=${setJobId} />`}
      </section>
      ${jobId && html`<section className="panel"><h2>3. Seguimiento</h2><${SeguimientoTrabajo} jobId=${jobId} /></section>`}
    </div>`;
}
