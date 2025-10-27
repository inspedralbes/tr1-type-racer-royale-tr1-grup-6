// src/services/communicationManager.js
import { io } from "socket.io-client";

// Creem una única instància del socket per a tota l'aplicació
const socket = io("", {
  autoConnect: false,
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

  // Funcions per ESCOLTAR esdeveniments del servidor
  onUpdatePlayerList(callback) {
    socket.on("updatePlayerList", callback);
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
