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

  socket.on("createRoom", () => {
    if (!userName) {
      socket.emit("needName");
      return;
    }
    let code;
    do {
      code = randomRoomCode();
    } while (rooms[code]);
    rooms[code] = {
      players: [
        {
          id: socket.id,
          name: userName,
          ready: false,
          role: "host",
          score: 0,
        },
      ],
      board: createEmptyBoard(),
      turn: 0,
      started: false,
      winner: null,
    };
    socket.join(code);
    socket.emit("roomCreated", {
      code,
      players: rooms[code].players,
      hostId: socket.id,
    });
    io.to(code).emit("updatePlayers", {
      players: rooms[code].players,
      hostId: socket.id,
      started: rooms[code].started,
    });
  });

  socket.on("joinRoom", (code) => {
    if (!userName) {
      socket.emit("needName");
      return;
    }
    let room = rooms[code];
    if (!room) {
      socket.emit("roomNotExist");
      return;
    }
    if (room.players.length >= 2) {
      socket.emit("roomFull");
      return;
    }
    if (room.players.find((p) => p.id === socket.id)) return;
    room.players.push({
      id: socket.id,
      name: userName,
      ready: false,
      role: "guest",
      score: 0,
    });
    socket.join(code);
    io.to(code).emit("updatePlayers", {
      players: room.players,
      hostId: room.players[0].id,
      started: room.started,
    });
    socket.emit("roomJoined", {
      code,
      players: room.players,
      hostId: room.players[0].id,
    });
  });
  socket.on("joinRoom", (code) => {
    // ... giữ nguyên như cũ ...
  });

  // ... các phần đầu giữ nguyên ...

  socket.on("setReady", (code) => {
    let room = rooms[code];
    if (!room) return;
    let player = room.players.find((p) => p.id === socket.id);
    if (!player) return;
    player.ready = true;
    io.to(code).emit("updatePlayers", {
      players: room.players,
      hostId: room.players[0].id,
      started: room.started,
    });

    // TỰ ĐỘNG BẮT ĐẦU nếu đủ 2 người và cả 2 đã ready và chưa chơi
    if (
      room.players.length === 2 &&
      room.players[0].ready &&
      room.players[1].ready &&
      !room.started
    ) {
      room.started = true; // Đánh dấu đã bắt đầu (ngăn double start)
      // Gửi countdown cho phòng
      io.to(code).emit("countdownStart", { seconds: 3 });
      setTimeout(() => {
        room.board = createEmptyBoard();
        room.turn = 0;
        room.winner = null;
        room.players.forEach((p) => (p.ready = false)); // reset ready
        io.to(code).emit("gameStart", {
          board: room.board,
          turn: room.turn,
          names: room.players.map((p) => p.name),
          scores: room.players.map((p) => p.score),
          hostId: room.players[0].id,
        });
        io.to(code).emit("updatePlayers", {
          players: room.players,
          hostId: room.players[0].id,
          started: true,
        });
      }, 3200); // Đợi cho đếm ngược 3,2,1,"Bắt đầu!"
    }
});

   // Thêm xử lý sự kiện makeMove
  socket.on("makeMove", ({ code, row, col, playerIndex }) => {
    const room = rooms[code];
    if (!room || !room.started) return;
    // Kiểm tra người chơi hợp lệ
    const player = room.players[playerIndex];
    if (!player || player.id !== socket.id) return;
    // Kiểm tra lượt
    if (room.turn % 2 !== playerIndex) return;
    // Kiểm tra ô đã đánh chưa
    if (room.board[row][col]) return;
    // Đánh cờ
    const symbol = playerIndex === 0 ? "X" : "O";
    room.board[row][col] = symbol;
    // Kiểm tra thắng
    const winResult = checkWin(room.board, row, col, symbol);
    if (winResult) {
      room.started = false;
      room.players[playerIndex].score += 1;
      io.to(code).emit("gameOver", {
        board: room.board,
        winCells: winResult.winCells,
        winner: playerIndex,
      });
      io.to(code).emit("updatePlayers", {
        players: room.players,
        hostId: room.players[0].id,
        started: false,
      });
      return;
    }
    // Kiểm tra hòa (full board)
    const isDraw = room.board.flat().every((cell) => cell);
    if (isDraw) {
      room.started = false;
      io.to(code).emit("gameOver", {
        board: room.board,
        winCells: [],
        winner: null,
      });
      io.to(code).emit("updatePlayers", {
        players: room.players,
        hostId: room.players[0].id,
        started: false,
      });
      return;
    }
    // Chuyển lượt
    room.turn++;
    io.to(code).emit("updateBoard", {
      board: room.board,
      turn: room.turn % 2,
    });
  });

  // Thêm xử lý sự kiện leaveRoom
  socket.on("leaveRoom", (code) => {
    const room = rooms[code];
    if (!room) return;
    // Xóa người chơi khỏi phòng
    room.players = room.players.filter((p) => p.id !== socket.id);
    socket.leave(code);
    // Nếu phòng còn 0 người thì xóa phòng
    if (room.players.length === 0) {
      delete rooms[code];
    } else {
      // Nếu còn người thì cập nhật lại host nếu cần
      if (room.players.length > 0) {
        room.players[0].role = "host";
      }
      io.to(code).emit("updatePlayers", {
        players: room.players,
        hostId: room.players[0]?.id,
        started: room.started,
      });
      io.to(code).emit("playerLeft");
    }
  });

  // Xử lý khi socket disconnect (đóng tab, reload, mất mạng)
  socket.on("disconnect", () => {
    // Tìm phòng mà socket này đang tham gia
    for (const code in rooms) {
      const room = rooms[code];
      if (!room) continue;
      const idx = room.players.findIndex((p) => p.id === socket.id);
      if (idx !== -1) {
        // Xóa người chơi khỏi phòng
        room.players.splice(idx, 1);
        socket.leave(code);
        // Nếu phòng còn 0 người thì xóa phòng
        if (room.players.length === 0) {
          delete rooms[code];
        } else {
          // Nếu còn người thì cập nhật lại host nếu cần
          if (room.players.length > 0) {
            room.players[0].role = "host";
          }
          io.to(code).emit("updatePlayers", {
            players: room.players,
            hostId: room.players[0]?.id,
            started: room.started,
          });
          io.to(code).emit("playerLeft");
        }
        break;
      }
    }
  });

  // ... phần còn lại giữ nguyên ...
});
server.listen(3000, () => {
  console.log("Server running at http://localhost:3000/");
});
