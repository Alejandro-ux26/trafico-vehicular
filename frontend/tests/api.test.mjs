import test from "node:test";
import assert from "node:assert/strict";

const mem = {};
globalThis.sessionStorage = {
  getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); }, removeItem: (k) => { delete mem[k]; },
};
const { api, getSession, saveSession, clearSession, setUnauthorizedHandler, ApiError } = await import("../js/api.js");

function falsoFetch(respuesta, registro) {
  globalThis.fetch = async (url, opts) => {
    registro.push({ url, opts });
    return { ok: respuesta.status < 400, status: respuesta.status, text: async () => (respuesta.body === undefined ? "" : JSON.stringify(respuesta.body)) };
  };
}

test("sesión: guardar, leer y borrar", () => {
  assert.equal(getSession(), null);
  saveSession("tok", { username: "ana", role: "admin" });
  assert.deepEqual(getSession(), { token: "tok", username: "ana", role: "admin" });
  clearSession();
  assert.equal(getSession(), null);
});
test("api envía el token y el JSON", async () => {
  saveSession("tok", { username: "ana", role: "admin" });
  const reg = [];
  falsoFetch({ status: 201, body: { id: "1" } }, reg);
  const r = await api("/sources", { method: "POST", json: { name: "x" } });
  assert.deepEqual(r, { id: "1" });
  assert.equal(reg[0].opts.headers.Authorization, "Bearer tok");
  assert.equal(reg[0].opts.headers["Content-Type"], "application/json");
  assert.equal(reg[0].opts.body, JSON.stringify({ name: "x" }));
});
test("api arma la query ignorando vacíos", async () => {
  const reg = [];
  falsoFetch({ status: 200, body: [] }, reg);
  await api("/audit", { query: { limit: 100, x: "", y: undefined } });
  assert.equal(reg[0].url, "/audit?limit=100");
});
test("api lanza ApiError con el mensaje del backend", async () => {
  const reg = [];
  falsoFetch({ status: 404, body: { detail: "Trabajo no encontrado" } }, reg);
  await assert.rejects(() => api("/jobs/x"), (e) => e instanceof ApiError && e.status === 404 && e.message === "Trabajo no encontrado");
});
test("401 con sesión limpia la sesión y avisa", async () => {
  saveSession("viejo", { username: "ana", role: "admin" });
  let avisado = false;
  setUnauthorizedHandler(() => { avisado = true; });
  falsoFetch({ status: 401, body: { detail: "Token inválido o expirado" } }, []);
  await assert.rejects(() => api("/jobs"));
  assert.ok(avisado);
  assert.equal(getSession(), null);
});
test("error de red da un mensaje claro", async () => {
  globalThis.fetch = async () => { throw new TypeError("fetch failed"); };
  await assert.rejects(() => api("/health"), (e) => e.status === 0 && /backend/.test(e.message));
});
