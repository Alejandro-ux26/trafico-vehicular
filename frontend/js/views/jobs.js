import { html, useState, useEffect, useCallback } from "../react.js";
import { api } from "../api.js";
import { Tabla } from "../charts.js";
import { METODO_ES, CAT_ES, fmtFecha, totalDe, nombreCorto } from "../utils.js";

export function TablaTrabajos({ trabajos, onVer }) {
  const columnas = [
    { clave: "original_name", titulo: "Video", fmt: (v) => nombreCorto(v) },
    { clave: "method", titulo: "Método", fmt: (v) => METODO_ES[v] || v },
    { clave: "status", titulo: "Estado", fmt: (v) => html`<span className=${"estado-trabajo " + v}>${v}</span>` },
    { clave: "totals", titulo: "Vehículos", fmt: (v) => (v ? totalDe(v) : "—") },
    { clave: "ai_meta", titulo: "FPS", fmt: (v) => v?.processing_fps ?? "—" },
    { clave: "created_at", titulo: "Creado", fmt: (v) => fmtFecha(v) },
    { clave: "id", titulo: "Detalle", fmt: (v) => html`<button className="boton secundario" onClick=${() => onVer(v)}>Ver</button>` },
  ];
  return html`<${Tabla} titulo="Trabajos de procesamiento" columnas=${columnas} filas=${trabajos} vacio="Todavía no hay trabajos." />`;
}

export function DetalleTrabajo({ job }) {
  const meta = job.ai_meta || {};
  return html`
    <section className="panel" aria-label="Detalle del trabajo">
      <h3>Detalle del trabajo</h3>
      <dl className="datos">
        <dt>Id</dt><dd>${job.id}</dd>
        <dt>Video</dt><dd>${job.original_name}</dd>
        <dt>Método</dt><dd>${METODO_ES[job.method] || job.method}</dd>
        <dt>Estado</dt><dd><span className=${"estado-trabajo " + job.status}>${job.status}</span></dd>
        <dt>Creado por</dt><dd>${job.created_by}</dd>
        <dt>Grabado</dt><dd>${fmtFecha(job.recorded_at)}</dd>
        <dt>Modelo</dt><dd>${meta.model || "—"} ${meta.ultralytics_version || meta.opencv_version || ""} (${meta.device || "—"})</dd>
        <dt>Velocidad</dt><dd>${meta.processing_fps ?? "—"} FPS · ${meta.elapsed_s ?? "—"} s · ${meta.frames_processed ?? "—"} fotogramas</dd>
        <dt>Conteo</dt><dd>${job.totals ? Object.entries(job.totals).map(([c, n]) => `${CAT_ES[c] || c}: ${n}`).join(" · ") || "ninguno" : "—"}</dd>
      </dl>
      ${job.error && html`<div className="aviso error" role="alert">${job.error}</div>`}
      ${meta.params && html`<details><summary>Parámetros y metadatos de la IA</summary><pre>${JSON.stringify(meta, null, 2)}</pre></details>`}
    </section>`;
}

export function Trabajos() {
  const [trabajos, setTrabajos] = useState(null);
  const [error, setError] = useState("");
  const [sel, setSel] = useState(null);

  const cargar = useCallback(async () => {
    try {
      setTrabajos(await api("/jobs"));
      setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  return html`
    <div>
      <section className="panel">
        <h2>Trabajos</h2>
        <p><button className="boton secundario" onClick=${cargar}>Actualizar</button></p>
        ${error && html`<div className="aviso error" role="alert">${error}</div>`}
        ${trabajos === null && !error ? html`<p className="cargando" role="status">Cargando…</p>`
          : trabajos && html`<${TablaTrabajos} trabajos=${trabajos} onVer=${(id) => setSel(trabajos.find((t) => t.id === id))} />`}
      </section>
      ${sel && html`<${DetalleTrabajo} job=${sel} />`}
    </div>`;
}
