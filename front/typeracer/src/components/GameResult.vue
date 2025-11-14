<script setup>
import communicationManager from '@/services/communicationManager';
import DarkModeToggle from './DarkModeToggle.vue';
import LabBackground from './LabBackground.vue';
import { ref, computed, defineEmits } from 'vue';
const emit = defineEmits(['volverInicio']);

const showRanking = ref(false);

function toggleRanking() {
  showRanking.value = !showRanking.value;
}

function calcularWPM(player) {
  if (!player.playTime || player.playTime === 0) return 0;
  const minutes = player.playTime / 60000;
  if (minutes === 0) return 0;
  return Math.round(player.completedWords / minutes);
}

function calcularPrecision(player) {
  const totalTyped =
    (player.completedWords || 0) * 5 + (player.totalErrors || 0);
  if (!totalTyped) return 0; // Quan no ha tipejat res, mostra 0%
  return Math.round(100 * ((player.completedWords * 5) / totalTyped));
}

const props = defineProps({
  winner: { type: Boolean, default: false },
  loser: { type: Boolean, default: false },
  message: { type: String, default: '' },
  players: { type: Array, default: () => [] },
  modo: { type: String, default: 'normal' },
});

// Texto calculado según props
const title = computed(() =>
  props.winner ? '¡Has guanyat!' : props.loser ? 'Has perdut' : '',
);
const displayedMessage = computed(() => {
  if (props.message) return props.message;
  
  if (props.modo === 'contrarellotge') {
      if (props.winner) return "Temps completat: tens el millor resultat!";
      if (props.loser) return "Temps exhaurit o no has estat el millor.";
      return "Temps esgotat. Consulta el ranking!";
  }

  if (props.winner) {
    return props.modo === 'muerteSubita'
      ? "Ets l'últim jugador dret!"
      : 'Has completat totes les paraules.';
  }

  if (props.loser) {
    return props.modo === 'muerteSubita'
      ? 'Has fallat una paraula. Has estat eliminat.'
      : 'Masses errors o paraules acumulades.';
  }

  return '';
});
const sortedPlayers = computed(() =>
  [...props.players].sort(
    (a, b) => (b.completedWords ?? 0) - (a.completedWords ?? 0),
  ),
);
function emitirVolverInicio() {
  emit('volverInicio');
}

function cerrarResultados() {
  // Cierra el modal sin volver al lobby
  emit('cerrarResultados');
}
</script>

<template>
  <div class="result-screen" role="dialog" aria-live="polite">
    <LabBackground />
    <div class="result-card" :class="{ win: winner, lose: loser }">
      <DarkModeToggle />
      <h1>{{ title }}</h1>
      <p v-if="modo === 'muerteSubita'" class="badge">Modo: Muerte Súbita</p>
      <p>{{ displayedMessage }}</p>
      <p v-if="modo === 'contrarellotge'" class="badge-contrarellotge">Modo: Contrarellotge</p>
      <div class="actions">
        <button @click="emitirVolverInicio" style="margin-left: 8px">
          Tornar al laboratori
        </button>
        <button @click="toggleRanking">
          {{ showRanking ? 'Amagar ranking' : 'Veure ranking' }}
        </button>
      </div>
      <div v-if="showRanking" class="ranking-table">
        <table>
          <thead>
            <tr>
              <th>Posició</th>
              <th>Científic</th>
              <th>Paraules</th>
              <th>Errors</th>
              <th>Velocitat (WPM)</th>
              <th>Precisió (%)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(player, idx) in sortedPlayers" :key="player.id">
              <td>{{ idx + 1 }}</td>
              <td>{{ player.name }}</td>
              <td>{{ player.completedWords || 0 }}</td>
              <td>{{ player.totalErrors || 0 }}</td>
              <td>{{ calcularWPM(player) }}</td>
              <td>{{ calcularPrecision(player) }}</td>
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
  max-height: 50vh;
  overflow-y: auto;
  scrollbar-width: thin;
  scrollbar-color: var(--color-primary) var(--color-background);
}

.ranking-table::-webkit-scrollbar {
  width: 8px;
}

.ranking-table::-webkit-scrollbar-track {
  background: var(--color-background);
}

.ranking-table::-webkit-scrollbar-thumb {
  background-color: var(--color-primary);
  border-radius: 4px;
  border: 2px solid var(--color-background);
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
  max-width: 620px;
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

.badge {
  display: inline-block;
  background: #dc3545;
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.badge-contrarellotge {
  display: inline-block;
  background: linear-gradient(120deg, #4b016d, #7161ff);  
  color: white;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 0.85rem;
  margin-bottom: 8px;
}
.actions button {
  padding: 10px 16px;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-background-soft);
  color: var(--color-text);
  cursor: pointer;
  transition: all 0.2s ease;
  margin: 0.4rem;
}

.actions button:hover {
  background: var(--color-background-mute);
  border-color: var(--color-border-hover);
}
</style>
