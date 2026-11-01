// Mini implementación de htm + React solo para pruebas de renderizado en Node (no se usa en el navegador).
const MARK = "\u0001";
const VOID = new Set(["input", "br", "img", "hr", "meta", "link", "line", "rect", "path"]);

export const useState = (inicial) => [typeof inicial === "function" ? inicial() : inicial, () => {}];
export const useEffect = () => {};
export const useRef = (v) => ({ current: v });
export const useMemo = (fn) => fn();
export const useCallback = (fn) => fn;
export const createRoot = () => ({ render() {} });
export const React = { createElement };

export function createElement(type, props, ...children) {
  return { $$el: true, type, props: { ...(props || {}), children: children.length === 1 ? children[0] : children } };
}

function sustituir(texto, valores) {
  const partes = [];
  const re = /\u0001(\d+)\u0001/g;
  let ultimo = 0, m;
  while ((m = re.exec(texto))) {
    if (m.index > ultimo) partes.push(texto.slice(ultimo, m.index));
    partes.push({ v: valores[+m[1]] });
    ultimo = re.lastIndex;
  }
  if (ultimo < texto.length) partes.push(texto.slice(ultimo));
  return partes;
}

export function html(strings, ...valores) {
  let src = strings[0];
  for (let i = 0; i < valores.length; i++) src += MARK + i + MARK + strings[i + 1];
  const raiz = { hijos: [] };
  const pila = [{ crudo: null, nodo: raiz }];
  const cima = () => pila[pila.length - 1].nodo;
  const valor = (s) => {
    const completo = s.match(/^\u0001(\d+)\u0001$/);
    if (completo) return valores[+completo[1]];
    return sustituir(s, valores).map((p) => (typeof p === "string" ? p : String(p.v))).join("");
  };
  const cerrar = (nombre) => {
    if (pila.length <= 1) throw new Error("Cierre sin apertura: " + nombre);
    const { crudo, nodo } = pila.pop();
    if (nombre && nombre !== crudo) throw new Error(`Etiqueta <${crudo}> cerrada con </${nombre}>`);
    const props = nodo.props;
    const hijos = nodo.hijos;
    const el = createElement(nodo.tipo, props, ...hijos);
    cima().hijos.push(el);
  };
  let i = 0;
  while (i < src.length) {
    if (src[i] === "<") {
      if (src.startsWith("<//>", i)) { cerrar(null); i += 4; continue; }
      if (src[i + 1] === "/") {
        const fin = src.indexOf(">", i);
        cerrar(src.slice(i + 2, fin).trim());
        i = fin + 1;
        continue;
      }
      let j = i + 1;
      while (j < src.length && !/[\s>\/]/.test(src[j])) j++;
      const crudo = src.slice(i + 1, j);
      const tipo = valor(crudo);
      const props = {};
      let autocierre = false;
      for (;;) {
        while (/\s/.test(src[j])) j++;
        if (src.startsWith("/>", j)) { autocierre = true; j += 2; break; }
        if (src[j] === ">") { j++; break; }
        if (j >= src.length) throw new Error("Plantilla sin cerrar en <" + crudo);
        let k = j;
        while (k < src.length && !/[\s=>\/]/.test(src[k])) k++;
        const nombre = src.slice(j, k);
        if (!nombre) throw new Error("Atributo mal formado cerca de: " + src.slice(j, j + 40));
        j = k;
        if (src[j] === "=") {
          j++;
          if (src[j] === '"' || src[j] === "'") {
            const q = src[j];
            const e = src.indexOf(q, j + 1);
            if (e < 0) throw new Error("Comillas sin cerrar en " + nombre);
            props[nombre] = valor(src.slice(j + 1, e));
            j = e + 1;
          } else {
            let e = j;
            while (e < src.length && !/[\s>]/.test(src[e]) && !src.startsWith("/>", e)) e++;
            props[nombre] = valor(src.slice(j, e));
            j = e;
          }
        } else {
          props[nombre] = true;
        }
      }
      const nodo = { tipo, props, hijos: [] };
      if (autocierre) {
        cima().hijos.push(createElement(tipo, props));
      } else {
        pila.push({ crudo, nodo });
      }
      i = j;
    } else {
      let e = src.indexOf("<", i);
      if (e < 0) e = src.length;
      let texto = src.slice(i, e);
      i = e;
      for (const p of sustituir(texto, valores)) {
        if (typeof p === "string") {
          const t = p.replace(/^\s*\n\s*|\s*\n\s*$/g, ""); // mismo criterio que htm
          if (t !== "") cima().hijos.push(t);
        } else {
          cima().hijos.push(p.v);
        }
      }
    }
  }
  if (pila.length !== 1) throw new Error("Etiqueta sin cerrar: <" + pila[pila.length - 1].crudo + ">");
  const hijos = raiz.hijos;
  return hijos.length === 1 ? hijos[0] : hijos;
}

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function renderToString(n) {
  if (n === null || n === undefined || n === false || n === true) return "";
  if (Array.isArray(n)) return n.map(renderToString).join("");
  if (typeof n === "string" || typeof n === "number") return esc(String(n));
  if (n && n.$$el) {
    if (typeof n.type === "function") return renderToString(n.type({ ...n.props }));
    const { children, key, className, style, ...resto } = n.props;
    let attrs = className ? ` class="${className}"` : "";
    if (style && typeof style === "object") attrs += ` style="${Object.entries(style).map(([k, v]) => `${k}:${v}`).join(";")}"`;
    for (const [k, v] of Object.entries(resto)) {
      if (v === false || v === undefined || v === null || typeof v === "function") continue;
      attrs += v === true ? ` ${k}` : ` ${k}="${String(v).replace(/"/g, "&quot;")}"`;
    }
    return `<${n.type}${attrs}>${renderToString(children)}</${n.type}>`;
  }
  throw new Error("Hijo no válido para React (objeto): " + JSON.stringify(n).slice(0, 80));
}
export default React;
