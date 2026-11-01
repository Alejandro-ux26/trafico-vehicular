import { html, useState } from "../react.js";
import { api } from "../api.js";

export function Login({ onLogin }) {
  const [modo, setModo] = useState("entrar");
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError("");
    setCargando(true);
    try {
      if (modo === "registro") {
        await api("/auth/register", { method: "POST", json: { username: usuario.trim(), password: clave } });
      }
      const r = await api("/auth/login", {
        method: "POST",
        body: new URLSearchParams({ username: usuario.trim(), password: clave }),
      });
      onLogin({ token: r.access_token, username: usuario.trim(), role: r.role });
    } catch (err) {
      setError(err.message);
      setCargando(false);
    }
  }

  return html`
    <main id="contenido" className="acceso" tabIndex="-1">
      <section className="panel">
        <h1>Plataforma de tráfico vehicular</h1>
        <p className="muted">Conteo de vehículos por categoría con visión artificial.</p>
        <h2>${modo === "entrar" ? "Iniciar sesión" : "Crear cuenta"}</h2>
        <form className="formulario" onSubmit=${enviar}>
          <label htmlFor="usuario">Usuario
            <input id="usuario" value=${usuario} required minLength="3" autoComplete="username"
                   onChange=${(e) => setUsuario(e.target.value)} />
          </label>
          <label htmlFor="clave">Contraseña
            <input id="clave" type="password" value=${clave} required minLength=${modo === "registro" ? 8 : 1}
                   autoComplete=${modo === "registro" ? "new-password" : "current-password"}
                   onChange=${(e) => setClave(e.target.value)} />
            ${modo === "registro" && html`<small>Mínimo 8 caracteres.</small>`}
          </label>
          ${error && html`<div className="aviso error" role="alert">${error}</div>`}
          <button className="boton" type="submit" disabled=${cargando}>
            ${cargando ? "Un momento…" : modo === "entrar" ? "Entrar" : "Registrarme y entrar"}
          </button>
        </form>
        <p>
          <button className="boton secundario" type="button"
                  onClick=${() => { setModo(modo === "entrar" ? "registro" : "entrar"); setError(""); }}>
            ${modo === "entrar" ? "Crear una cuenta" : "Ya tengo cuenta"}
          </button>
        </p>
        ${modo === "registro" && html`
          <p className="aviso info">Las cuentas nuevas tienen rol <strong>usuario</strong> (solo consulta).
          Un administrador puede darte el rol de operador para procesar videos.</p>`}
      </section>
    </main>`;
}
