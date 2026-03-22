const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

const games = {};

// Generate 4-digit room code
function generateRoomCode() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// Initialize room state
function initGame(roomCode) {
  games[roomCode] = {
    teams: {},
    buzzerLocked: true,
    activeTeamId: null,
    blacklistedTeams: [],
    activeQuestion: null,
    answeredQuestions: [],
    gameData: null,
  };
}

// Push state to all clients
function broadcastState(roomCode) {
  if (games[roomCode]) {
    io.to(roomCode).emit("state_update", games[roomCode]);
  }
}

io.on("connection", (socket) => {
  // Setup room for host
  socket.on("create_room", () => {
    const code = generateRoomCode();
    initGame(code);
    socket.join(code);
    socket.emit("room_created", code);
  });

  // Handle entry for players and hosts
  socket.on("join_room", ({ roomCode, teamName }) => {
    if (!games[roomCode]) return;
    socket.join(roomCode);
    if (teamName !== "HOST" && !games[roomCode].teams[teamName]) {
      games[roomCode].teams[teamName] = {
        score: 0,
        wager: null,
        finalAnswer: null,
      };
    }
    broadcastState(roomCode);
  });

  // Sync game data from host
  socket.on("start_game", ({ roomCode, gameData }) => {
    if (!games[roomCode]) return;
    games[roomCode].gameData = gameData;
    broadcastState(roomCode);
  });

  // Select board item
  socket.on("select_question", ({ roomCode, question, id }) => {
    const game = games[roomCode];
    if (!game) return;
    game.activeQuestion = question;
    game.buzzerLocked = true;
    game.activeTeamId = null;
    game.blacklistedTeams = [];
    if (id && !game.answeredQuestions.includes(id)) {
      game.answeredQuestions.push(id);
    }
    broadcastState(roomCode);
  });

  // Enable buzzers
  socket.on("unlock_buzzers", (payload) => {
    const roomCode = typeof payload === "string" ? payload : payload?.roomCode;
    if (!roomCode || !games[roomCode]) return;
    games[roomCode].buzzerLocked = false;
    broadcastState(roomCode);
  });

  // Register first buzz
  socket.on("buzz", ({ roomCode, teamName }) => {
    const game = games[roomCode];
    if (!game || game.buzzerLocked || game.blacklistedTeams.includes(teamName))
      return;
    game.buzzerLocked = true;
    game.activeTeamId = teamName;
    broadcastState(roomCode);
  });

  // Score validation
  socket.on("judge_answer", ({ roomCode, correct, teamName, points }) => {
    const game = games[roomCode];
    if (!game) return;
    const resolvedTeam = teamName || game.activeTeamId;
    if (!resolvedTeam) return;
    const val = parseInt(points) || 0;
    if (correct) {
      if (game.teams[resolvedTeam]) game.teams[resolvedTeam].score += val;
      game.activeTeamId = null;
      game.buzzerLocked = true;
      game.blacklistedTeams = [];
    } else {
      if (game.teams[resolvedTeam]) game.teams[resolvedTeam].score -= val;
      game.blacklistedTeams.push(resolvedTeam);
      game.activeTeamId = null;
      game.buzzerLocked = false;
    }
    broadcastState(roomCode);
  });

  // Handle wagers
  socket.on("submit_wager", ({ roomCode, teamName, wager }) => {
    const game = games[roomCode];
    if (game?.teams[teamName]) {
      const teamMaxWager = Math.max(game.teams[teamName].score, 1000)
      game.teams[teamName].wager = Math.min(parseInt(wager), teamMaxWager) || 0;
      broadcastState(roomCode);
    }
  });

  // Final response storage
  socket.on("submit_final_answer", ({ roomCode, teamName, answer }) => {
    const game = games[roomCode];
    if (game?.teams[teamName]) {
      game.teams[teamName].finalAnswer = answer;
      broadcastState(roomCode);
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Studio active on port ${PORT}`));
