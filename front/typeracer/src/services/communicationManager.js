// src/services/communicationManager.js
import { io } from "socket.io-client";

// Creem una única instància del socket per a tota l'aplicació
const socket = io("http://localhost:3000", {
  autoConnect: false,
});

let onConnectCb = null;

socket.on("connect", () => {
  console.log("Socket connected, id=", socket.id);
  if (typeof onConnectCb === "function") onConnectCb(socket.id);
});

const communicationManager = {
  // Funció per connectar-se i enviar el nom del jugador
  connect(playerName) {
    socket.connect();
    socket.emit("setPlayerName", playerName);

    // Opcional: escoltem la desconnexió
    socket.on("disconnect", () => {
      console.log("Desconnectat del servidor");
    });
  },

  // Registrar callback per quan s'estableix la connexió i tenim socket.id
  onConnect(callback) {
    onConnectCb = callback;
  },

  // Funcions per ESCOLTAR esdeveniments del servidor
  onUpdatePlayerList(callback) {
    socket.on("updatePlayerList", callback);
  },

  onGameStart(callback) {
    socket.on("gameStart", callback);
  },

  // Envia que l'usuari està ready / no-ready
  setReady(ready) {
    socket.emit("clientReady", { ready });
  },

  // Sol·licitud explícita del host per iniciar la partida
  requestStart() {
    socket.emit("startGame");
  },

  // Exemple de funció per enviar un missatge (es podrà ampliar)
  sendEvent(eventName, data) {
    socket.emit(eventName, data);
  },

  // Exemple de funció per escoltar un esdeveniment arbitrari
  onEvent(eventName, callback) {
    socket.on(eventName, callback);
  },

  // Funció per desconnectar-se del servidor
  disconnect() {
    if (socket.connected) {
      socket.disconnect();
    }
  },
};

export default communicationManager;
