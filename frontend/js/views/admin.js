import { html, useState, useEffect, useCallback } from "../react.js";
import { api } from "../api.js";
import { Tabla } from "../charts.js";
import { fmtFecha } from "../utils.js";

const ROLES = ["usuario", "operador", "admin"];

export function TablaUsuarios({ usuarios, onRol, actual }) {
  const columnas = [
    { clave: "username", titulo: "Usuario" },
    { clave: "role", titulo: "Rol", fmt: (rol, u) => html`
      <select aria-label=${"Rol de " + u.username} value=${rol} disabled=${u.username === actual}
              onChange=${(e) => onRol(u.username, e.target.value)}>
        ${ROLES.map((r) => html`<option key=${r} value=${r}>${r}</option>`)}
      </select>` },
    { clave: "created_at", titulo: "Creado", fmt: (v) => fmtFecha(v) },
  ];
  return html`<${Tabla} titulo="Usuarios" columnas=${columnas} filas=${usuarios} />`;
}

export function TablaAuditoria({ registros }) {
  const columnas = [
    { clave: "ts", titulo: "Fecha", fmt: (v) => fmtFecha(v) },
    { clave: "user", titulo: "Usuario" },
    { clave: "action", titulo: "Acción" },
    { clave: "detail", titulo: "Detalle", fmt: (v) => (v && Object.keys(v).length ? JSON.stringify(v) : "—") },
  ];
  return html`<${Tabla} titulo="Registro de auditoría (últimos 100)" columnas=${columnas} filas=${registros} vacio="Sin registros." />`;
}

export function Admin({ sesion }) {
  const [usuarios, setUsuarios] = useState(null);
  const [registros, setRegistros] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");

  const cargar = useCallback(async () => {
    try {
      const [u, a] = await Promise.all([api("/auth/users"), api("/audit", { query: { limit: 100 } })]);
      setUsuarios(u); setRegistros(a); setError("");
    } catch (e) {
      setError(e.message);
    }
  }, []);
  useEffect(() => { cargar(); }, [cargar]);

  async function cambiarRol(username, role) {
    setAviso(""); setError("");
    try {
      await api(`/auth/users/${encodeURIComponent(username)}/role`, { method: "PUT", json: { role } });
      setAviso(`Rol de ${username} actualizado a ${role}.`);
      cargar();
    } catch (e) {
      setError(e.message);
    }
  }

  return html`
    <div>
      <section className="panel">
        <h2>Administración</h2>
        ${error && html`<div className="aviso error" role="alert">${error}</div>`}
        ${aviso && html`<div className="aviso ok" role="status">${aviso}</div>`}
        ${usuarios === null && !error ? html`<p className="cargando" role="status">Cargando…</p>`
          : usuarios && html`<${TablaUsuarios} usuarios=${usuarios} onRol=${cambiarRol} actual=${sesion.username} />`}
      </section>
      <section className="panel">
        ${registros && html`<${TablaAuditoria} registros=${registros} />`}
      </section>
    </div>`;
}
