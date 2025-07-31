const socket = io();
let playerId = null;
let userName = "";
let roomCode = "";
let isHost = false;
let isReady = false;
let gameStarted = false;
let board = [];
const BOARD_SIZE = 15;
let playerList = [];
let hostId = null;
let winCells = [];
let countdownInterval = null;

const stepName = document.getElementById("stepName");
const stepChoose = document.getElementById("stepChoose");
const btnSetName = document.getElementById("btnSetName");
const inputName = document.getElementById("inputName");
const btnCreateRoom = document.getElementById("btnCreateRoom");
const btnJoinRoom = document.getElementById("btnJoinRoom");
const inputRoomCode = document.getElementById("inputRoomCode");
const roomInfo = document.getElementById("roomInfo");
const roomCodeDiv = document.getElementById("roomCode");
const playersListDiv = document.getElementById("playersList");
const scoreBoard = document.getElementById("scoreBoard");
const roomActions = document.getElementById("roomActions");
const status = document.getElementById("status");
const boardDiv = document.getElementById("board");
const winLineSVG = document.getElementById("winLineSVG");

function showStep(step) {
  stepName.classList.add("hide");
  stepChoose.classList.add("hide");
  roomInfo.classList.add("hide");
  if (step === "name") stepName.classList.remove("hide");
  if (step === "choose") stepChoose.classList.remove("hide");
  if (step === "room") roomInfo.classList.remove("hide");
}

function setStatus(text, color = "#1976d2", size = "1.15rem") {
  status.textContent = text;
  status.style.color = color;
  status.style.fontSize = size;
}

btnSetName.onclick = () => {
  let name = inputName.value.trim();
  if (!name) {
    setStatus("Vui lòng nhập tên!", "#e53935");
    return;
  }
  userName = name;
  socket.emit("setName", name);
  setStatus("Đang xác nhận tên...", "#43cea2");
};

socket.on("nameSet", () => {
  playerId = socket.id;
  showStep("choose");
  setStatus("Chọn tạo phòng mới hoặc nhập mã phòng để tham gia.", "#1976d2");
});

btnCreateRoom.onclick = () => {
  socket.emit("createRoom");
  setStatus("Đang tạo phòng...", "#43cea2");
};

btnJoinRoom.onclick = () => {
  let code = inputRoomCode.value.trim().toUpperCase();
  if (!code) {
    setStatus("Vui lòng nhập mã phòng.", "#e53935");
    return;
  }
  socket.emit("joinRoom", code);
  setStatus("Đang vào phòng...", "#43cea2");
};

socket.on("roomCreated", ({ code, players, hostId: hId }) => {
  roomCode = code;
  hostId = hId;
  isHost = playerId === hostId;
  updateRoom(players);
  showStep("room");
  setStatus("Phòng đã tạo! Chia sẻ mã cho bạn bè để cùng chơi.", "#43cea2");
});

socket.on("roomJoined", ({ code, players, hostId: hId }) => {
  roomCode = code;
  hostId = hId;
  isHost = playerId === hostId;
  updateRoom(players);
  showStep("room");
  setStatus("Vào phòng thành công!", "#43cea2");
});

socket.on("updatePlayers", ({ players, hostId: hId, started }) => {
  hostId = hId;
  isHost = playerId === hostId;
  updateRoom(players);
  gameStarted = !!started;
  updateRoomActions();
});

socket.on("roomNotExist", () => {
  setStatus("Phòng không tồn tại!", "#e53935");
});
socket.on("roomFull", () => {
  setStatus("Phòng đã đủ 2 người!", "#e53935");
});
socket.on("needName", () => {
  showStep("name");
  setStatus("Bạn cần nhập tên trước!", "#e53935");
});

socket.on("playerLeft", () => {
  alert("Đối thủ đã rời phòng. Bạn sẽ được đưa về màn hình chính.");
  location.reload();
  updateRoomActions();
});
socket.on("gameStart", (data) => {
  board = data.board;
  winCells = [];
  gameStarted = true;
  updateRoomActions();
  renderBoard();
  setStatus(
    isHost ? "Bạn là chủ phòng. Đến lượt bạn!" : "Chờ chủ phòng đi trước!",
    "#43cea2",
    "1.25rem"
  );
});

socket.on("updateBoard", (data) => {
  board = data.board;
  winCells = [];
  renderBoard();
  let yourTurn = isMyTurn(data.turn);
  setStatus(
    yourTurn ? "Đến lượt bạn!" : "Chờ đối thủ...",
    "#1976d2",
    "1.15rem"
  );
});

socket.on("gameOver", (data) => {
  board = data.board;
  winCells = data.winCells || [];
  gameStarted = false;
  renderBoard();
  let winnerIdx = data.winner;
  let myIdx = getMyIndex();
  setStatus(
    winnerIdx === myIdx ? "🎉 Bạn thắng!" : "Bạn thua rồi 😢",
    winnerIdx === myIdx ? "#43cea2" : "#e53935",
    "1.25rem"
  );
  updateRoomActions();
});

function updateRoom(players) {
  playerList = players || [];
  // Room code
  roomCodeDiv.innerHTML = `<span style="font-size:1rem;color:#666;">Mã phòng:</span> <span id="roomCodeText" style="font-size:2rem;letter-spacing:2px;color:#1565c0">${roomCode}</span> <button id="btnCopyRoomCode" style="margin: 5px auto;padding:2px 10px;font-size:1rem;border-radius:6px;border:none;background:#ffffff;color:#9d9d9d;cursor:pointer;">Copy</button> <button id="btnLeaveRoom" style="margin-bottom:10px;padding:6px 12px;font-size:1rem;border-radius:6px;border:none;background:#e53935;color:#fff;cursor:pointer;">Thoát</button>`;
  // Thêm sự kiện copy và thoát
  setTimeout(() => {
    const btnCopy = document.getElementById("btnCopyRoomCode");
    if (btnCopy) {
      btnCopy.onclick = () => {
        const codeText = document.getElementById("roomCodeText").textContent;
        navigator.clipboard.writeText(codeText);
        btnCopy.textContent = "Đã copy!";
        setTimeout(() => (btnCopy.textContent = "Copy"), 1200);
      };
    }
    const btnLeave = document.getElementById("btnLeaveRoom");
    if (btnLeave) {
      btnLeave.onclick = () => {
        socket.emit("leaveRoom", roomCode);
        location.reload();
      };
    }
  }, 0);
  // Players list
  let html = "";
  for (let i = 0; i < 2; i++) {
    let p = playerList[i];
    if (p) {
      html += `<div class="player-row">
                <span class="name">${p.name}</span>
                <span class="role" style="background:${
                  p.role === "host" ? "#43cea2" : "#1976d2"
                };">${p.role === "host" ? "Chủ phòng" : "Khách"}</span>
                ${p.ready ? '<span class="ready">Sẵn sàng</span>' : ""}
            </div>`;
    } else {
      html += `<div class="player-row"><span style="color:#aaa;">(Đang chờ...)</span></div>`;
    }
  }
  playersListDiv.innerHTML = html;

  // Scoreboard
  let scoreHTML = "";
  for (let i = 0; i < 2; i++) {
    let p = playerList[i];
    if (p) scoreHTML += `<span>${p.name}: <b>${p.score}</b></span>`;
  }
  scoreBoard.innerHTML = scoreHTML;

  updateRoomActions();
}
