// React 18 + htm cargados desde un CDN (sin paso de compilación). Versiones fijas.
import React from "https://esm.sh/react@18.3.1";
import { createRoot } from "https://esm.sh/react-dom@18.3.1/client?deps=react@18.3.1";
import htm from "https://esm.sh/htm@3.1.1";

export const { useState, useEffect, useRef, useMemo, useCallback } = React;
export const html = htm.bind(React.createElement);
export { React, createRoot };
