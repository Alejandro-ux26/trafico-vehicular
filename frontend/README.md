# Frontend web (React sin compilación)

Aplicación React 18 escrita con módulos ES y `htm` (plantillas en lugar de JSX), cargada desde un CDN con
versiones fijas. No necesita Node ni `npm`: el propio backend la sirve en **http://127.0.0.1:8000/app/**.

Pantallas: acceso y registro · procesar video (fuente + línea de conteo + subida + seguimiento) · trabajos ·
dashboard (conteo por categoría y flujo por intervalo, con comparación entre dos trabajos) · evaluación del
modelo (lee lo que guardó el notebook en MongoDB) · administración (roles y auditoría, solo admin).

Accesibilidad: etiquetas en todos los campos, mensajes con `role="alert"/"status"`, gráficas SVG con texto
alternativo y tabla equivalente para lectores de pantalla, enlace "Saltar al contenido", foco visible,
diseño adaptable a móvil y modo claro/oscuro.

Pruebas (opcional, requiere Node): `cd frontend && node --test tests/*.test.mjs` (lógica, cliente HTTP y renderizado simulado).

Nota para el informe: se eligió React sin paso de compilación para que el despliegue sea un solo comando y la
interfaz viva junto a la API; es equivalente funcional a una app Vite. Si se necesita funcionar sin internet,
se pueden descargar `react`, `react-dom` y `htm` a una carpeta `vendor/` y cambiar las tres URLs de `js/react.js`.
