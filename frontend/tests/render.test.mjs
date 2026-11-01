import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./loader.mjs", import.meta.url);
const mem = {};
globalThis.sessionStorage = { getItem: (k) => mem[k] ?? null, setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; } };
globalThis.document = { getElementById: () => null };

const { renderToString } = await import("./fake-react.mjs");
const { BarChart, Tabla } = await import("../js/charts.js");
const { Login } = await import("../js/views/login.js");
const { VistaLinea, FormFuente, FormTrabajo, EstadoTrabajo } = await import("../js/views/process.js");
const { TablaTrabajos, DetalleTrabajo, Trabajos } = await import("../js/views/jobs.js");
const { VistaDashboard, Dashboard } = await import("../js/views/dashboard.js");
const { VistaEvaluacion, Evaluacion } = await import("../js/views/evaluacion.js");
const { TablaUsuarios, TablaAuditoria, Admin } = await import("../js/views/admin.js");
const { App, EstadoSistema } = await import("../js/main.js");

const limpio = (s) => {
  assert.ok(!s.includes("\u0001"), "quedaron marcadores sin sustituir");
  assert.ok(!/NaN|undefined|\[object Object\]/.test(s), "aparece NaN/undefined/[object Object]: " + (s.match(/.{30}(NaN|undefined|\[object Object\]).{30}/) || [""])[0]);
  return s;
};
const r = (el) => limpio(renderToString(el));

const jobYolo = {
  id: "j1", source_id: "s1", method: "yolo26", interval_seconds: 10, original_name: "VideoPrueba-ParaBigdata1.mp4",
  status: "completado", recorded_at: "2026-11-01T08:03:49.851000", created_by: "admin", created_at: "2026-11-01T08:04:26.507000",
  error: null, totals: { bus: 3, car: 13, motorcycle: 3, truck: 1 },
  ai_meta: { method: "yolo26", model: "yolo26n.pt", ultralytics_version: "8.4.177", device: "cpu", processing_fps: 13.05,
    elapsed_s: 59.06, frames_processed: 771, params: { stride: 2, imgsz: 480, conf: 0.3, line: [0.28, 0.5, 0.95, 0.5] } },
};
const jobBase = { ...jobYolo, id: "j2", method: "baseline", totals: { car: 10, motorcycle: 18, truck: 4 },
  ai_meta: { method: "baseline", model: "opencv-mog2", opencv_version: "4.9.0", device: "cpu", processing_fps: 57.94, params: {} } };
const interv = (items) => ({ interval_seconds: 10, items });

