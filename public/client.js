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
