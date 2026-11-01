import { html } from "./react.js";
import { niceMax } from "./utils.js";

// Tabla genérica y accesible. columnas: [{clave, titulo, fmt?}]
export function Tabla({ titulo, columnas, filas, vacio = "Sin datos." }) {
  if (!filas || filas.length === 0) return html`<p class="muted">${vacio}</p>`;
  return html`
    <div class="envoltura-tabla">
      <table class="tabla">
        ${titulo && html`<caption>${titulo}</caption>`}
        <thead><tr>${columnas.map((c) => html`<th key=${c.clave} scope="col">${c.titulo}</th>`)}</tr></thead>
        <tbody>
          ${filas.map((f, i) => html`
            <tr key=${i}>${columnas.map((c) => html`<td key=${c.clave}>${c.fmt ? c.fmt(f[c.clave], f) : f[c.clave] ?? "—"}</td>`)}</tr>`)}
        </tbody>
      </table>
    </div>`;
}

// Gráfica de barras agrupadas en SVG. series: [{nombre, color, valores[]}]
export function BarChart({ titulo, etiquetas, series, formato = (v) => String(v), ancho = 600, alto = 280 }) {
  const m = { l: 44, r: 12, t: 12, b: 44 };
  const w = ancho - m.l - m.r;
  const h = alto - m.t - m.b;
  const maximo = niceMax(Math.max(1, ...series.flatMap((s) => s.valores)));
  const anchoGrupo = w / Math.max(1, etiquetas.length);
  const anchoBarra = Math.min(34, (anchoGrupo * 0.8) / Math.max(1, series.length));
  const y = (v) => m.t + h - (v / maximo) * h;
  const marcas = [0, 0.25, 0.5, 0.75, 1].map((f) => f * maximo);
  const resumen = etiquetas
    .map((e, i) => `${e}: ${series.map((s) => `${s.nombre} ${formato(s.valores[i])}`).join(", ")}`)
    .join(". ");

  return html`
    <figure class="grafica">
      <figcaption>${titulo}</figcaption>
      <svg viewBox=${`0 0 ${ancho} ${alto}`} role="img" aria-label=${`${titulo}. ${resumen}`}>
        ${marcas.map((t) => html`
          <g key=${t}>
            <line class="rejilla" x1=${m.l} x2=${ancho - m.r} y1=${y(t)} y2=${y(t)} />
            <text class="eje" x=${m.l - 6} y=${y(t) + 4} textAnchor="end">${formato(Math.round(t * 10) / 10)}</text>
          </g>`)}
        ${etiquetas.map((e, gi) => {
          const x0 = m.l + gi * anchoGrupo + (anchoGrupo - anchoBarra * series.length) / 2;
          return html`
            <g key=${e}>
              ${series.map((s, si) => html`
                <g key=${s.nombre}>
                  <rect x=${x0 + si * anchoBarra} y=${y(s.valores[gi])} width=${anchoBarra - 2}
                        height=${m.t + h - y(s.valores[gi])} fill=${s.color} rx="2" />
                  <text class="valor-barra" x=${x0 + si * anchoBarra + (anchoBarra - 2) / 2} y=${y(s.valores[gi]) - 3}
                        textAnchor="middle">${formato(s.valores[gi])}</text>
                </g>`)}
              <text class="eje" x=${m.l + gi * anchoGrupo + anchoGrupo / 2} y=${alto - m.b + 18} textAnchor="middle">${e}</text>
            </g>`;
        })}
      </svg>
      <ul class="leyenda">
        ${series.map((s) => html`<li key=${s.nombre}><span class="cuadro" style=${{ background: s.color }}></span>${s.nombre}</li>`)}
      </ul>
      <table class="solo-lectores">
        <caption>${titulo}</caption>
        <thead><tr><th scope="col">Categoría</th>${series.map((s) => html`<th key=${s.nombre} scope="col">${s.nombre}</th>`)}</tr></thead>
        <tbody>${etiquetas.map((e, i) => html`<tr key=${e}><th scope="row">${e}</th>${series.map((s) => html`<td key=${s.nombre}>${formato(s.valores[i])}</td>`)}</tr>`)}</tbody>
      </table>
    </figure>`;
}
