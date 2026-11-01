import { html, useState, useEffect, createRoot } from "./react.js";
import { api, getSession, saveSession, clearSession, setUnauthorizedHandler } from "./api.js";
import { Login } from "./views/login.js";
import { Procesar } from "./views/process.js";
import { Trabajos } from "./views/jobs.js";
import { Dashboard } from "./views/dashboard.js";
import { Evaluacion } from "./views/evaluacion.js";
import { Admin } from "./views/admin.js";

const PESTANAS = [
  { id: "procesar", titulo: "Procesar video", roles: ["operador", "admin"], Vista: Procesar },
  { id: "trabajos", titulo: "Trabajos", roles: ["usuario", "operador", "admin"], Vista: Trabajos },
  { id: "dashboard", titulo: "Dashboard", roles: ["usuario", "operador", "admin"], Vista: Dashboard },
  { id: "evaluacion", titulo: "Evaluación del modelo", roles: ["usuario", "operador", "admin"], Vista: Evaluacion },
  { id: "admin", titulo: "Administración", roles: ["admin"], Vista: Admin },
];

export function EstadoSistema() {
  const [estado, setEstado] = useState(null);
  useEffect(() => {
    let activo = true;
    const consultar = async () => {
      try { const e = await api("/health"); if (activo) setEstado(e); }
      catch { if (activo) setEstado({ api: "error", mongo: "error", ai_service: "error" }); }
    };
    consultar();
    const t = setInterval(consultar, 30000);
    return () => { activo = false; clearInterval(t); };
  }, []);
  if (!estado) return null;
  const nombres = { api: "API", mongo: "MongoDB", ai_service: "Servicio IA" };
  return html`
    <div className="estado" role="status" aria-label="Estado del sistema">
      ${Object.entries(nombres).map(([k, n]) => html`
        <span key=${k} className=${"chip " + (estado[k] === "ok" ? "ok" : "mal")}>${n}: ${estado[k] === "ok" ? "ok" : "sin conexión"}</span>`)}
    </div>`;
}

export function App() {
  const [sesion, setSesion] = useState(getSession());
  const [pestana, setPestana] = useState(sesion && sesion.role !== "usuario" ? "procesar" : "dashboard");

  useEffect(() => { setUnauthorizedHandler(() => setSesion(null)); }, []);

  if (!sesion) {
    return html`<${Login} onLogin=${(s) => {
      saveSession(s.token, { username: s.username, role: s.role });
      setSesion(getSession());
      setPestana(s.role === "usuario" ? "dashboard" : "procesar");
    }} />`;
  }
  const visibles = PESTANAS.filter((p) => p.roles.includes(sesion.role));
  const actual = visibles.find((p) => p.id === pestana) || visibles[0];
  const Vista = actual.Vista;

  return html`
    <div>
      <header className="cabecera">
        <span className="titulo">Tráfico vehicular · visión artificial</span>
        <${EstadoSistema} />
        <div className="usuario">
          <span>${sesion.username} (${sesion.role})</span>
          <button className="boton secundario" onClick=${() => { clearSession(); setSesion(null); }}>Salir</button>
        </div>
      </header>
      <nav className="pestanas" aria-label="Secciones">
        ${visibles.map((p) => html`
          <button key=${p.id} type="button" aria-current=${p.id === actual.id ? "page" : undefined}
                  onClick=${() => setPestana(p.id)}>${p.titulo}</button>`)}
      </nav>
      <main id="contenido" tabIndex="-1">
        <${Vista} key=${actual.id} sesion=${sesion} />
      </main>
    </div>`;
}

const raiz = document.getElementById("root");
if (raiz) createRoot(raiz).render(html`<${App} />`);
