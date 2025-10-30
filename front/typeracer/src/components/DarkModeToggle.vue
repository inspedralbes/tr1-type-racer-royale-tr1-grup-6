<template>
  <button
    class="dark-toggle"
    :aria-pressed="isDark.toString()"
    @click="toggle"
    title="Toggle dark mode"
  >
    <span v-if="isDark">🌙</span>
    <span v-else>☀️</span>
  </button>
</template>

<script setup>
import { ref, onMounted } from "vue";

const STORAGE_KEY = "typeracer-dark-mode";
const isDark = ref(false);

function applyTheme(dark) {
  const root = document.documentElement;
  if (dark) {
    root.setAttribute("data-theme", "dark");
  } else {
    // Explicitly set 'light' so we can override prefers-color-scheme dark
    root.setAttribute("data-theme", "light");
  }
}

function toggle() {
  isDark.value = !isDark.value;
  localStorage.setItem(STORAGE_KEY, isDark.value ? "dark" : "light");
  applyTheme(isDark.value);
}

onMounted(() => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "dark") {
      isDark.value = true;
      applyTheme(true);
      return;
    } else if (stored === "light") {
      isDark.value = false;
      applyTheme(false);
      return;
    }
  } catch (e) {
    // ignore storage errors
  }

  // fallback: respect prefers-color-scheme if no explicit pref set
  const prefersDark =
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches;
  isDark.value = prefersDark;
  applyTheme(isDark.value);
});
</script>

<style scoped>
.dark-toggle {
  position: fixed;
  top: 18px;
  right: 18px;
  width: 40px;
  height: 40px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  background: var(--color-background-soft);
  color: var(--color-heading);
  border: 1px solid var(--color-border);
  cursor: pointer;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
  transition: background-color 0.2s ease, color 0.2s ease;
  z-index: 1000;
}

.dark-toggle:focus {
  outline: 2px solid rgba(0, 0, 0, 0.08);
}
</style>
