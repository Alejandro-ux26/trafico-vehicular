// Sustituye js/react.js por una versión falsa para poder renderizar las vistas en Node, sin navegador ni CDN.
export async function resolve(specifier, context, next) {
  if (/(^|\/)react\.js$/.test(specifier)) {
    return { url: new URL("./fake-react.mjs", import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