test("BarChart y Tabla se renderizan", () => {
  const s = r(BarChart({ titulo: "Prueba", etiquetas: ["A", "B"], series: [{ nombre: "S1", color: "#111", valores: [3, 7] }] }));
  assert.match(s, /<svg/); assert.match(s, /Prueba/); assert.match(s, /<rect/);
  assert.match(r(Tabla({ columnas: [{ clave: "a", titulo: "A" }], filas: [{ a: 1 }] })), /<table/);
  assert.match(r(Tabla({ columnas: [], filas: [] })), /Sin datos/);
});
test("Login", () => {
  const s = r(Login({ onLogin() {} }));
  assert.match(s, /Iniciar sesión/); assert.match(s, /type="password"/);
});
test("Procesar: línea, formularios y estados", () => {
  assert.match(r(VistaLinea({ linea: [0.2, 0.5, 0.9, 0.5] })), /<line/);
  assert.match(r(FormFuente({ onCreada() {} })), /Línea de conteo/);
  assert.match(r(FormTrabajo({ fuentes: [{ id: "s1", name: "Prueba 1", authorized: true }], onCreado() {} })), /Procesar video/);
  assert.match(r(FormTrabajo({ fuentes: [], onCreado() {} })), /Primero crea una fuente/);
  assert.match(r(EstadoTrabajo({ job: null })), /Consultando/);
  assert.match(r(EstadoTrabajo({ job: { status: "procesando" } })), /procesando/);
  assert.match(r(EstadoTrabajo({ job: { status: "error", error: "boom" } })), /boom/);
  assert.match(r(EstadoTrabajo({ job: jobYolo })), /20 vehículos/);
});
test("Trabajos", () => {
  const s = r(TablaTrabajos({ trabajos: [jobYolo, jobBase], onVer() {} }));
  assert.match(s, /ParaBigdata1/); assert.match(s, /13\.05/);
  const d = r(DetalleTrabajo({ job: jobYolo }));
  assert.match(d, /yolo26n\.pt/); assert.match(d, /Carros: 13/);
  assert.match(r(Trabajos()), /Cargando/);
});
test("Dashboard con 1 y 2 trabajos", () => {
  const a = { job: jobYolo, intervalos: interv([{ interval_start_s: 0, category: "car", count: 8 }, { interval_start_s: 10, category: "car", count: 5 }]) };
  const b = { job: jobBase, intervalos: interv([{ interval_start_s: 0, category: "car", count: 9 }, { interval_start_s: 20, category: "truck", count: 4 }]) };
  assert.match(r(VistaDashboard({ selecciones: [a] })), /Flujo por intervalo/);
  const s = r(VistaDashboard({ selecciones: [a, b] }));
  assert.match(s, /20–30 s/); assert.match(s, /Baseline/);
  assert.match(r(VistaDashboard({ selecciones: [] })), /Elige un trabajo/);
  assert.match(r(Dashboard()), /Cargando/);
});
const evaluacion = {
  created_at: "2026-11-01T09:00:00", videos: ["VideoPrueba-ParaBigdata1.mp4", "VideoPrueba-ParaBigdata2.mp4"],
  criterio_verdad_terreno: "Conteo manual", consistencia_counts_vs_jobs: true,
  global_por_metodo: [{ method: "baseline", FPS_promedio: 61.9, "error_abs_categoria_%": 59.3 }, { method: "yolo26", FPS_promedio: 14.3, "error_abs_categoria_%": 35.2 }],
  por_video_metodo: [{ video: "VideoPrueba-ParaBigdata1.mp4", method: "yolo26", real_total: 30, predicho_total: 20, "error_conteo_total_%": -33.3, "error_abs_categoria_%": 33.3, MAE_por_categoria: 2.5, FPS: 13.05 }],
  por_categoria: [
    { video: "VideoPrueba-ParaBigdata1.mp4", method: "yolo26", category: "car", real: 16, predicho: 13 },
    { video: "VideoPrueba-ParaBigdata1.mp4", method: "baseline", category: "car", real: 16, predicho: 10 },
    { video: "VideoPrueba-ParaBigdata2.mp4", method: "yolo26", category: "truck", real: 1, predicho: 2 },
  ],
  versiones_modelo: [{ method: "yolo26", model: "yolo26n.pt", library: "ultralytics", library_version: "8.4.177", device: "cpu" }],
  disponibilidad: { solicitudes: 20, correctas: 20, "disponibilidad_%": 100, latencia_media_ms: 34.2, latencia_p95_ms: 43.8 },
  metricas_pendientes: ["mAP (requiere fotogramas anotados con cajas)"],
};
test("Evaluación", () => {
  const s = r(VistaEvaluacion({ ev: evaluacion }));
  assert.match(s, /59\.3%/); assert.match(s, /34\.2/); assert.match(s, /Métricas pendientes/);
  assert.match(r(Evaluacion()), /Cargando/);
});
test("Administración", () => {
  const u = r(TablaUsuarios({ usuarios: [{ username: "admin", role: "admin", created_at: "2026-10-15T00:00:00" }, { username: "ana", role: "usuario" }], onRol() {}, actual: "admin" }));
  assert.match(u, /<select/); assert.match(u, /ana/);
  assert.match(r(TablaAuditoria({ registros: [{ ts: "2026-11-01T08:00:00", user: "admin", action: "login", detail: {} }] })), /login/);
  assert.match(r(Admin({ sesion: { username: "admin", role: "admin" } })), /Cargando/);
});
test("App: sin sesión muestra el acceso; con sesión, pestañas según el rol", () => {
  assert.match(r(App()), /Iniciar sesión/);
  mem.tv_token = "t"; mem.tv_usuario = JSON.stringify({ username: "ana", role: "usuario" });
  let s = r(App());
  assert.match(s, /Dashboard/); assert.doesNotMatch(s, /Procesar video/); assert.doesNotMatch(s, /Administración/);
  mem.tv_usuario = JSON.stringify({ username: "admin", role: "admin" });
  s = r(App());
  assert.match(s, /Procesar video/); assert.match(s, /Administración/);
  assert.equal(renderToString(EstadoSistema()), "");
});
