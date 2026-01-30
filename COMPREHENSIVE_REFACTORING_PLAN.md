# Comprehensive Refactoring & Migration Plan

This document outlines a unified strategy to modernize the JingJiaBao (京价保) codebase. It combines the architectural improvements identified in the Code Review with the necessary migration from Vue 2 to Vue 3.

## 1. High-Level Goals

1.  **Modernize Framework:** Migrate from Vue 2 (EOL) to Vue 3 for security, performance, and long-term support.
2.  **Architectural Stability:** Transition from a "hybrid" Manifest V2/V3 structure (relying on Offscreen Documents) to a true Manifest V3 architecture.
3.  **Code Quality & Security:** Eliminate unsafe DOM manipulations, fragile selectors, and legacy libraries (jQuery).
4.  **Data Persistence:** Move from `localStorage` to `chrome.storage` and `IndexedDB` to support Service Worker access.

## 2. Phase 1: Security & Stability (Immediate Actions)

Before starting major framework migrations, we must address critical security and stability issues.

*   **Task 1.1: Fix Unsafe DOM Manipulation (XSS Prevention)**
    *   **Action:** Audit `src/content_script.js` and `src/components/App.vue`.
    *   **Change:** Replace all instances of `$(...).append(htmlString)` or `innerHTML = ...` with safe DOM creation methods (`document.createElement`, `textContent`).
    *   **Priority:** Critical.

*   **Task 1.2: Externalize Fragile Selectors**
    *   **Action:** Extract hardcoded CSS selectors from `src/content_script.js` and `src/tasks.js` into a dedicated `src/config/selectors.json` file.
    *   **Change:** Update code to read selectors from this config.
    *   **Benefit:** Allows easier updates when JD.com changes its frontend without deep code changes.

## 3. Phase 2: Vue 3 Migration (UI Modernization)

This phase focuses on the User Interface (`src/popup.js` and components).

*   **Task 2.1: Upgrade Build System**
    *   **Action:** Update `package.json` and `webpack.config.js`.
    *   **Details:**
        *   Remove `vue-template-compiler`.
        *   Install `vue@next`, `@vue/compiler-sfc`, `vue-loader@next`.
        *   Update Webpack rules to use the new loader.

*   **Task 2.2: Refactor Entry Points**
    *   **Action:** Update `src/popup.js` (and any other Vue entries).
    *   **Change:** Replace `new Vue({ render: h => h(App) }).$mount('#app')` with `createApp(App).mount('#app')`.

*   **Task 2.3: Update Component Syntax**
    *   **Action:** Refactor all 13 `.vue` files.
    *   **Changes:**
        *   **Global API:** Change `Vue.directive` to `app.directive`.
        *   **Directives:** Rename lifecycle hooks (e.g., `inserted` -> `mounted`).
        *   **v-model:** Update custom components to use `modelValue` prop and `update:modelValue` event instead of `value`/`input`.
        *   **Filters:** Remove filters (if any) and replace with computed properties or methods.

*   **Task 2.4: Update UI Dependencies**
    *   **Action:** Find Vue 3 compatible replacements for `vue-infinite-loading` and `vue-lazyload`.
    *   **Action:** Verify `weui.js` compatibility or replace with a Vue 3 native UI library (e.g., Vant or Element Plus) if necessary.

## 4. Phase 3: Architectural Refactoring (Manifest V3 Alignment)

This phase focuses on the background logic (`src/background.js`, `src/service_worker.js`, `src/offscreen.html`).

*   **Task 3.1: Storage Migration**
    *   **Action:** Create a unified storage service wrapper (`src/services/storage.js`).
    *   **Change:** Replace all `localStorage` usage with `chrome.storage.local`.
    *   **Benefit:** Allows the Service Worker to access settings directly without needing the Offscreen Document.

*   **Task 3.2: Service Worker Logic Transfer**
    *   **Action:** Move "pure logic" from `src/background.js` (Offscreen) to `src/service_worker.js`.
    *   **Scope:**
        *   Alarm scheduling (`chrome.alarms`).
        *   Task queue management (`src/tasks.js`).
        *   Database operations (`src/db.js` - Dexie works in SW).
        *   Network requests (Replace `$.ajax` with `fetch`).

*   **Task 3.3: Offscreen Document Reduction**
    *   **Action:** Strip `src/background.js` down to *only* what is strictly necessary.
    *   **Scope:** Keep only DOM scraping (parsing HTML strings that `DOMParser` in SW can't handle perfectly) and Audio playback.
    *   **Change:** Rename `src/background.js` to `src/offscreen.js` to clarify its limited role.

## 5. Phase 4: Code Quality & Cleanup

*   **Task 4.1: Remove jQuery**
    *   **Action:** Replace all `$` calls with native DOM APIs.
    *   **Benefit:** significantly reduces bundle size (~30KB-80KB saved) and improves performance.

*   **Task 4.2: Modularization**
    *   **Action:** Break down the massive `src/content_script.js` into smaller modules:
        *   `src/parsers/orderParser.js`
        *   `src/parsers/priceParser.js`
        *   `src/actions/couponClaimer.js`

## 6. Execution Timeline Estimate

*   **Week 1:** Phase 1 (Security) & Phase 2.1 (Build System Setup).
*   **Week 2:** Phase 2.2 - 2.4 (Vue 3 Component Migration).
*   **Week 3:** Phase 3.1 & 3.2 (Storage & Logic Migration).
*   **Week 4:** Phase 4 (jQuery Removal & Cleanup).

## 7. Conclusion

By following this plan, JingJiaBao will transition from a legacy, risk-prone codebase to a modern, secure, and performant browser extension. The move to Vue 3 ensures future compatibility, while the architectural shift to a true Service Worker model aligns with Chrome's long-term vision for extensions.
