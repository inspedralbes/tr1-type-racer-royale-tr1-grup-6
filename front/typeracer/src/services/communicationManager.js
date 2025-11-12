//import { on } from "node:events";
import { io } from 'socket.io-client';

const socket = io('http://localhost:3000', {
  autoConnect: false,
});

let onConnectCb = null;
let currentRoom = null;

// Evento de conexión
socket.on('connect', () => {
  console.log('Socket connected, id=', socket.id);
  if (typeof onConnectCb === 'function') onConnectCb(socket.id);
});

const communicationManager = {
  // Conectar al servidor y unirse como jugador
  connect(playerData) {
    socket.connect();
    socket.emit('join', playerData);

    socket.on('disconnect', () => {
      console.log('Desconnectat del servidor');
      currentRoom = null;
    });
  },
  get id() {
    return socket.id;
  },

  // Obtener la sala actual
  getCurrentRoom() {
    return currentRoom;
  },

  // Obtenir el nostre ID de socket
  getId() {
    return socket.id;
  },

  // Registrar callback al conectar
  onConnect(callback) {
    onConnectCb = callback;
  },

  // Escuchar lista de jugadores
  onUpdatePlayerList(callback) {
    socket.on('updatePlayerList', callback);
  },

  // Escuchar inicio del juego
  onGameStart(callback) {
    socket.on('gameStart', callback);
  },

  // Marcar usuario como ready / no-ready (con sala actual)
  setReady(ready) {
    if (currentRoom) {
      socket.emit('clientReady', { ready, roomId: currentRoom });
    } else {
      socket.emit('clientReady', { ready });
    }
  },

  // Solicitar inicio de partida (modo normal o muerte súbita)
  requestStart(modo = 'normal') {
    if (currentRoom) {
      socket.emit('startGame', { roomId: currentRoom, modo });
    } else {
      socket.emit('startGame', { modo });
    }
  },

  // Host can set the room mode before starting
  setRoomMode(modo) {
    if (currentRoom) {
      socket.emit('setRoomMode', { roomId: currentRoom, modo });
    } else {
      socket.emit('setRoomMode', { modo });
    }
  },

  // Reportar que un jugador ha perdido
  reportPlayerLost() {
    socket.emit('playerLost', { roomId: currentRoom }); // CORREGIT
  },

  reportPlayerEliminated() {
    if (currentRoom) {
      socket.emit('muerteSubitaElimination', { roomId: currentRoom });
      console.log('Reportando eliminación para sala:', currentRoom);
    } else {
      console.error('No hay roomId actual al reportar eliminación.');
    }
  },

  // Enviar progreso del jugador
  updatePlayerProgress(progress) {
    if (typeof progress === 'number') {
      socket.emit('updatePlayerProgress', {
        completedWords: progress,
        roomId: currentRoom,
      });
    } else {
      socket.emit('updatePlayerProgress', {
        ...progress,
        roomId: currentRoom,
      });
    }
  },

  // Escuchar actualizaciones del progreso de jugadores
  onPlayerProgressUpdate(callback) {
    socket.on('playerProgressUpdate', callback);
  },

  // Enviar evento genérico
  sendEvent(eventName, data) {
    socket.emit(eventName, data);
  },

  // Escuchar evento genérico
  onEvent(eventName, callback) {
    socket.on(eventName, callback);
  },

  // --- Gestión de salas (rooms) ---

  // Pedir al servidor la lista de salas
  listRooms() {
    socket.emit('listRooms');
  },

  // Crear una nueva sala
  createRoom(name) {
    socket.emit('createRoom', { name });
  },

  // Unirse a una sala existente
  joinRoom(roomId) {
    socket.emit('joinRoom', { roomId });
  },

  spectateRoom(roomId) {
    socket.emit('spectateRoom', { roomId });
  },

  onSpectateSuccess(callback) {
    socket.on('spectateSuccess', (data) => {
      if (data.success && data.roomId) {
        currentRoom = data.roomId;
        console.log('Establecida sala actual (espectador):', currentRoom);
      }
      callback(data);
    });
  },

  requestSpectate() {
    if (currentRoom) {
      console.log('Emetent requestSpectate per a la sala:', currentRoom);
      socket.emit('requestSpectate', { roomId: currentRoom });
    } else {
      console.error('No es pot sol·licitar ser espectador, no hi ha sala actual');
    }
  },

  onSpectateModeActivated(callback) {
    socket.on('spectateModeActivated', callback);
  },

  onSpectateError(callback) {
    socket.on('spectateError', callback);
  },

  leaveRoom() {
    if (currentRoom) {
      socket.emit('leaveRoom');
      currentRoom = null;
    }
  },

  // Reportar eliminación en modo muerte súbita
  reportMuerteSubitaElimination() {
    if (currentRoom) {
      socket.emit('muerteSubitaElimination', { roomId: currentRoom });
      console.log('Enviando eliminación muerte súbita para sala:', currentRoom);
    } else {
      console.error(
        'Error: No se encontró roomId actual al reportar eliminación muerte súbita',
      );
    }
  },

  // --- Listeners relacionados con salas ---
  onRoomList(callback) {
    socket.on('roomList', callback);
  },

  onJoinedRoom(callback) {
    socket.on('joinedRoom', (data) => {
      if (data.success && data.roomId) {
        currentRoom = data.roomId;
        console.log('Establecida sala actual (jugador):', currentRoom);
      }
      callback(data);
    });
  },

  // Escuchar cambios de modo en la sala
  onRoomModeUpdated(callback) {
    socket.on('roomModeUpdated', callback);
  },

  onLeftRoom(callback) {
    socket.on('leftRoom', (data) => {
      if (data.success) {
        currentRoom = null;
      }
      callback(data);
    });
  },

  // --- Otros eventos del juego ---
  onPlayerEliminated(callback) {
    socket.on('playerEliminated', callback);
  },

  onPlayerWon(callback) {
    socket.on('playerWon', callback);
  },

  onGameOver(callback) {
    socket.on('gameOver', callback);
  },

  kickUser(roomId, userId) {
    socket.emit('kickUser', { roomId, userId });
  },

  transferHost(roomId, newHostId) {
    socket.emit('transferHost', { roomId, newHostId });
  },

  onkicked(callback) {
    socket.on('kicked', callback);
  },

  onHostTransferred(callback) {
    socket.on('hostTransferred', callback);
  },

  // Desconectarse del servidor
  disconnect() {
    if (socket.connected) {
      socket.disconnect();
    }
  },
};

export default communicationManager;
