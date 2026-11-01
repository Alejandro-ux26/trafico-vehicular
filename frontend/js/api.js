// Cliente HTTP del backend. Usa rutas relativas: el frontend se sirve desde el mismo backend (/app).
import { mensajeError } from "./utils.js";

const CLAVE_TOKEN = "tv_token";
const CLAVE_USUARIO = "tv_usuario";

const almacen = () => (typeof sessionStorage !== "undefined" ? sessionStorage : null);

export class ApiError extends Error {
  constructor(status, mensaje) {
    super(mensaje);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getSession() {
  try {
    const a = almacen();
    if (!a) return null;
    const token = a.getItem(CLAVE_TOKEN);
    const usuario = JSON.parse(a.getItem(CLAVE_USUARIO) || "null");
    return token && usuario ? { token, ...usuario } : null;
  } catch {
    return null;
  }
}

export function saveSession(token, usuario) {
  const a = almacen();
  if (!a) return;
  a.setItem(CLAVE_TOKEN, token);
  a.setItem(CLAVE_USUARIO, JSON.stringify(usuario));
}

export function clearSession() {
  const a = almacen();
  if (!a) return;
  a.removeItem(CLAVE_TOKEN);
  a.removeItem(CLAVE_USUARIO);
}

let alExpirar = () => {};
export function setUnauthorizedHandler(fn) {
  alExpirar = fn;
}

export async function api(ruta, { method = "GET", json, form, body, query } = {}) {
  const headers = {};
  const sesion = getSession();
  if (sesion) headers.Authorization = `Bearer ${sesion.token}`;

  let cuerpo;
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
    cuerpo = JSON.stringify(json);
  } else if (form !== undefined) {
    cuerpo = form; // FormData: el navegador pone el Content-Type con su boundary
  } else if (body !== undefined) {
    cuerpo = body; // URLSearchParams (login)
  }

  let url = ruta;
  if (query) {
    const limpio = Object.fromEntries(Object.entries(query).filter(([, v]) => v !== undefined && v !== null && v !== ""));
    const qs = new URLSearchParams(limpio).toString();
    if (qs) url += (ruta.includes("?") ? "&" : "?") + qs;
  }

  let resp;
  try {
    resp = await fetch(url, { method, headers, body: cuerpo });
  } catch {
    throw new ApiError(0, "No se pudo conectar con el servidor. ¿Está encendido el backend?");
  }

  const texto = await resp.text();
  let datos = null;
  if (texto) {
    try { datos = JSON.parse(texto); } catch { datos = texto; }
  }
  if (resp.status === 401 && sesion) {
    clearSession();
    alExpirar();
  }
  if (!resp.ok) throw new ApiError(resp.status, mensajeError(resp.status, datos));
  return datos;
}
