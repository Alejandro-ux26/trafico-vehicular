import test from "node:test";
import assert from "node:assert/strict";
import { totalDe, lineaValida, mensajeError, porIntervalo, seriesPorVideo, niceMax, nombreCorto, fmtFecha, etiquetaIntervalo } from "../js/utils.js";

test("totalDe suma las categorías", () => assert.equal(totalDe({ car: 13, truck: 2, motorcycle: 2 }), 17));
test("totalDe tolera null", () => assert.equal(totalDe(null), 0));
test("lineaValida", () => {
  assert.ok(lineaValida([0.28, 0.5, 0.95, 0.5]));
  assert.ok(!lineaValida([0.5, 0.5, 0.5, 0.5]));
  assert.ok(!lineaValida([0, 0, 2, 1]));
  assert.ok(!lineaValida([0, 0, NaN, 1]));
  assert.ok(!lineaValida([0, 0, 1]));
});
test("mensajeError con detail string y lista", () => {
  assert.equal(mensajeError(401, { detail: "Credenciales incorrectas" }), "Credenciales incorrectas");
  assert.equal(mensajeError(422, { detail: [{ loc: ["body", "name"], msg: "Field required" }] }), "name: Field required");
  assert.equal(mensajeError(500, null), "Error 500");
});
test("porIntervalo agrupa por intervalo y categoría", () => {
  const r = porIntervalo([
    { interval_start_s: 10, category: "car", count: 2 },
    { interval_start_s: 0, category: "car", count: 3 },
    { interval_start_s: 0, category: "truck", count: 1 },
  ]);
  assert.deepEqual(r.inicios, [0, 10]);
  assert.deepEqual(r.totales, [4, 2]);
  assert.deepEqual(r.porCategoria.car, [3, 2]);
  assert.deepEqual(r.porCategoria.bus, [0, 0]);
});
test("seriesPorVideo arma real + métodos", () => {
  const filas = [
    { video: "v.mp4", method: "baseline", category: "car", real: 16, predicho: 10 },
    { video: "v.mp4", method: "yolo26", category: "car", real: 16, predicho: 13 },
    { video: "v.mp4", method: "yolo26", category: "bus", real: 3, predicho: 3 },
    { video: "otro.mp4", method: "yolo26", category: "car", real: 1, predicho: 1 },
  ];
  const s = seriesPorVideo(filas, "v.mp4");
  assert.equal(s.length, 3);
  assert.deepEqual(s[0].valores, [16, 0, 3, 0]);
  assert.deepEqual(s[2].valores, [13, 0, 3, 0]);
});
test("niceMax", () => { assert.equal(niceMax(3), 5); assert.equal(niceMax(18), 20); assert.equal(niceMax(61.9), 100); assert.equal(niceMax(7), 10); });
test("nombreCorto y etiquetaIntervalo", () => {
  assert.equal(nombreCorto("VideoPrueba-ParaBigdata1.mp4"), "ParaBigdata1");
  assert.equal(etiquetaIntervalo(10, 10), "10–20 s");
});
test("fmtFecha trata fechas sin zona como UTC", () => {
  assert.notEqual(fmtFecha("2026-11-01T08:04:26.507000"), "Invalid Date");
  assert.equal(fmtFecha(null), "—");
});
