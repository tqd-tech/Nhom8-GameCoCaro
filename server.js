const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

function randomRoomCode(length = 6) {
  let chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Không có I, O, 1, 0
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

let rooms = {}; // { code: { players: [{id, name, ready, role}], board, turn, started, winner } }

function createEmptyBoard(size = 15) {
  return Array(size)
    .fill()
    .map(() => Array(size).fill(null));
}

io.on("connection", (socket) => {
  let userName = null;

  socket.on("setName", (name) => {
    userName = name;
    socket.emit("nameSet", name);
  });
});

server.listen(3000, () => {
  console.log("Server running at http://localhost:3000/");
});