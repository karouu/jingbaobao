# Vue 2 to Vue 3 Migration Assessment Report

## 1. Executive Summary
**Recommendation: High Priority Migration**

The current codebase is built on **Vue 2.7**, which reached its **End of Life (EOL) on December 31, 2023**. This means no new features, bug fixes, or security patches will be released by the Vue team. Migrating to Vue 3 is strongly recommended to ensure the long-term maintainability, security, and performance of the JingJiaBao extension.

While the current application functions correctly, staying on an EOL framework introduces technical debt and security risks, especially for a browser extension handling sensitive data (orders, prices).

## 2. Benefits of Migration

*   **Security & Support:** Access to the latest security patches and updates from the Vue team.
*   **Performance:** Vue 3 offers significantly better performance (1.2x to 2x faster) and lower memory usage due to its Proxy-based reactivity system and optimized compiler.
*   **Bundle Size:** Tree-shaking support in Vue 3 allows for smaller build artifacts, which is crucial for extension loading times.
*   **Better TypeScript Support:** Although the current codebase is JavaScript, Vue 3's codebase is written in TypeScript, providing better type inference and enabling a smoother transition to TS in the future if desired.
*   **Composition API:** Unlocks the potential for cleaner, more reusable code logic (Hooks/Composables), replacing mixins and complex Options API structures.

## 3. Risks & Challenges

### 3.1. Dependency Compatibility
*   **Risk Level: High**
*   **Detail:** Several dependencies in `package.json` are Vue 2 specific and will break:
    *   `vue-loader` (^15.11.1) -> Needs upgrade to v17+.
    *   `vue-template-compiler` -> Deprecated in Vue 3 (replaced by `@vue/compiler-sfc`).
    *   `vue-infinite-loading` (^2.4.5) -> Check for Vue 3 compatible version or alternative.
    *   `vue-lazyload` (^1.3.5) -> Needs Vue 3 compatible version.
    *   `weui` / `weui.js` -> Generally framework-agnostic but DOM manipulation wrapper components need review.

### 3.2. Syntax Breaking Changes
*   **Risk Level: Medium**
*   **Detail:**
    *   **Global API:** `Vue.directive(...)` in `App.vue` must change to `app.directive(...)`.
    *   **Directives:** Custom directive lifecycle hooks have been renamed (e.g., `inserted` -> `mounted`).
    *   **v-model:** The internal prop for `v-model` changed from `value` to `modelValue`. Custom components implementing `v-model` (like inputs in `settings.vue` if custom wrapped) will need updates.
    *   **Events:** The `$on`, `$off`, and `$once` instance methods are removed.

### 3.3. Build System Configuration
*   **Risk Level: Medium**
*   **Detail:** `webpack.config.js` will need modification to support `vue-loader` v17 and the new compiler.

## 4. Migration Strategy

### Phase 1: Preparation (Current State)
*   **Action:** Audit all third-party libraries for Vue 3 support.
*   **Action:** Ensure all logic is decoupled from `this` context where possible (the codebase already uses standard utility functions, which is good).

### Phase 2: Build System Upgrade
*   Uninstall `vue-template-compiler`.
*   Install `vue@next`, `@vue/compiler-sfc`, and `vue-loader@next`.
*   Update `webpack.config.js`.

### Phase 3: Codebase Refactoring
1.  **Global Mount:** Update `src/popup.js` (and other entry points) to use `createApp` instead of `new Vue`.
2.  **Directives:** Update `v-tippy` definition in `App.vue` to use new lifecycle hooks.
3.  **Components:** Go file-by-file (only ~13 .vue files) to update `v-model` and remove any deprecated APIs like `$listeners`.
4.  **Testing:** Manually verify each component, specifically the `settings.vue` complex form interactions.

## 5. Conclusion
Migrating `jjb` to Vue 3 is a manageable task given the moderate size of the codebase (~13 components). The primary effort will be ensuring third-party library compatibility and updating the Webpack configuration. The benefits in performance and maintainability far outweigh the risks.
