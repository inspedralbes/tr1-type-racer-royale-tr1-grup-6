<script setup>
import communicationManager from "@/services/communicationManager";
import DarkModeToggle from "./DarkModeToggle.vue";
import { watch, computed } from "vue";

const props = defineProps({
  winner: { type: Boolean, default: false },
  loser: { type: Boolean, default: false },
  message: { type: String, default: "" },
});

// Texto calculado según props
const title = computed(() =>
  props.winner ? "¡Has ganado!" : props.loser ? "Has perdido" : ""
);
const displayedMessage = computed(() =>
  props.winner
    ? "Completaste todas las palabras."
    : props.message
    ? props.message // mostrar mensaje enviado por el servidor / frontend
    : props.loser
    ? "Muchos errores, has perdido."
    : ""
);

// Opciones: recargar para volver a lobby / reiniciar
function volverLobby() {
  window.location.reload();
}
</script>

<template>
  <div class="result-screen" role="dialog" aria-live="polite">
    <DarkModeToggle />
    <div class="result-card" :class="{ win: winner, lose: loser }">
      <h1>{{ title }}</h1>
      <p>{{ displayedMessage }}</p>
      <div class="actions">
        <button @click="volverLobby">Volver al lobby</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.result-screen {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-background);
  z-index: 9999;
}

.result-card {
  max-width: 520px;
  width: 90%;
  padding: 32px;
  border-radius: 10px;
  box-shadow: 0 10px 30px var(--shadow-color);
  text-align: center;
  background: var(--color-background-soft);
}

.result-card.win {
  border: 4px solid #28a745;
  background-color: var(--color-background-soft);
}

.result-card.lose {
  border: 4px solid #dc3545;
  background-color: var(--color-background-soft);
}

.result-card h1 {
  margin: 0 0 12px;
  font-size: 2rem;
  color: var(--color-heading);
}

.result-card p {
  margin: 0 0 20px;
  font-size: 1.1rem;
  color: var(--color-text);
  opacity: 0.9;
}

.actions button {
  padding: 10px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-background-soft);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
}

.actions button:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}
</style>
