<script setup>
import { ref, onMounted, reactive } from "vue";
import comms from "./services/communicationManager.js";
import GameEngine from "./components/GameEngine.vue";

const playerName = ref("");
const isReady = ref(false);
const isHost = ref(false);
const inGame = ref(false);
const initialWords = ref([]);

const players = reactive([]);

const ranking = ref([]);
const gameEnded = ref(false);

// ---- Funciones ----
function setName() {
  if (!playerName.value) return;
  comms.emit("setPlayerName", playerName.value);
}

function toggleReady() {
  isReady.value = !isReady.value;
  comms.emit("clientReady", { ready: isReady.value });
}

function startGame() {
  comms.emit("startGame");
}

// Volver al lobby
function backToLobby() {
  inGame.value = false;
  gameEnded.value = false;
  initialWords.value = [];
  players.splice(0, players.length);
}

// ---- Comunicación con backend ----
onMounted(() => {
  comms.on("updatePlayerList", ({ players: serverPlayers, hostId }) => {
    players.splice(0, players.length, ...serverPlayers);
    isHost.value = comms.socket.id === hostId;
  });

  comms.on("gameStart", (gamePayload) => {
    const myWords = gamePayload.wordsByPlayer[comms.socket.id] || [];
    initialWords.value = myWords;
    inGame.value = true;
  });

  comms.on("gameEnd", ({ ranking: finalRanking }) => {
    ranking.value = finalRanking;
    gameEnded.value = true;
  });

  comms.on("serverFull", () => {
    alert("El servidor está lleno. No puedes entrar.");
  });
});
</script>
vmdn
<template>
  <div id="app">
    <h1>Type Racer Royale</h1>

    <!-- Lobby -->
    <div v-if="!inGame && !gameEnded">
      <h2>Jugadores</h2>
      <ul>
        <li v-for="p in players" :key="p.id">
          {{ p.name }} - Score: {{ p.score }} - Palabras: {{ p.wordsRemaining }} - 
          {{ p.ready ? "Ready" : "Not ready" }} 
          <span v-if="p.eliminated">- Eliminado</span>
        </li>
      </ul>

      <div>
        <input v-model="playerName" placeholder="Tu nombre" />
        <button @click="setName">Cambiar nombre</button>
      </div>

      <div>
        <button @click="toggleReady">{{ isReady ? "Cancelar Ready" : "Ready" }}</button>
        <button v-if="isHost" @click="startGame">Iniciar partida</button>
      </div>
    </div>

    <!-- Juego -->
    <div v-if="inGame && !gameEnded">
      <GameEngine :initialWords="initialWords" />
    </div>

    <!-- Fin de juego / ranking -->
    <div v-if="gameEnded">
      <h2>Juego terminado!</h2>
      <ol>
        <li v-for="p in ranking" :key="p.id">
          {{ p.name }} - Score: {{ p.score }}
        </li>
      </ol>
      <button @click="backToLobby">Volver al lobby</button>
    </div>
  </div>
</template>

<style scoped>
#app {
  max-width: 700px;
  margin: 0 auto;
  text-align: center;
  font-family: Arial, sans-serif;
}
input {
  padding: 5px;
  margin: 5px;
}
button {
  margin: 5px;
  padding: 5px 10px;
  cursor: pointer;
}
</style>
