import { html, useState, useEffect } from "../react.js";
import { api } from "../api.js";
import { BarChart, Tabla } from "../charts.js";
import { CATEGORIAS, CAT_ES, METODO_ES, COLOR_METODO, fmtFecha, nombreCorto, seriesPorVideo } from "../utils.js";

const num = (v) => (v === null || v === undefined ? "—" : v);

// ev: documento guardado por el notebook en la colección "evaluations"
export function VistaEvaluacion({ ev }) {
  const global = ev.global_por_metodo || [];
  const metodos = global.map((g) => g.method);
  const etiquetasMetodo = metodos.map((m) => METODO_ES[m] || m);
  const colPorVideo = [
    { clave: "video", titulo: "Video", fmt: (v) => nombreCorto(v) },
    { clave: "method", titulo: "Método", fmt: (v) => METODO_ES[v] || v },
    { clave: "real_total", titulo: "Real" },
    { clave: "predicho_total", titulo: "Predicho" },
    { clave: "error_conteo_total_%", titulo: "Error total (%)", fmt: num },
    { clave: "error_abs_categoria_%", titulo: "Error por categoría (%)", fmt: num },
    { clave: "MAE_por_categoria", titulo: "MAE por categoría", fmt: num },
    { clave: "FPS", titulo: "FPS", fmt: num },
  ];
  const disp = ev.disponibilidad ? [ev.disponibilidad] : [];
  const colDisp = [
    { clave: "solicitudes", titulo: "Solicitudes" }, { clave: "correctas", titulo: "Correctas" },
    { clave: "disponibilidad_%", titulo: "Disponibilidad (%)" },
    { clave: "latencia_media_ms", titulo: "Latencia media (ms)", fmt: num },
    { clave: "latencia_p95_ms", titulo: "Latencia p95 (ms)", fmt: num },
  ];
  const colVersiones = [
    { clave: "method", titulo: "Método", fmt: (v) => METODO_ES[v] || v }, { clave: "model", titulo: "Modelo" },
    { clave: "library", titulo: "Librería" }, { clave: "library_version", titulo: "Versión", fmt: num },
    { clave: "device", titulo: "Dispositivo", fmt: num },
  ];

  return html`
    <div>
      <section className="panel">
        <h2>Evaluación del modelo</h2>
        <dl className="datos">
          <dt>Generada</dt><dd>${fmtFecha(ev.created_at)}</dd>
          <dt>Videos evaluados</dt><dd>${(ev.videos || []).map(nombreCorto).join(", ") || "—"}</dd>
          <dt>Criterio del conteo real</dt><dd>${ev.criterio_verdad_terreno || "—"}</dd>
          <dt>Datos consistentes (counts vs jobs)</dt><dd>${ev.consistencia_counts_vs_jobs ? "Sí" : "No"}</dd>
        </dl>
      </section>
      <section className="panel">
        <h3>Comparación global entre métodos</h3>
        <${BarChart} titulo="Error absoluto por categoría (%) — menor es mejor" etiquetas=${etiquetasMetodo}
          series=${[{ nombre: "Error (%)", color: "#bf616a", valores: global.map((g) => Number(g["error_abs_categoria_%"] || 0)) }]}
          formato=${(v) => v + "%"} />
        <${BarChart} titulo="Velocidad de procesamiento en CPU (FPS)" etiquetas=${etiquetasMetodo}
          series=${[{ nombre: "FPS promedio", color: "#5e81ac", valores: global.map((g) => Number(g.FPS_promedio || 0)) }]} />
      </section>
      <section className="panel">
        <h3>Conteo por categoría en cada video</h3>
        ${(ev.videos || []).map((v) => html`
          <${BarChart} key=${v} titulo=${nombreCorto(v)} etiquetas=${CATEGORIAS.map((c) => CAT_ES[c])}
            series=${seriesPorVideo(ev.por_categoria, v)} />`)}
      </section>
      <section className="panel">
        <${Tabla} titulo="Métricas por video y método" columnas=${colPorVideo} filas=${ev.por_video_metodo || []} />
      </section>
      <section className="panel">
        <${Tabla} titulo="Disponibilidad y tiempo de respuesta de la API" columnas=${colDisp} filas=${disp} />
        <${Tabla} titulo="Versiones de modelo usadas" columnas=${colVersiones} filas=${ev.versiones_modelo || []} />
        ${(ev.metricas_pendientes || []).length > 0 && html`
          <div className="aviso alerta"><strong>Métricas pendientes:</strong>
            <ul>${ev.metricas_pendientes.map((m) => html`<li key=${m}>${m}</li>`)}</ul></div>`}
      </section>
    </div>`;
}

export function Evaluacion() {
  const [ev, setEv] = useState(null);
  const [mensaje, setMensaje] = useState("");
  const [cargado, setCargado] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setEv(await api("/evaluations/latest"));
      } catch (e) {
        setMensaje(e.status === 404 ? "Aún no hay evaluaciones guardadas. Ejecuta el notebook de evaluación." : e.message);
      }
      setCargado(true);
    })();
  }, []);

  if (!cargado) return html`<p className="cargando" role="status">Cargando…</p>`;
  if (!ev) return html`<section className="panel"><h2>Evaluación del modelo</h2><div className="aviso info" role="status">${mensaje}</div></section>`;
  return html`<${VistaEvaluacion} ev=${ev} />`;
}
