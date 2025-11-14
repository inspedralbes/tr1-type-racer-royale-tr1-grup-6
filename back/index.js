import express from "express";
import http from "http";
import { Server } from "socket.io";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Estado de rooms y jugadores
const rooms = new Map();
const playerNames = new Map();
const playerColors = new Map();

// Genera un ID único para una room
function generateRoomId() {
  return Math.random().toString(36).substr(2, 9);
}

// Función para emitir la lista actualizada de jugadores de una room específica
function broadcastRoomPlayerList(roomId) {
  const room = rooms.get(roomId);
  if (!room) return;

  const players = Array.from(room.players.values());
  const spectators = Array.from(room.spectators.values()); // NOU

  io.to(roomId).emit("updatePlayerList", {
    players,
    spectators, // NOU
    hostId: room.hostId,
    modo: room.gameState?.modo || "normal",
  });
}

console.log("Servidor Socket.IO listo en el puerto 3000");

// Devuelve true si todos los jugadores (no eliminados) están ready
function allPlayersReadyInRoom(roomId) {
  const room = rooms.get(roomId);
  if (!room || room.players.size === 0) return false;
  return Array.from(room.players.values()).every((p) => p.ready === true);
}

// Funció createGamePayload (ja modificada per a paraules úniques)
function createGamePayload(room) {
  let words = [];
  try {
    const wordsPath = path.join(__dirname, "data", "words.json");
    const raw = fs.readFileSync(wordsPath, "utf8").replace(/^\uFEFF/, "");
    words = JSON.parse(raw.trim());
    if (!Array.isArray(words)) words = [];
  } catch (err) {
    console.error("No se pudo leer words.json:", err.message);
    words = ["palabra", "ejemplo", "prueba", "texto", "vite"];
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const gameWords = shuffle(words);

  return {
    gameWords: gameWords,
    maxStack: 20,
    intervalMs: 2000,
    startAt: Date.now() + 1500,
  };
}

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("kickUser", ({ roomId, userId }) => {
    console.log(`Expulsando ${userId} de la sala ${roomId}`);

    const room = rooms.get(roomId);
    if (!room) return;

    // Solo el host puede expulsar
    if (room.hostId !== socket.id) return;

    // Sacar al jugador del array
    room.players.delete(userId);

    // Avisar al jugador expulsado
    io.to(userId).emit("kicked", { message: "Has sido expulsado de la sala" });

    // Hacer que el jugador salga de la room de socket.io
    const targetSocket = io.sockets.sockets.get(userId);
    if (targetSocket) targetSocket.leave(roomId);

    broadcastRoomPlayerList(roomId);

    console.log(`Jugador ${userId} expulsado de la sala ${roomId}`);
  });

  // Transferir host
  socket.on("transferHost", ({ roomId, newHostId }) => {
    console.log(`Transfiriendo host en ${roomId} a ${newHostId}`);

    const room = rooms.get(roomId);
    if (!room) return;

    // Solo el host actual puede hacerlo
    if (room.hostId !== socket.id) return;

    room.hostId = newHostId;

    const newPlayersMap = new Map();
    if (room.players.has(newHostId)) {
      newPlayersMap.set(newHostId, room.players.get(newHostId));
    }

    for (const [id, player] of room.players) {
      if (id !== newHostId) {
        newPlayersMap.set(id, player);
      }
    }
    room.players = newPlayersMap;

    io.to(roomId).emit("hostTransferred", { newHostId });
    broadcastRoomPlayerList(roomId);

    console.log(`Host transferido en ${roomId} a ${newHostId}`);
  });

  // Room management events
  socket.on("listRooms", () => {
    const roomsList = Array.from(rooms.values()).map((room) => ({
      id: room.id,
      name: room.name,
      count: room.players.size,
      spectatorCount: room.spectators.size, // NOU
      modo: room.gameState?.modo || "normal",
      inGame: room.gameState?.started || false,
    }));
    socket.emit("roomList", roomsList);
  });

  socket.on("createRoom", (data) => {
    if (!data.name) return;
    const roomId = generateRoomId();
    const room = {
      id: roomId,
      name: data.name,
      color: playerColors.get(socket.id) || "#9E9E9E",
      players: new Map(),
      spectators: new Map(), // NOU
      hostId: socket.id,
      gameState: {
        started: false,
        gameWords: [],
        maxStack: 20,
        intervalMs: 2000,
      },
    };

    room.players.set(socket.id, {
      id: socket.id,
      name: playerNames.get(socket.id) || `Player-${socket.id.slice(0, 4)}`,
      color: playerColors.get(socket.id) || "#9E9E9E",
      ready: false,
      eliminated: false,
      completedWords: 0,
      totalErrors: 0,
      currentWordProgress: "", // ESTAT INICIAL
      wordStack: [], // ESTAT INICIAL
    });

    rooms.set(roomId, room);
    console.log(`Room created: ${room.name} (${roomId})`);

    socket.join(roomId);
    socket.emit("joinedRoom", { success: true, roomId: roomId });

    io.emit(
      "roomList",
      Array.from(rooms.values()).map((r) => ({
        id: r.id,
        name: r.name,
        count: r.players.size,
        spectatorCount: r.spectators.size, // NOU
        modo: r.gameState?.modo || "normal",
        inGame: r.gameState?.started || false,
      }))
    );

    broadcastRoomPlayerList(roomId);
  });

  socket.on("joinRoom", (data) => {
    const room = rooms.get(data.roomId);
    if (room) {
      if (room.gameState.started) {
        socket.emit("joinedRoom", {
          success: false,
          error: "El joc ja ha començat",
        });
        return;
      }

      room.players.set(socket.id, {
        id: socket.id,
        name: playerNames.get(socket.id) || `Player-${socket.id.slice(0, 4)}`,
        color: playerColors.get(socket.id) || "#9E9E9E",
        ready: false,
        eliminated: false,
        completedWords: 0,
        totalErrors: 0,
        currentWordProgress: "",
        wordStack: [],
      });

      socket.join(data.roomId);
      socket.emit("joinedRoom", { success: true, roomId: data.roomId });
      console.log(`Player ${socket.id} joined room ${data.roomId}`);

      io.emit(
        "roomList",
        Array.from(rooms.values()).map((r) => ({
          id: r.id,
          name: r.name,
          count: r.players.size,
          spectatorCount: r.spectators.size, // NOU
        }))
      );

      broadcastRoomPlayerList(data.roomId);
    } else {
      socket.emit("joinedRoom", { success: false, error: "Sala no trobada" });
    }
  });

  socket.on('requestSpectate', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room) {
      console.log(`[requestSpectate] Sala ${roomId} no trobada.`);
      return socket.emit('spectateError', { message: 'Sala no trobada.' });
    }

    // Comprovar si ja és espectador
    if (room.spectators.has(socket.id)) {
      console.log(`[requestSpectate] El jugador ${socket.id} ja és espectador.`);
      return socket.emit('spectateSuccess', {
        success: true,
        roomId,
        gameState: { ...room.gameState, hostId: room.hostId },
      });
    }

    let playerData = room.players.get(socket.id);
    let isEliminatedPlayer = false;

    if (!playerData) {
      const name = playerNames.get(socket.id);
      const color = playerColors.get(socket.id);

      if (name && color) {
        console.log(
          `[requestSpectate] Jugador no actiu ${name} (${socket.id}) trobat en maps globals. Reconstruint per a espectador.`
        );
        playerData = { id: socket.id, name, color };
        isEliminatedPlayer = true;
      } else {
        // Si no està en cap llista, és un socket desconegut.
        console.log(
          `[requestSpectate] Socket ${socket.id} desconegut intentant ser espectador.`
        );
        return socket.emit('spectateError', { message: 'Jugador desconegut.' });
      }
    }

    console.log(
      `[requestSpectate] Movent jugador ${playerData.name} (id: ${socket.id}) a espectadors en sala ${roomId}`
    );

    // Si el jugador estava a la llista activa, s'esborra.
    if (!isEliminatedPlayer) {
      room.players.delete(socket.id);
    }

    const spectator = {
      id: playerData.id,
      name: playerData.name,
      color: playerData.color,
    };
    room.spectators.set(socket.id, spectator);

    socket.emit('spectateSuccess', {
      success: true,
      roomId: roomId,
      gameState: { ...room.gameState, hostId: room.hostId },
    });

    broadcastRoomPlayerList(roomId);
  });

  socket.on("spectateRoom", (data) => {
    const room = rooms.get(data.roomId);
    if (!room) {
      socket.emit("spectateError", { message: "Sala no trobada" });
      return;
    }

    const spectatorData = {
      id: socket.id,
      name: playerNames.get(socket.id) || `Espectador-${socket.id.slice(0, 4)}`,
      color: playerColors.get(socket.id) || "#888888",
    };
    room.spectators.set(socket.id, spectatorData);
    socket.join(data.roomId);

    console.log(
      `Socket ${socket.id} ara és espectador a la sala ${data.roomId}`
    );

    const payload = {
      success: true,
      roomId: data.roomId,
      gameState: { ...room.gameState, hostId: room.hostId },
    };
    socket.emit("spectateSuccess", payload);

    broadcastRoomPlayerList(data.roomId);
  });

  socket.on("leaveRoom", () => {
    for (const [roomId, room] of rooms.entries()) {
      let wasInRoom = false;

      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        wasInRoom = true;

        if (room.hostId === socket.id && room.players.size > 0) {
          room.hostId = Array.from(room.players.keys())[0];
        }
      } else if (room.spectators.has(socket.id)) {
        room.spectators.delete(socket.id);
        wasInRoom = true;
      }

      if (wasInRoom) {
        socket.leave(roomId);

        if (room.players.size === 0 && room.spectators.size === 0) {
          rooms.delete(roomId);
        } else {
          broadcastRoomPlayerList(roomId);
        }

        socket.emit("leftRoom", { success: true });

        io.emit(
          "roomList",
          Array.from(rooms.values()).map((r) => ({
            id: r.id,
            name: r.name,
            count: r.players.size,
            spectatorCount: r.spectators.size,
          }))
        );
        break;
      }
    }
  });

  socket.on("disconnect", () => {
    console.log(`Usuario desconectado: ${socket.id}`);

    for (const [roomId, room] of rooms.entries()) {
      let wasInRoom = false;

      if (room.players.has(socket.id)) {
        room.players.delete(socket.id);
        wasInRoom = true;
        if (room.hostId === socket.id && room.players.size > 0) {
          room.hostId = Array.from(room.players.keys())[0];
        }
      } else if (room.spectators.has(socket.id)) {
        room.spectators.delete(socket.id);
        wasInRoom = true;
      }

      if (wasInRoom) {
        socket.leave(roomId);
        if (room.players.size === 0 && room.spectators.size === 0) {
          rooms.delete(roomId);
        } else {
          broadcastRoomPlayerList(roomId);
        }
      }
    }

    io.emit(
      "roomList",
      Array.from(rooms.values()).map((r) => ({
        id: r.id,
        name: r.name,
        count: r.players.size,
        spectatorCount: r.spectators.size,
        modo: r.gameState?.modo || "normal",
        inGame: r.gameState?.started || false,
      }))
    );
  });
  socket.on("join", (playerData) => {
    if (playerData) {
      playerNames.set(
        socket.id,
        playerData.name || `Jugador-${socket.id.slice(0, 4)}`
      );
      playerColors.set(socket.id, playerData.color || "#9E9E9E");
      console.log(
        `Jugador ${socket.id} s'ha unit: ${playerNames.get(socket.id)}`
      );

      for (const [roomId, room] of rooms.entries()) {
        if (room.players.has(socket.id)) {
          const player = room.players.get(socket.id);
          player.name = playerNames.get(socket.id);
          player.color = playerData.color || "#9E9E9E";
          player.color = playerColors.get(socket.id);
          broadcastRoomPlayerList(roomId);
        }
      }
    }
  });
  socket.on("setPlayerName", (name) => {
    playerNames.set(socket.id, name);
    console.log(`Jugador ${socket.id} se llama: ${name}`);

    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        player.name = name;
        broadcastRoomPlayerList(roomId);
      }
    }
  });

  socket.on("clientReady", (payload) => {
    const ready = !!payload?.ready;
    const roomId = payload?.roomId;

    let targetRoomId = roomId;
    if (!targetRoomId) {
      for (const [rid, room] of rooms.entries()) {
        if (room.players.has(socket.id)) {
          targetRoomId = rid;
          break;
        }
      }
    }

    if (!targetRoomId) {
      return;
    }

    const room = rooms.get(targetRoomId);
    if (!room) return;

    const player = room.players.get(socket.id);
    if (player) {
      player.ready = ready;
      broadcastRoomPlayerList(targetRoomId);
    }
  });

  socket.on("updatePlayerProgress", (payload) => {
    if (!payload || !payload.roomId) return;

    const room = rooms.get(payload.roomId);
    if (!room || !room.players.has(socket.id)) return;

    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        if (typeof payload.completedWords === "number") {
          player.completedWords = payload.completedWords;
        }
        if (typeof payload.totalErrors === "number") {
          player.totalErrors = payload.totalErrors;
        }
        // Si el cliente manda playTime (ms), lo guardamos para mostrar WPM
        if (typeof payload.playTime === "number") {
          player.playTime = payload.playTime;
        }
        if (typeof payload.lives === "number") {
          player.lives = payload.lives;
          //  Notificar a los demás jugadors
          socket.broadcast.to(roomId).emit("playerProgressUpdate", {
            playerId: socket.id,
            lives: payload.lives,
          });
        }
        if (typeof payload.currentWordProgress === "string") {
          player.currentWordProgress = payload.currentWordProgress;
        }
        if (Array.isArray(payload.wordStack)) {
          player.wordStack = payload.wordStack;
        }
        // NOU: Guardar l'estat d'eliminació
        if (typeof payload.eliminated === 'boolean') {
          player.eliminated = payload.eliminated;
        }
      }
    }
    broadcastRoomPlayerList(payload.roomId);
  });

  socket.on("playerProgressUpdate", (data) => {
    data.playerId = socket.id;
  });

  socket.on("startGame", (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.hostId) return;

    if (room.players.size < 2) {
      socket.emit("notEnoughPlayers", {
        message: "Se requieren al menos 2 jugadores para iniciar.",
      });
      return;
    }

    if (!allPlayersReadyInRoom(roomId)) {
      return;
    }
    const modo = payload?.modo || "normal";
    const duration = 30;
    console.log(`Starting game in mode: ${modo} (duration: ${duration}s)`);

    const gamePayload = createGamePayload(room);
    gamePayload.modo = modo;

    if (modo === "contrarellotge") {
      const DURATION_MS = duration * 1000;
      room.gameState.deadline = Date.now() + DURATION_MS;
      room.gameState.duration = duration;
      gamePayload.duration = duration;

      setTimeout(() => {
        const playersArray = Array.from(room.players.values());
        const noEliminats = playersArray.filter(p => !p.eliminated);
        const winner = noEliminats.sort((a, b) => {
          const diffWords = (b.completedWords || 0) - (a.completedWords || 0);
          if (diffWords !== 0) return diffWords;
          return (a.totalErrors || 0) - (b.totalErrors || 0);
        })[0];
        if (winner) {
          io.to(roomId).emit("gameOver", {
            winnerId: winner.id,
            winnerName: winner.name,
            message: `${winner.name} ha guanyat (mode contrarellotge: + paraules)!`,
          });
        } else {
          io.to(roomId).emit("gameOver", {
            winnerName: null,
            message: 'Temps esgotat! Cap guanyador clar.',
          });
        }
      }, DURATION_MS);

  // Barra sincronitzada per a tothom cada 0,5 s
  const intervalTimer = setInterval(() => {
    const now = Date.now();
    const timeLeft = room.gameState.deadline - now;
    if (timeLeft <= 0) {
      clearInterval(intervalTimer);
    }
    io.to(roomId).emit("timeLeftUpdate", { timeLeft: Math.max(timeLeft, 0) });
  }, 500);
}


    room.gameState.started = true;
    room.gameState.modo = modo;
    room.gameState.gameWords = gamePayload.gameWords;
    io.to(roomId).emit("gameStart", gamePayload);
    console.log(`gameStart emitido para room ${roomId}`);
  });



  socket.on("setRoomMode", (payload) => {
    const roomId = payload?.roomId;
    const modo = payload?.modo;
    const duration = payload?.duration; // nova durada
    if (!roomId || !modo) return;
    const room = rooms.get(roomId);
    if (!room) return;
    if (socket.id !== room.hostId) return;

    room.gameState.modo = modo;
    if (modo === "contrarellotge" && duration !== undefined) {
      room.gameState.duration = duration;
    }

    console.log(`Room ${roomId} mode changed to: ${modo} (duration: ${duration}s) by host ${socket.id}`);

    io.to(roomId).emit("roomModeUpdated", { modo, duration });
    broadcastRoomPlayerList(roomId);
  });


  socket.on("completeWord", (word) => {
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const player = room.players.get(socket.id);
        player.completedWords = (player.completedWords || 0) + 1;
        broadcastRoomPlayerList(roomId);
        break;
      }
    }
  });

  socket.on("playerLost", (payload) => {
    const roomId = payload?.roomId; // <-- CORREGIT: Agafa el roomId del payload
    if (!roomId) return;
    const room = rooms.get(roomId);
    if (!room || !room.players.has(socket.id)) return;

    const player = room.players.get(socket.id);
    if (!player || player.eliminated) return;

    player.eliminated = true;
    console.log(
      `Jugador ${player.name} ha sido eliminado por acumulación de palabras.`
    );
    socket.emit("playerEliminated", {
      playerId: player.id,
      message: "Has perdut: massa paraules acumulades.",
    });

    broadcastRoomPlayerList(roomId);

    const activos = Array.from(room.players.values()).filter(
      (p) => !p.eliminated
    );

    if (activos.length === 1) {
      const ganador = activos[0];

      io.to(ganador.id).emit("playerWon", {
        winnerId: ganador.id,
        message: "¡Enhorabona! Has guanyat tots els jugadors.",
      });

      Array.from(room.players.values()).forEach((j) => {
        if (j.id !== ganador.id) {
          io.to(j.id).emit("playerEliminated", {
            playerId: j.id,
            message: `Has perdut. El guanyador és ${ganador.name}.`,
          });
        }
      });
      io.to(roomId).emit("gameOver", {
        winnerId: ganador.id,
        winnerName: ganador.name,
        message: `${ganador.name} ha guanyat la partida.`,
      });
    }
  });

  socket.on("powerup:attack", (data) => {
    const { roomId, targetId, effectType } = data;
    
    // Validació bàsica
    const room = rooms.get(roomId);
    if (!room) return;
    if (!room.players.has(socket.id) && !room.spectators.has(socket.id)) {
      return console.log(`[Powerup] Atacant ${socket.id} no està a la sala ${roomId}`);
    }

    // Troba el socket de l'objectiu
    const targetSocket = io.sockets.sockets.get(targetId);
    
    if (targetSocket) {
      console.log(`[Powerup] Enviant atac ${effectType} de ${socket.id} a ${targetId}`);
      // Reenvia l'atac només a l'objectiu
      targetSocket.emit("powerup:receive", { 
        effectType, 
        payload: null // Pots afegir dades extra aquí si cal (p.ex. qui ataca)
      });
    } else {
      console.log(`[Powerup] Objectiu ${targetId} no trobat (desconnectat?)`);
    }
  });
  // --- FI POWERUPS ---

  socket.on("muerteSubitaElimination", (payload) => {
    const roomId = payload?.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room || room.gameState.modo !== "muerteSubita") return;

    const player = room.players.get(socket.id);
    if (!player) return;

    // Marcar al jugador como eliminado
    if (player.lives <= 0) {
      player.eliminated = true;
      console.log(`Jugador ${player.name} eliminado en mort súbita`);

      // Notificar al jugador eliminado
      socket.emit("playerEliminated", {
        playerId: player.id,
        playerName: player.name,
        message: "Has perdut totes las vides. Quedes eliminat!",
      });
    } else {
      // Notificar al jugador que perdió una vida pero sigue vivo
      socket.emit("vidasActualizadas", {
        playerId: player.id,
        lives: player.lives,
        message: `¡T'has equivocat! Et queden ${player.lives} vides.`,
      });
    }

    // Actualizar lista de jugadores en la sala
    broadcastRoomPlayerList(roomId);

    const activos = Array.from(room.players.values()).filter(
      (p) => !p.eliminated
    );

    if (activos.length === 1) {
      const ganador = activos[0];

      // Notificar al ganador
      io.to(ganador.id).emit("playerWon", {
        winnerId: ganador.id,
        message: "¡Ets l'últim jugador en peu!",
      });

      // Notificar a los demás jugadores eliminats
      Array.from(room.players.values()).forEach((j) => {
        if (j.id !== ganador.id) {
          io.to(j.id).emit("playerEliminated", {
            message: `Has perdut. El guanyador es ${ganador.name}.`,
          });
        }
      });

      // Notificar el fin del juego a toda la sala
      io.to(roomId).emit("gameOver", {
        winnerId: ganador.id,
        winnerName: ganador.name,
        message: `${ganador.name} ha ganado la partida en modo muerte súbita.`,
      });
    }
  });
});
server.listen(3000);