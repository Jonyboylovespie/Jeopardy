const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const games = {};

// Generates a 4-digit room code
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Initializes a new game state
function initGame(roomCode) {
  games[roomCode] = {
    teams: {},
    buzzerLocked: true,
    activeTeamId: null,
    blacklistedTeams: [],
    activeQuestion: null,
  };
}

// Broadcasts current game state to a room
function broadcastState(roomCode) {
  if (games[roomCode]) {
    io.to(roomCode).emit("state_update", games[roomCode]);
  }
}

io.on("connection", (socket) => {
  // Handles a host creating a new game room
  socket.on("create_room", () => {
    const roomCode = generateRoomCode();
    initGame(roomCode);
    socket.join(roomCode);
    socket.emit("room_created", roomCode);
  });

  // Handles a player joining a room and team
  socket.on("join_room", ({ roomCode, teamName }) => {
    if (!games[roomCode]) return socket.emit("error", "Room not found");
    socket.join(roomCode);
    if (!games[roomCode].teams[teamName]) {
      games[roomCode].teams[teamName] = {
        score: 0,
        members: [],
        wager: null,
        finalAnswer: null,
      };
    }
    games[roomCode].teams[teamName].members.push(socket.id);
    broadcastState(roomCode);
  });

  // Handles host selecting a question
  socket.on("select_question", ({ roomCode, question }) => {
    if (!games[roomCode]) return;
    games[roomCode].activeQuestion = question;
    games[roomCode].buzzerLocked = true;
    games[roomCode].activeTeamId = null;
    games[roomCode].blacklistedTeams = [];
    broadcastState(roomCode);
  });

  // Handles host unlocking buzzers
  socket.on("unlock_buzzers", (roomCode) => {
    if (!games[roomCode]) return;
    games[roomCode].buzzerLocked = false;
    broadcastState(roomCode);
  });

  // Handles player buzzing in
  socket.on("buzz", ({ roomCode, teamName }) => {
    const game = games[roomCode];
    if (!game || game.buzzerLocked || game.blacklistedTeams.includes(teamName))
      return;
    game.buzzerLocked = true;
    game.activeTeamId = teamName;
    broadcastState(roomCode);
  });

  // Handles host judging an answer
  socket.on("judge", ({ roomCode, teamName, isCorrect, points }) => {
    const game = games[roomCode];
    if (!game) return;
    if (isCorrect) {
      game.teams[teamName].score += points;
      game.activeQuestion = null;
      game.activeTeamId = null;
    } else {
      game.teams[teamName].score -= points;
      game.blacklistedTeams.push(teamName);
      game.activeTeamId = null;
    }
    broadcastState(roomCode);
  });

  // Handles player submitting Final Jeopardy wager
  socket.on("submit_wager", ({ roomCode, teamName, wager }) => {
    const game = games[roomCode];
    if (game && game.teams[teamName]) {
      game.teams[teamName].wager = Number(wager);
      broadcastState(roomCode);
    }
  });

  // Handles player submitting Final Jeopardy answer
  socket.on("submit_final_answer", ({ roomCode, teamName, answer }) => {
    const game = games[roomCode];
    if (game && game.teams[teamName]) {
      game.teams[teamName].finalAnswer = answer;
      broadcastState(roomCode);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
