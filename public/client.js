const socket = io();
const $ = id => document.getElementById(id);
const screens = ["homeScreen", "lobbyScreen", "gameScreen", "resultsScreen"];
let currentCode = "";
let isHost = false;
let timerInterval = null;
let questionEndsAt = 0;
let hasAnswered = false;
let currentPlayers = [];

function showScreen(id) {
  screens.forEach(screen => $(screen).classList.toggle("hidden", screen !== id));
}
function playerName() { return $("playerName").value.trim(); }
function showHomeError(message) { $("homeError").textContent = message || ""; }
function renderPlayers(players, hostId) {
  currentPlayers = players;
  $("playerCount").textContent = `${players.length} / 12`;
  $("lobbyPlayers").innerHTML = "";
  players.forEach(player => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = player.name;
    if (player.id === hostId) {
      const host = document.createElement("span");
      host.className = "host-label";
      host.textContent = "HOST";
      name.appendChild(host);
    }
    li.appendChild(name);
    const score = document.createElement("span");
    score.textContent = `${player.score} pts`;
    li.appendChild(score);
    $("lobbyPlayers").appendChild(li);
  });
}
function renderScores(players, elementId) {
  const list = $(elementId);
  list.innerHTML = "";
  players.forEach((player, index) => {
    const li = document.createElement("li");
    const name = document.createElement("span");
    name.textContent = `${index + 1}. ${player.name}`;
    const score = document.createElement("span");
    score.textContent = `${player.score.toLocaleString()} pts`;
    li.append(name, score);
    list.appendChild(li);
  });
}
function enterRoom(result) {
  currentCode = result.code;
  $("roomCodeDisplay").textContent = currentCode;
  showScreen("lobbyScreen");
}

$("createBtn").addEventListener("click", () => {
  showHomeError("");
  socket.emit("createRoom", { name: playerName() }, result => {
    if (result.error) return showHomeError(result.error);
    isHost = true;
    enterRoom(result);
  });
});
$("joinBtn").addEventListener("click", () => {
  showHomeError("");
  socket.emit("joinRoom", { name: playerName(), code: $("roomCodeInput").value }, result => {
    if (result.error) return showHomeError(result.error);
    isHost = false;
    enterRoom(result);
  });
});
$("roomCodeInput").addEventListener("input", e => {
  e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 5);
});
$("copyCodeBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(currentCode);
    $("copyCodeBtn").textContent = "Copied!";
    setTimeout(() => $("copyCodeBtn").textContent = "Copy", 1400);
  } catch { $("copyCodeBtn").textContent = currentCode; }
});
$("startBtn").addEventListener("click", () => socket.emit("startGame", { code: currentCode }));
$("playAgainBtn").addEventListener("click", () => {
  if (timerInterval) clearInterval(timerInterval);
  currentCode = "";
  isHost = false;
  $("roomCodeInput").value = "";
  showScreen("homeScreen");
});

$("answers").addEventListener("click", event => {
  const button = event.target.closest("button[data-choice]");
  if (!button || hasAnswered || button.disabled) return;
  hasAnswered = true;
  document.querySelectorAll(".answer").forEach(b => b.disabled = true);
  button.classList.add("selected");
  $("answerFeedback").textContent = "Answer submitted. Waiting for the other players…";
  socket.emit("submitAnswer", { code: currentCode, choice: Number(button.dataset.choice) });
});

socket.on("lobbyUpdate", data => {
  currentCode = data.code;
  renderPlayers(data.players, data.hostId);
  const amHost = data.hostId === socket.id;
  $("startBtn").classList.toggle("hidden", !amHost);
  $("lobbyMessage").textContent = amHost
    ? (data.players.length < 2 ? "You are the host. Wait for at least one more player to join." : "Everyone is ready? Start the battle!")
    : "Waiting for the host to start the game…";
});
socket.on("question", data => {
  showScreen("gameScreen");
  hasAnswered = false;
  $("questionCount").textContent = `QUESTION ${data.number} / ${data.total}`;
  $("questionText").textContent = data.question;
  $("answerFeedback").textContent = "";
  $("progressBar").style.width = "100%";
  data.choices.forEach((choice, index) => {
    const button = document.querySelector(`.answer[data-choice="${index}"]`);
    button.textContent = `${String.fromCharCode(65 + index)}.  ${choice}`;
    button.disabled = false;
    button.className = "answer";
  });
  renderScores(data.players, "gameLeaderboard");
  questionEndsAt = Date.now() + data.duration * 1000;
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(() => {
    const remaining = Math.max(0, questionEndsAt - Date.now());
    $("timerText").textContent = `${Math.ceil(remaining / 1000)} seconds`;
    $("progressBar").style.width = `${remaining / (data.duration * 1000) * 100}%`;
    if (remaining <= 0) clearInterval(timerInterval);
  }, 100);
});
socket.on("answerResult", result => {
  $("answerFeedback").textContent = result.correct
    ? `Correct! +${result.earned.toLocaleString()} points`
    : "Not quite! Better luck on the next question.";
  $("answerFeedback").style.color = result.correct ? "#55e0b0" : "#ff9aaa";
});
socket.on("scoreUpdate", data => renderScores(data.players, "gameLeaderboard"));
socket.on("answerReveal", data => {
  document.querySelectorAll(".answer").forEach((button, index) => {
    button.disabled = true;
    if (index === data.correctIndex) button.classList.add("correct");
    else if (button.classList.contains("selected")) button.classList.add("incorrect");
  });
  if (!hasAnswered) $("answerFeedback").textContent = `Time's up! Correct answer: ${data.correctText}`;
  renderScores(data.players, "gameLeaderboard");
});
socket.on("gameOver", data => {
  if (timerInterval) clearInterval(timerInterval);
  showScreen("resultsScreen");
  $("winnerTitle").textContent = data.winner ? `${data.winner.name} wins!` : "Game complete";
  $("winnerSubtitle").textContent = data.winner
    ? `Champion with ${data.winner.score.toLocaleString()} points. Great game, everyone!`
    : "Thanks for playing.";
  renderScores(data.leaderboard, "finalLeaderboard");
});
socket.on("gameError", message => { $("lobbyError").textContent = message; });
socket.on("connect_error", () => showHomeError("Could not connect to the game server. Refresh and try again."));
