/* =========================================================
   PORTFOLIO SPA LOGIC
   HTMX routing, nav state, loading/error handling, theming.
   ========================================================= */

(function () {
    "use strict";

    const CONFIG = window.APP_CONFIG || {
        API_BASE: "",
        BASE_PATH: "",
        DEFAULT_ROUTE: "/pages/home.html",
    };

    /* =====================================================
       THEME (dark / light)
       ===================================================== */
    const THEME_KEY = "wafi-theme";

    function getStoredTheme() {
        try {
            return localStorage.getItem(THEME_KEY);
        } catch (_) {
            return null;
        }
    }

    function systemPrefersDark() {
        return window.matchMedia &&
            window.matchMedia("(prefers-color-scheme: dark)").matches;
    }

    function resolveTheme() {
        return getStoredTheme() || (systemPrefersDark() ? "dark" : "light");
    }

    function applyTheme(theme) {
        document.documentElement.setAttribute("data-theme", theme);
        const toggle = document.querySelector(".theme-toggle");
        if (toggle) {
            toggle.setAttribute(
                "aria-label",
                theme === "dark" ? "Switch to light mode" : "Switch to dark mode"
            );
            toggle.setAttribute("aria-pressed", String(theme === "dark"));
        }
    }

    function toggleTheme() {
        const current =
            document.documentElement.getAttribute("data-theme") || "light";
        const next = current === "dark" ? "light" : "dark";
        try {
            localStorage.setItem(THEME_KEY, next);
        } catch (_) {
            /* ignore storage errors (private mode) */
        }
        applyTheme(next);
    }

    /* Ensure the attribute matches the resolved theme as early as possible.
       (The <head> bootstrap script sets it first to avoid a flash.) */
    applyTheme(resolveTheme());

    /* Delegate clicks on the theme toggle (navbar is injected by HTMX). */
    document.addEventListener("click", function (e) {
        if (e.target.closest(".theme-toggle")) {
            toggleTheme();
        }
    });

    /* Re-apply correct toggle states once a fragment (e.g. navbar) swaps in. */
    document.body.addEventListener("htmx:afterSwap", function () {
        applyTheme(document.documentElement.getAttribute("data-theme") || "light");
        syncLangToggle(getLang());
    });

    /* Follow system changes only when the user hasn't chosen explicitly. */
    if (window.matchMedia) {
        window
            .matchMedia("(prefers-color-scheme: dark)")
            .addEventListener("change", function (e) {
                if (!getStoredTheme()) {
                    applyTheme(e.matches ? "dark" : "light");
                }
            });
    }

    /* =====================================================
       LANGUAGE (en / id)
       ===================================================== */
    const LANG_KEY = "wafi-lang";
    const SUPPORTED_LANGS = ["en", "id"];

    /* Remember the last language-neutral content route so we can
       re-fetch the same page when the language changes. */
    let currentContentRoute = CONFIG.DEFAULT_ROUTE;

    function getLang() {
        let lang;
        try {
            lang = localStorage.getItem(LANG_KEY);
        } catch (_) {
            lang = null;
        }
        if (!lang) {
            const nav = (navigator.language || "en").toLowerCase();
            lang = nav.startsWith("id") ? "id" : "en";
        }
        return SUPPORTED_LANGS.includes(lang) ? lang : "en";
    }

    function setLang(lang) {
        try {
            localStorage.setItem(LANG_KEY, lang);
        } catch (_) {
            /* ignore storage errors */
        }
        document.documentElement.setAttribute("lang", lang);
        syncLangToggle(lang);
    }

    function syncLangToggle(lang) {
        /* Single-button toggle: show the ACTIVE language label. */
        document.querySelectorAll("[data-lang-label]").forEach((el) => {
            el.textContent = lang.toUpperCase();
        });
        const toggle = document.querySelector(".lang-toggle");
        if (toggle) {
            const other = lang === "en" ? "Indonesian" : "English";
            toggle.setAttribute("aria-label", "Switch to " + other);
            toggle.setAttribute("title", "Switch to " + other);
        }
    }

    /* Insert the active-language suffix into a neutral fragment path.
       /pages/home.html            -> /pages/home-en.html
       /pages/contents/cv/x.html   -> /pages/contents/cv/x-id.html
       Already-suffixed or non-fragment paths are returned unchanged. */
    function localizePath(path) {
        if (!path) return path;
        const isFragment =
            path.startsWith("/pages/") || path.startsWith("/components/");
        if (!isFragment) return path;
        if (!path.endsWith(".html")) return path;
        if (/-(en|id)\.html$/.test(path)) return path; // already localized
        return path.replace(/\.html$/, "-" + getLang() + ".html");
    }

    /* Re-fetch navbar + current page content in the newly chosen language. */
    function reloadForLanguage() {
        if (!window.htmx) return;
        const navTarget = document.querySelector("nav");
        if (navTarget) {
            htmx.ajax("GET", "/components/navbar.html", { target: "nav", swap: "innerHTML" });
        }
        htmx.ajax("GET", currentContentRoute, { target: "#content", swap: "innerHTML" });
    }

    /* Apply stored language on load. */
    setLang(getLang());

    document.addEventListener("click", function (e) {
        if (e.target.closest(".lang-toggle")) {
            const next = getLang() === "en" ? "id" : "en";
            setLang(next);
            reloadForLanguage();
        }
    });

    /* =====================================================
       HTMX ROUTING
       ===================================================== */
    document.body.addEventListener("htmx:configRequest", function (event) {
        let path = event.detail.path;
        if (!path) return;

        if (path.startsWith("/api")) {
            event.detail.path = CONFIG.API_BASE + path;
            return;
        }

        /* Track the neutral content route (anything targeting #content
           that isn't a CV sub-fragment) so language switches can replay it. */
        const targetSel = event.detail.target && event.detail.target.id;
        if (targetSel === "content" && !/-(en|id)\.html$/.test(path)) {
            currentContentRoute = path;
        }

        if (!path.startsWith("http")) {
            event.detail.path = CONFIG.BASE_PATH + localizePath(path);
        }
    });

    /* =====================================================
       NAV ACTIVE STATE
       ===================================================== */
    function setActive(button) {
        document
            .querySelectorAll(".nav-btn")
            .forEach((btn) => btn.classList.remove("is-active"));
        button.classList.add("is-active");
    }

    document.body.addEventListener("click", function (e) {
        const btn = e.target.closest(".nav-btn");
        if (btn) setActive(btn);
    });

    /* =====================================================
       LOADING STATE
       ===================================================== */
    const loadingEl = document.getElementById("loading");

    document.body.addEventListener("htmx:beforeRequest", () => {
        loadingEl?.classList.remove("hidden");
    });

    document.body.addEventListener("htmx:afterRequest", () => {
        loadingEl?.classList.add("hidden");
    });

    /* =====================================================
       ERROR HANDLING
       ===================================================== */
    document.body.addEventListener("htmx:responseError", (event) => {
        loadingEl?.classList.add("hidden");
        const status = event.detail.xhr.status;
        console.error("HTMX Error:", {
            status,
            response: event.detail.xhr.responseText,
        });
        handleError(status);
    });

    document.body.addEventListener("htmx:sendError", () => {
        loadingEl?.classList.add("hidden");
        safeLoadError("/pages/errors/network.html");
    });

    function handleError(status) {
        if (status === 404) {
            safeLoadError("/pages/errors/404.html");
        } else if (status >= 500) {
            safeLoadError("/pages/errors/500.html");
        } else {
            safeLoadError("/pages/errors/general.html");
        }
    }

    /* ANTI-LOOP ERROR LOADER */
    let isHandlingError = false;
    function safeLoadError(path) {
        if (isHandlingError) return;
        isHandlingError = true;
        if (window.htmx) {
            htmx.ajax("GET", path, "#content");
        }
    }

    /* =====================================================
       PROJECT TOGGLE (used by expandable project lists)
       Exposed globally for inline onclick handlers.
       ===================================================== */
    window.toggleProject = function (button, targetId) {
        const target = document.getElementById(targetId);
        if (!target) return;

        const isOpen = !target.classList.contains("hidden");

        document
            .querySelectorAll(".project-content")
            .forEach((el) => el.classList.add("hidden"));

        document
            .querySelectorAll(".arrow")
            .forEach((el) => (el.textContent = "\u25BC"));

        if (!isOpen) {
            target.classList.remove("hidden");
            const arrow = button.querySelector(".arrow");
            if (arrow) arrow.textContent = "\u25B2";
            setTimeout(() => {
                target.scrollIntoView({ behavior: "smooth", block: "start" });
            }, 50);
        }
    };

    /* =====================================================
       IMAGE MODAL (project images)
       ===================================================== */
    window.openModal = function (src) {
        let modal = document.getElementById("image-modal");
        if (!modal) {
            modal = document.createElement("div");
            modal.id = "image-modal";
            modal.className = "image-modal";
            modal.innerHTML =
                '<span class="image-modal__close" aria-label="Close">&times;</span>' +
                '<img class="image-modal__img" alt="Expanded project image">';
            modal.addEventListener("click", () => modal.classList.remove("is-open"));
            document.body.appendChild(modal);
        }
        modal.querySelector(".image-modal__img").src = src;
        modal.classList.add("is-open");
    };

    document.addEventListener("keydown", function (e) {
        if (e.key === "Escape") {
            document.getElementById("image-modal")?.classList.remove("is-open");
        }
    });

    /* =====================================================
       CV SWITCHER (role x format -> fragment)
       Exposed globally; called by cv.html after it swaps in.
       ===================================================== */
    const cvState = { role: "general", format: "styled" };

    function loadCvFragment() {
        const target = document.getElementById("cv-document");
        if (!target || !window.htmx) return;
        const path =
            "/pages/contents/cv/" +
            cvState.format +
            "-" +
            cvState.role +
            ".html";
        htmx.ajax("GET", path, "#cv-document");
    }

    function syncCvButtons() {
        document.querySelectorAll(".cv-role-btn").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.role === cvState.role);
        });
        document.querySelectorAll(".cv-format-btn").forEach((b) => {
            b.classList.toggle("is-active", b.dataset.format === cvState.format);
        });
    }

    window.initCvSwitcher = function () {
        /* Reset to defaults each time the CV hub is opened. */
        cvState.role = "general";
        cvState.format = "styled";
        syncCvButtons();
    };

    /* Delegated clicks so it survives HTMX swaps. */
    document.addEventListener("click", function (e) {
        const roleBtn = e.target.closest(".cv-role-btn");
        if (roleBtn) {
            cvState.role = roleBtn.dataset.role;
            syncCvButtons();
            loadCvFragment();
            return;
        }
        const formatBtn = e.target.closest(".cv-format-btn");
        if (formatBtn) {
            cvState.format = formatBtn.dataset.format;
            syncCvButtons();
            loadCvFragment();
        }
    });
})();
