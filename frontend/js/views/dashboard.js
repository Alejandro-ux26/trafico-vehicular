import { html, useState, useEffect } from "../react.js";
import { api } from "../api.js";
import { BarChart, Tabla } from "../charts.js";
import { CATEGORIAS, CAT_ES, PALETA, etiquetaTrabajo, etiquetaIntervalo, porIntervalo, totalDe, fmtFecha } from "../utils.js";

// selecciones: [{ job, intervalos: { interval_seconds, items } }]  (1 o 2 trabajos)
export function VistaDashboard({ selecciones }) {
  if (!selecciones || selecciones.length === 0) {
    return html`<p className="aviso info">Elige un trabajo completado para ver sus resultados.</p>`;
  }
  const series = selecciones.map((s, i) => ({
    nombre: etiquetaTrabajo(s.job), color: PALETA[i % PALETA.length],
    valores: CATEGORIAS.map((c) => Number(s.job.totals?.[c] || 0)),
  }));
  const duracion = selecciones[0].intervalos?.interval_seconds || 10;
  const agrupado = selecciones.map((s) => porIntervalo(s.intervalos?.items || []));
  const inicios = [...new Set(agrupado.flatMap((a) => a.inicios))].sort((a, b) => a - b);
  const seriesInt = selecciones.map((s, i) => ({
    nombre: etiquetaTrabajo(s.job), color: PALETA[i % PALETA.length],
    valores: inicios.map((t) => {
      const k = agrupado[i].inicios.indexOf(t);
      return k >= 0 ? agrupado[i].totales[k] : 0;
    }),
  }));
  const filas = CATEGORIAS.map((c, ci) => ({
    categoria: CAT_ES[c], ...Object.fromEntries(series.map((s, i) => ["s" + i, s.valores[ci]])),
  }));
  const columnas = [{ clave: "categoria", titulo: "Categoría" },
    ...series.map((s, i) => ({ clave: "s" + i, titulo: s.nombre }))];

  return html`
    <div>
      <div className="cuadricula">
        ${selecciones.map((s, i) => html`
          <div key=${s.job.id} className="tarjeta">
            <div className="etiqueta">${etiquetaTrabajo(s.job)}</div>
            <div className="valor">${totalDe(s.job.totals)}</div>
            <div className="etiqueta">vehículos contados · ${s.job.ai_meta?.processing_fps ?? "—"} FPS · ${fmtFecha(s.job.created_at)}</div>
          </div>`)}
      </div>
      <section className="panel">
        <${BarChart} titulo="Vehículos por categoría" etiquetas=${CATEGORIAS.map((c) => CAT_ES[c])} series=${series} />
        <${Tabla} columnas=${columnas} filas=${filas} />
      </section>
      <section className="panel">
        <${BarChart} titulo="Flujo por intervalo de tiempo" etiquetas=${inicios.map((t) => etiquetaIntervalo(t, duracion))}
                     series=${seriesInt} />
        <p className="muted">El último intervalo puede ser más corto que los demás.</p>
      </section>
    </div>`;
}

export function Dashboard() {
  const [trabajos, setTrabajos] = useState(null);
  const [idA, setIdA] = useState("");
  const [idB, setIdB] = useState("");
  const [selecciones, setSelecciones] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    (async () => {
      try {
        const lista = (await api("/jobs")).filter((j) => j.status === "completado");
        setTrabajos(lista);
        if (lista.length) setIdA(lista[0].id);
      } catch (e) {
        setError(e.message);
      }
    })();
  }, []);

  useEffect(() => {
    if (!trabajos || !idA) return;
    let activo = true;
    (async () => {
      try {
        const ids = [idA, idB].filter(Boolean);
        const datos = await Promise.all(ids.map(async (id) => ({
          job: trabajos.find((t) => t.id === id),
          intervalos: await api(`/jobs/${id}/intervals`),
        })));
        if (activo) { setSelecciones(datos); setError(""); }
      } catch (e) {
        if (activo) setError(e.message);
      }
    })();
    return () => { activo = false; };
  }, [trabajos, idA, idB]);

  return html`
    <div>
      <section className="panel">
        <h2>Dashboard</h2>
        ${trabajos === null && !error && html`<p className="cargando" role="status">Cargando…</p>`}
        ${error && html`<div className="aviso error" role="alert">${error}</div>`}
        ${trabajos && trabajos.length === 0 && html`<p className="aviso info">Aún no hay trabajos completados. Procesa un video primero.</p>`}
        ${trabajos && trabajos.length > 0 && html`
          <div className="fila">
            <label htmlFor="d-a">Trabajo
              <select id="d-a" value=${idA} onChange=${(e) => setIdA(e.target.value)}>
                ${trabajos.map((t) => html`<option key=${t.id} value=${t.id}>${etiquetaTrabajo(t)} (${fmtFecha(t.created_at)})</option>`)}
              </select>
            </label>
            <label htmlFor="d-b">Comparar con (opcional)
              <select id="d-b" value=${idB} onChange=${(e) => setIdB(e.target.value)}>
                <option value="">— ninguno —</option>
                ${trabajos.filter((t) => t.id !== idA).map((t) => html`<option key=${t.id} value=${t.id}>${etiquetaTrabajo(t)} (${fmtFecha(t.created_at)})</option>`)}
              </select>
            </label>
          </div>`}
      </section>
      <${VistaDashboard} selecciones=${selecciones} />
    </div>`;
}
