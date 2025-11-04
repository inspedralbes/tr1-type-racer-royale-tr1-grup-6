<script setup>
import communicationManager from "@/services/communicationManager";
import DarkModeToggle from "./DarkModeToggle.vue";
import { ref, computed } from "vue";
const showRanking = ref(false);

function toggleRanking() {
  showRanking.value = !showRanking.value;
}

const props = defineProps({
  winner: { type: Boolean, default: false },
  loser: { type: Boolean, default: false },
  message: { type: String, default: "" },
  players: { type: Array, default: () => [] },
  modo: { type: String, default: "normal" },
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
        <button @click="toggleRanking">
          {{ showRanking ? "Ocultar ranking" : "Ver ranking" }}
        </button>
      </div>
      <div v-if="showRanking" class="ranking-table">
        <table>
          <thead>
            <tr>
              <th>Jugador</th>
              <th>Palabras completadas</th>
              <th>Errores totales</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="player in players" :key="player.id">
              <td>{{ player.name }}</td>
              <td>{{ player.completedWords || 0 }}</td>
              <td>{{ player.totalErrors || 0 }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>

<style scoped>
.ranking-table {
  margin-top: 24px;
  text-align: left;
}
.ranking-table table {
  width: 100%;
  border-collapse: collapse;
}
.ranking-table th,
.ranking-table td {
  border: 1px solid var(--color-border, #ccc);
  padding: 8px 10px;
  text-align: center;
}
.ranking-table th {
  background: var(--color-background-soft, #f4f4f4);
  color: var(--color-heading, #333);
  font-weight: 700;
}
.ranking-table td {
  color: var(--color-text, #333);
  font-weight: 500;
}

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
