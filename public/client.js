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

function updateRoomActions() {
  roomActions.innerHTML = "";
  let myIdx = getMyIndex();
  let me = playerList[myIdx];
  let other = playerList[1 - myIdx];

  // Nếu chưa đủ 2 người
  if (playerList.length < 2) {
    if (isHost) {
      roomActions.innerHTML = `<span>Chia sẻ mã phòng cho bạn bè để vào.</span>`;
      setStatus("Chờ người chơi khác vào phòng...", "#e53935");
    } else {
      roomActions.innerHTML = `<span>Chờ chủ phòng bắt đầu.</span>`;
      setStatus("Chờ chủ phòng bắt đầu.", "#e53935");
    }
    return;
  }

  // Đủ 2 người, chưa bắt đầu game
  if (!gameStarted) {
    if (!me.ready) {
      let btn = document.createElement("button");
      btn.textContent = "Sẵn sàng";
      btn.className = "btn-ready-new";
      btn.onclick = () => {
        socket.emit("setReady", roomCode);
        btn.disabled = true;
      };
      roomActions.appendChild(btn);
      setStatus("Nhấn 'Sẵn sàng' để chuẩn bị trận đấu.", "#1976d2");
    } else if (!other?.ready) {
      setStatus("Chờ người chơi còn lại nhấn 'Sẵn sàng'...", "#1976d2");
    } else {
      setStatus("Cả 2 đã sẵn sàng, trận đấu sẽ tự động bắt đầu!", "#43cea2");
      // Không cần nút nào nữa, server sẽ tự bắt đầu
    }
    return;
  }

  // Đang chơi
  if (gameStarted) {
    let turnIdx = boardTurnIndex();
    let yourTurn = getMyIndex() === turnIdx;
    setStatus(yourTurn ? "Đến lượt bạn!" : "Chờ đối thủ...", "#1976d2");
  }
}
function isMyTurn(turnIdx) {
  let myIdx = getMyIndex();
  return myIdx === turnIdx && gameStarted;
}
function getMyIndex() {
  for (let i = 0; i < playerList.length; i++) {
    if (playerList[i]?.id === playerId) return i;
  }
  return -1;
}

function renderBoard() {
  if (!board || board.length === 0) {
    board = Array(BOARD_SIZE)
      .fill()
      .map(() => Array(BOARD_SIZE).fill(null));
  }
  boardDiv.innerHTML = "";
  boardDiv.appendChild(winLineSVG);
  for (let i = 0; i < BOARD_SIZE; i++) {
    for (let j = 0; j < BOARD_SIZE; j++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      if (board[i][j] === "X") cell.classList.add("x");
      if (board[i][j] === "O") cell.classList.add("o");
      if (winCells.some(([r, c]) => r === i && c === j))
        cell.classList.add("win");
      cell.textContent = board[i][j] || "";
      cell.onclick = () => {
        if (
          !gameStarted ||
          !isMyTurn(
            playerList && playerList.length === 2 ? boardTurnIndex() : 0
          )
        )
          return;
        if (board[i][j]) return;
        socket.emit("makeMove", {
          code: roomCode,
          row: i,
          col: j,
          playerIndex: getMyIndex(),
        });
      };
      boardDiv.appendChild(cell);
    }
  }
  drawWinLine();
}

function boardTurnIndex() {
  let x = 0,
    o = 0;
  for (let i = 0; i < BOARD_SIZE; i++)
    for (let j = 0; j < BOARD_SIZE; j++)
      if (board[i][j] === "X") x++;
      else if (board[i][j] === "O") o++;
  return x <= o ? 0 : 1;
}

function drawWinLine() {
  winLineSVG.innerHTML = "";
  if (!winCells || winCells.length < 2) return;
  const boardRect = boardDiv.getBoundingClientRect();
  const cellNodes = [...boardDiv.children].filter((c) =>
    c.classList.contains("cell")
  );
  if (cellNodes.length < BOARD_SIZE * BOARD_SIZE) return;
  let [r0, c0] = winCells[0];
  let [r1, c1] = winCells[winCells.length - 1];
  let idx0 = r0 * BOARD_SIZE + c0;
  let idx1 = r1 * BOARD_SIZE + c1;
  let cell0 = cellNodes[idx0];
  let cell1 = cellNodes[idx1];
  if (!cell0 || !cell1) return;
  let rect0 = cell0.getBoundingClientRect();
  let rect1 = cell1.getBoundingClientRect();
  let x0 = rect0.left + rect0.width / 2 - boardRect.left;
  let y0 = rect0.top + rect0.height / 2 - boardRect.top;
  let x1 = rect1.left + rect1.width / 2 - boardRect.left;
  let y1 = rect1.top + rect1.height / 2 - boardRect.top;
  winLineSVG.setAttribute("width", boardRect.width);
  winLineSVG.setAttribute("height", boardRect.height);
  winLineSVG.innerHTML = `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="orange" stroke-width="6" stroke-linecap="round" />`;
}

function startCountdown(from, callback) {
  let i = from;
  status.style.fontSize = "2.3rem";
  status.style.color = "#e53935";
  countdownInterval = setInterval(() => {
    if (i > 0) {
      status.textContent = i;
    } else if (i === 0) {
      status.textContent = "Bắt đầu!";
    } else {
      clearInterval(countdownInterval);
      status.style.fontSize = "";
      status.style.color = "";
      status.textContent = "";
      callback && callback();
    }
    i--;
  }, 700);
}

window.onload = () => {
  showStep("name");
  board = Array(BOARD_SIZE)
    .fill()
    .map(() => Array(BOARD_SIZE).fill(null));
  renderBoard();
  setStatus("Nhập tên để bắt đầu!", "#1976d2", "1.2rem");
};

// Đếm ngược khi bắt đầu bằng socket
socket.on("countdownStart", ({ seconds }) => {
  showCountdownModal(seconds || 3);
});

function showCountdownModal(seconds) {
  // Tạo modal/hộp hội thoại nếu chưa có
  let modal = document.getElementById("countdown-modal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "countdown-modal";
    modal.style.position = "fixed";
    modal.style.top = 0;
    modal.style.left = 0;
    modal.style.width = "100vw";
    modal.style.height = "100vh";
    modal.style.background = "rgba(20,40,80,0.88)";
    modal.style.display = "flex";
    modal.style.alignItems = "center";
    modal.style.justifyContent = "center";
    modal.style.zIndex = 9999;
    modal.innerHTML = `<div id="countdown-num" style="font-size:7rem;color:#fff;font-weight:900;text-shadow:0 0 24px #43cea2,0 2px 16px #000;">3</div>`;
    document.body.appendChild(modal);
  }
  let numDiv = document.getElementById("countdown-num");
  let n = seconds;
  numDiv.textContent = n;
  modal.style.display = "flex";
  let timer = setInterval(() => {
    n--;
    if (n > 0) {
      numDiv.textContent = n;
    } else if (n === 0) {
      numDiv.textContent = "Bắt đầu!";
    } else {
      clearInterval(timer);
      modal.style.display = "none";
    }
  }, 900);
}