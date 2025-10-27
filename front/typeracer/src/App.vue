<script setup>
import { ref } from "vue";
import GameEngine from "./components/GameEngine.vue";
import communicationManager from "./services/communicationManager.js"; // Importem el gestor

// Control de vista
const vistaActual = ref("salaEspera"); // 'salaEspera', 'lobby', 'joc'

// Estado de conexión
const nomJugador = ref("");
const jugadors = ref([]);

function connectarAlServidor() {
  if (nomJugador.value.trim() === "") {
    alert("Si us plau, introdueix un nom vàlid.");
    return;
  }

  // Connecta i envia el nom
  communicationManager.connect(nomJugador.value);

  // Escolta la llista de jugadors
  communicationManager.onUpdatePlayerList((llistaDeJugadors) => {
    jugadors.value = llistaDeJugadors;
  });

  // Canvia la vista al lobby
  vistaActual.value = "lobby";
}
</script>

<template>
  <main>
    <!-- VISTA 1: SALA D'ESPERA -->
    <div v-if="vistaActual === 'salaEspera'" class="vista-container">
      <h1>Type Racer Royale</h1>
      <input
        type="text"
        v-model="nomJugador"
        placeholder="Introdueix el teu nom"
      />
      <button @click="connectarAlServidor">Entra al Lobby</button>
    </div>

    <!-- VISTA 2: LOBBY -->
    <div v-else-if="vistaActual === 'lobby'" class="vista-container">
      <h2>Jugadors Connectats</h2>
      <ul>
        <li v-for="jugador in jugadors" :key="jugador.id">
          {{ jugador.name }}
        </li>
      </ul>
      <button @click="vistaActual = 'joc'">Comença a Jugar!</button>
    </div>

    <!-- VISTA 3: JOC -->
    <div v-else-if="vistaActual === 'joc'" class="vista-container">
      <GameEngine />
    </div>
  </main>
</template>
