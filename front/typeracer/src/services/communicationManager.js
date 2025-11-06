import { io } from "socket.io-client";

const socket = io("http://localhost:3000", {
  autoConnect: false,
});

let onConnectCb = null;
let currentRoom = null;

socket.on("connect", () => {
  console.log("Socket connected, id=", socket.id);
  if (typeof onConnectCb === "function") onConnectCb(socket.id);
});

const communicationManager = {
  connect(playerData) { // playerData es { name, color }
    socket.connect();
    socket.emit("join", playerData);

    socket.on("disconnect", () => {
      console.log("Desconnectat del servidor");
      currentRoom = null;
    });
  },

  // Obtener la sala actual
  getCurrentRoom() {
    return currentRoom;
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
  requestStart(options) {
    socket.emit("startGame", options);
  },
  reportPlayerLost() {
    socket.emit("playerLost");
  },
  reportPlayerEliminated() {
    socket.emit("playerEliminated");
  },

  // Enviar que l'usuari ha completat una paraula
  updatePlayerProgress(progress) {
    // progress puede ser un número (completedWords) o un objeto
    if (typeof progress === "number") {
      if (currentRoom) {
        socket.emit("updatePlayerProgress", {
          completedWords: progress,
          roomId: currentRoom,
        });
      } else {
        socket.emit("updatePlayerProgress", { completedWords: progress });
      }
    } else {
      if (currentRoom) {
        socket.emit("updatePlayerProgress", {
          ...progress,
          roomId: currentRoom,
        });
      } else {
        socket.emit("updatePlayerProgress", progress);
      }
    }
  },

  // Escoltar actualitzacions del progrés dels jugadors
  onPlayerProgressUpdate(callback) {
    socket.on("playerProgressUpdate", callback);
  },

  // Exemple de funció per enviar un missatge (es podrà ampliar)
  sendEvent(eventName, data) {
    socket.emit(eventName, data);
  },

  // Exemple de funció per escoltar un esdeveniment arbitrari
  onEvent(eventName, callback) {
    socket.on(eventName, callback);
  },

  // --- Rooms convenience API ---
  // Request server to list rooms
  listRooms() {
    socket.emit("listRooms");
  },

  // Create a new room with a name
  createRoom(name) {
    socket.emit("createRoom", { name });
  },

  // Join an existing room by id
  joinRoom(roomId) {
    socket.emit("joinRoom", { roomId });
    // No establecemos currentRoom aquí, esperamos la confirmación del servidor
  },

  // Leave current room
  leaveRoom() {
    if (currentRoom) {
      socket.emit("leaveRoom");
      currentRoom = null;
    }
  },

  // Envia que l'usuari está ready en la sala actual
  setReady(ready) {
    if (currentRoom) {
      socket.emit("clientReady", { ready, roomId: currentRoom });
    }
  },

  // Sol·licitud explícita del host per iniciar la partida en la sala actual
  requestStart(modo = "normal") {
    if (currentRoom) {
      socket.emit("startGame", { roomId: currentRoom, modo });
    }
  },

  // Reportar eliminación en modo muerte súbita
  reportMuerteSubitaElimination() {
    if (currentRoom) {
      socket.emit("muerteSubitaElimination", { roomId: currentRoom });
    }
  },

  // Convenience listeners for rooms
  onRoomList(callback) {
    socket.on("roomList", callback);
  },

  onJoinedRoom(callback) {
    socket.on("joinedRoom", (data) => {
      if (data.success) {
        currentRoom = data.roomId;
      }
      callback(data);
    });
  },

  onLeftRoom(callback) {
    socket.on("leftRoom", (data) => {
      if (data.success) {
        currentRoom = null;
      }
      callback(data);
    });
  },

  // Funció per desconnectar-se del servidor
  disconnect() {
    if (socket.connected) {
      socket.disconnect();
    }
  },

  onPlayerEliminated(callback) {
    socket.on("playerEliminated", callback);
  },

  onPlayerWon(callback) {
    socket.on("playerWon", callback);
  },

  onGameOver(callback) {
    socket.on("gameOver", callback);
  },
};

export default communicationManager;