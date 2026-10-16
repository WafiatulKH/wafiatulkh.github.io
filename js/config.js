/* =========================================================
   APP CONFIG
   Centralized configuration for the portfolio SPA.
   ========================================================= */

const API_BASE = document
    .querySelector('meta[name="api-base"]')
    ?.getAttribute("content") || "";

/* Base path for routing. Kept blank for both local and GitHub Pages
   (project is served from the repo root). */
const BASE_PATH = "";

/* Default route loaded on first paint. */
const DEFAULT_ROUTE = "/pages/home.html";

/* Expose on window so script.js (and inline handlers) can read them. */
window.APP_CONFIG = {
    API_BASE,
    BASE_PATH,
    DEFAULT_ROUTE,
};
