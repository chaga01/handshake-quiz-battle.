const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;
const rooms = new Map();
const QUESTION_TIME_MS = 15000;
const TOTAL_QUESTIONS = 8;

const QUESTIONS = [
  { question: "Which planet is known as the Red Planet?", choices: ["Venus", "Mars", "Jupiter", "Mercury"], answer: 1 },
  { question: "What is the main language used to structure a web page?", choices: ["HTML", "Python", "SQL", "C++"], answer: 0 },
  { question: "How many sides does a hexagon have?", choices: ["Five", "Seven", "Six", "Eight"], answer: 2 },
  { question: "Which device forwards data between different networks?", choices: ["Keyboard", "Router", "Monitor", "Printer"], answer: 1 },
  { question: "What is the chemical symbol for water?", choices: ["O2", "CO2", "NaCl", "H2O"], answer: 3 },
  { question: "What is 9 × 7?", choices: ["56", "63", "72", "69"], answer: 1 },
  { question: "Which ocean is the largest?", choices: ["Atlantic", "Indian", "Pacific", "Arctic"], answer: 2 },
  { question: "Which of these is a JavaScript data type?", choices: ["Boolean", "Blueprint", "Markup", "Selector"], answer: 0 }
];

function makeCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code;
  do {
    code = Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function publicPlayers(room) {
  return [...room.players.values()]
    .map(p => ({ id: p.id, name: p.name, score: p.score, answered: p.answered }))
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

function sendLobby(room) {
  io.to(room.code).emit("lobbyUpdate", {
    code: room.code,
    hostId: room.hostId,
    players: publicPlayers(room),
    status: room.status
  });
}

function sendQuestion(room) {
  if (room.timer) clearTimeout(room.timer);
  if (room.questionIndex >= TOTAL_QUESTIONS) return finishGame(room);

  room.status = "playing";
  room.questionStartedAt = Date.now();
  room.players.forEach(player => { player.answered = false; });
  const q = QUESTIONS[room.questionIndex];

  io.to(room.code).emit("question", {
    number: room.questionIndex + 1,
    total: TOTAL_QUESTIONS,
    question: q.question,
    choices: q.choices,
    duration: QUESTION_TIME_MS / 1000,
    players: publicPlayers(room)
  });

  room.timer = setTimeout(() => revealAnswer(room), QUESTION_TIME_MS);
}

function revealAnswer(room) {
  if (!room || room.status !== "playing") return;
  if (room.timer) clearTimeout(room.timer);
  const q = QUESTIONS[room.questionIndex];

  io.to(room.code).emit("answerReveal", {
    correctIndex: q.answer,
    correctText: q.choices[q.answer],
    players: publicPlayers(room)
  });

  room.timer = setTimeout(() => {
    room.questionIndex += 1;
    sendQuestion(room);
  }, 2500);
}

function finishGame(room) {
  if (room.timer) clearTimeout(room.timer);
  room.status = "finished";
  const leaderboard = publicPlayers(room);
  io.to(room.code).emit("gameOver", {
    leaderboard,
    winner: leaderboard.length ? leaderboard[0] : null
  });
}

io.on("connection", socket => {
  socket.on("createRoom", ({ name }, callback) => {
    const cleanName = String(name || "").trim().slice(0, 18);
    if (!cleanName) return callback?.({ error: "Enter a player name first." });

    const code = makeCode();
    const room = {
      code, hostId: socket.id, players: new Map(),
      status: "lobby", questionIndex: 0, timer: null
    };
    room.players.set(socket.id, { id: socket.id, name: cleanName, score: 0, answered: false });
    rooms.set(code, room);
    socket.join(code);
    callback?.({ code, playerId: socket.id });
    sendLobby(room);
  });

  socket.on("joinRoom", ({ name, code }, callback) => {
    const cleanName = String(name || "").trim().slice(0, 18);
    const cleanCode = String(code || "").trim().toUpperCase();
    const room = rooms.get(cleanCode);

    if (!cleanName) return callback?.({ error: "Enter a player name first." });
    if (!room) return callback?.({ error: "Room not found. Check the code and try again." });
    if (room.status !== "lobby") return callback?.({ error: "This game has already started." });
    if (room.players.size >= 12) return callback?.({ error: "This room is full (12 players maximum)." });

    room.players.set(socket.id, { id: socket.id, name: cleanName, score: 0, answered: false });
    socket.join(cleanCode);
    callback?.({ code: cleanCode, playerId: socket.id });
    sendLobby(room);
  });

  socket.on("startGame", ({ code }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.hostId !== socket.id || room.status !== "lobby") return;
    if (room.players.size < 2) {
      socket.emit("gameError", "At least two players must join before the host can start.");
      return;
    }
    room.questionIndex = 0;
    room.players.forEach(p => { p.score = 0; p.answered = false; });
    sendQuestion(room);
  });

  socket.on("submitAnswer", ({ code, choice }) => {
    const room = rooms.get(String(code || "").toUpperCase());
    if (!room || room.status !== "playing") return;
    const player = room.players.get(socket.id);
    if (!player || player.answered) return;
    if (!Number.isInteger(choice) || choice < 0 || choice > 3) return;

    player.answered = true;
    const q = QUESTIONS[room.questionIndex];
    const correct = choice === q.answer;
    let earned = 0;
    if (correct) {
      const elapsed = Date.now() - room.questionStartedAt;
      const remaining = Math.max(0, QUESTION_TIME_MS - elapsed);
      earned = 1000 + Math.round((remaining / QUESTION_TIME_MS) * 500);
      player.score += earned;
    }

    socket.emit("answerResult", { correct, earned });
    io.to(room.code).emit("scoreUpdate", { players: publicPlayers(room) });

    if ([...room.players.values()].every(p => p.answered)) {
      revealAnswer(room);
    }
  });

  socket.on("disconnect", () => {
    for (const [code, room] of rooms.entries()) {
      if (!room.players.has(socket.id)) continue;
      room.players.delete(socket.id);
      if (room.hostId === socket.id) {
        room.hostId = room.players.size ? room.players.keys().next().value : null;
      }
      if (room.players.size === 0) {
        if (room.timer) clearTimeout(room.timer);
        rooms.delete(code);
      } else {
        sendLobby(room);
      }
      break;
    }
  });
});

server.listen(PORT, () => console.log(`Quiz Battle server running on port ${PORT}`));
