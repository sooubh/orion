/**
 * One-time client-side migration helper to migrate legacy localStorage keys
 * from anythingllm_* to orion_* seamlessly without logging out the user.
 */
export function migrateLocalStorage() {
  if (typeof window === "undefined" || !window.localStorage) return;

  try {
    const keysToMigrate = [];
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i);
      if (key && key.startsWith("anythingllm_")) {
        keysToMigrate.push(key);
      }
    }

    for (const oldKey of keysToMigrate) {
      const newKey = oldKey.replace(/^anythingllm_/, "orion_");
      if (!window.localStorage.getItem(newKey)) {
        const val = window.localStorage.getItem(oldKey);
        if (val !== null) {
          window.localStorage.setItem(newKey, val);
        }
      }
    }
  } catch (e) {
    console.warn("[Orion] Storage migration notice:", e);
  }
}
