// front/typeracer/src/services/communicationManager.js
import { io } from "socket.io-client";

const socket = io("http://localhost:3000"); // Backend

export default {
  socket,

  on(event, callback) {
    socket.on(event, callback);
  },

  off(event) {
    socket.off(event);
  },

  emit(event, payload) {
    socket.emit(event, payload);
  },
};
