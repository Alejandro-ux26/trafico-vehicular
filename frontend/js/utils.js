// Funciones puras (sin React ni red) para poder probarlas con Node.
export const CATEGORIAS = ["car", "motorcycle", "bus", "truck"];
export const CAT_ES = { car: "Carros", motorcycle: "Motos", bus: "Buses", truck: "Camiones" };
export const METODO_ES = { baseline: "Baseline (OpenCV)", yolo26: "YOLO26n + ByteTrack" };
export const COLOR_METODO = { baseline: "#d08770", yolo26: "#5e81ac", real: "#4c566a" };
export const PALETA = ["#5e81ac", "#d08770", "#a3be8c", "#b48ead"];

export function totalDe(totales) {
  return Object.values(totales || {}).reduce((a, n) => a + Number(n || 0), 0);
}

export function fmtFecha(valor) {
  if (!valor) return "—";
  const texto = String(valor);
  const conZona = /(Z|[+-]\d\d:\d\d)$/.test(texto) ? texto : texto + "Z"; // el backend guarda UTC
  const d = new Date(conZona);
  return Number.isNaN(d.getTime()) ? texto : d.toLocaleString("es-CO");
}

export function nombreCorto(video) {
  return String(video || "").replace(/^VideoPrueba-/, "").replace(/\.[^.]+$/, "");
}

export function etiquetaTrabajo(job) {
  return `${METODO_ES[job.method] || job.method} · ${nombreCorto(job.original_name)}`;
}

export function lineaValida(l) {
  return Array.isArray(l) && l.length === 4 && l.every((n) => Number.isFinite(n) && n >= 0 && n <= 1) &&
    !(l[0] === l[2] && l[1] === l[3]);
}

export function mensajeError(status, data) {
  if (data && typeof data === "object" && data.detail !== undefined) {
    const d = data.detail;
    if (typeof d === "string") return d;
    if (Array.isArray(d)) {
      return d.map((e) => `${(e.loc || []).slice(1).join(".") || "campo"}: ${e.msg}`).join("; ");
    }
  }
  if (typeof data === "string" && data) return data;
  return `Error ${status}`;
}

// items: [{interval_start_s, category, count}] -> totales por intervalo y por categoría
export function porIntervalo(items, categorias = CATEGORIAS) {
  const inicios = [...new Set(items.map((i) => i.interval_start_s))].sort((a, b) => a - b);
  const suma = (s, c) => items
    .filter((i) => i.interval_start_s === s && (c === undefined || i.category === c))
    .reduce((a, i) => a + i.count, 0);
  return {
    inicios,
    totales: inicios.map((s) => suma(s)),
    porCategoria: Object.fromEntries(categorias.map((c) => [c, inicios.map((s) => suma(s, c))])),
  };
}

export function etiquetaIntervalo(inicio, duracion) {
  return `${inicio}–${inicio + duracion} s`;
}

// Series de una evaluación para un video: real + cada método, por categoría
export function seriesPorVideo(porCategoria, video, categorias = CATEGORIAS) {
  const filas = (porCategoria || []).filter((f) => f.video === video);
  const metodos = [...new Set(filas.map((f) => f.method))];
  const valor = (m, c, campo) => {
    const f = filas.find((x) => x.method === m && x.category === c);
    return f ? Number(f[campo]) : 0;
  };
  const reales = categorias.map((c) => {
    const f = filas.find((x) => x.category === c);
    return f ? Number(f.real) : 0;
  });
  return [
    { nombre: "Real (conteo manual)", color: COLOR_METODO.real, valores: reales },
    ...metodos.map((m) => ({
      nombre: METODO_ES[m] || m, color: COLOR_METODO[m] || "#888",
      valores: categorias.map((c) => valor(m, c, "predicho")),
    })),
  ];
}

export function niceMax(v) {
  if (v <= 5) return 5;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const paso = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10;
  return paso * exp;
}
