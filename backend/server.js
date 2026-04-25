const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.set("trust proxy", 1);
const csp = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "connect-src 'self' ws: wss: http: https:",
  "form-action 'self'",
  "require-trusted-types-for 'script'",
  "trusted-types default",
].join("; ");

app.use((req, res, next) => {
  res.setHeader("Content-Security-Policy", csp);
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("X-Frame-Options", "SAMEORIGIN");
  res.setHeader("X-Content-Type-Options", "nosniff");

  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  const isHttps = req.secure || forwardedProto.includes("https");
  if (isHttps) {
    res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }

  next();
});

app.use(cors());
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const EVENTS = require("./socketEvents");

const games = {};

// Room code configuration: 6-character alphanumeric (numbers + capital letters)
const CODE_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const CODE_LENGTH = 6;
const MAX_CODE_GEN_ATTEMPTS = 10000;
const ROOM_TTL_MS = 60 * 60 * 1000; // 1 hour
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000; // 1 minute

// Generate a random room code (6 chars, digits + uppercase letters)
function generateRoomCode() {
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return code;
}

// Generate a unique room code (retry on collisions)
function generateUniqueRoomCode() {
  for (let attempt = 0; attempt < MAX_CODE_GEN_ATTEMPTS; attempt++) {
    const code = generateRoomCode();
    if (!games[code]) return code;
  }
  throw new Error("Failed to generate unique room code");
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
    dailyDoubles: [],
    // Track host for inactivity-based cleanup
    hostSocketId: null,
    lastHostActivity: Date.now(),
  };
}

// Push state to all clients
function broadcastState(roomCode) {
  if (games[roomCode]) {
    io.to(roomCode).emit(EVENTS.STATE_UPDATE, games[roomCode]);
  }
}

function validateWager(game, teamName, wager) {
  const team = game?.teams?.[teamName];
  if (!team) return 0;
  const max = Math.max(team.score, 1000);
  return Math.min(Math.abs(parseInt(wager)) || 0, max);
}

io.on("connection", (socket) => {
  // Setup room for host
  socket.on(EVENTS.CREATE_ROOM, () => {
    const code = generateUniqueRoomCode();
    initGame(code);
    games[code].hostSocketId = socket.id;
    games[code].lastHostActivity = Date.now();
    socket.join(code);
    socket.emit(EVENTS.ROOM_CREATED, code);
  });

  // Handle entry for players and hosts
  socket.on(EVENTS.JOIN_ROOM, ({ roomCode, teamName }) => {
    if (!games[roomCode]) return;
    // If a host joins, record their socket so we can track activity
    if (teamName === "HOST") {
      games[roomCode].hostSocketId = socket.id;
      games[roomCode].lastHostActivity = Date.now();
    }

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
  socket.on(EVENTS.START_GAME, ({ roomCode, gameData }) => {
    if (!games[roomCode]) return;
    // Touch host activity if this came from the recorded host socket
    if (games[roomCode].hostSocketId === socket.id) games[roomCode].lastHostActivity = Date.now();

    games[roomCode].gameData = gameData;

    // Generate daily doubles: 1 for round1, 2 for round2
    const makeIds = (roundKey) => {
      const ids = [];
      const round = gameData[roundKey] || [];
      for (let c = 0; c < round.length; c++) {
        const questions = round[c].questions || [];
        for (let q = 0; q < questions.length; q++) {
          ids.push(`${roundKey}-${c}-${q}`);
        }
      }
      return ids;
    };

    const round1Ids = makeIds("round1");
    const round2Ids = makeIds("round2");
    const daily = [];

    if (round1Ids.length > 0) {
      daily.push(round1Ids[Math.floor(Math.random() * round1Ids.length)]);
    }

    const shuffled2 = [...round2Ids].sort(() => Math.random() - 0.5);
    if (shuffled2.length > 0) daily.push(shuffled2[0]);
    if (shuffled2.length > 1) daily.push(shuffled2[1]);

    games[roomCode].dailyDoubles = daily;

    broadcastState(roomCode);
  });

  // Select board item
  socket.on(EVENTS.SELECT_QUESTION, ({ roomCode, question, id }) => {
    const game = games[roomCode];
    if (!game) return;
    if (game.hostSocketId === socket.id) game.lastHostActivity = Date.now();

    // If question is null, the host is closing the current active question
    if (!question) {
      if (game.activeQuestion && game.activeQuestion.isDailyDouble) {
        const ddTeam = game.activeQuestion.dailyDoubleTeam;
        if (ddTeam && game.teams[ddTeam]) {
          game.teams[ddTeam].wager = null;
        }
      }

      game.activeQuestion = null;
      game.buzzerLocked = true;
      game.activeTeamId = null;
      game.blacklistedTeams = [];
      broadcastState(roomCode);
      return;
    }

    // If host selected Final Jeopardy, reset wagers/answers for everyone
    if (question && question.isFinal) {
      game.activeQuestion = { ...(question || {}), isFinal: true };
      game.buzzerLocked = true;
      game.activeTeamId = null;
      game.blacklistedTeams = [];
      // Reset wagers and finalAnswer for all teams so they can re-wager
      Object.keys(game.teams || {}).forEach((t) => {
        if (game.teams[t]) {
          game.teams[t].wager = null;
          game.teams[t].finalAnswer = null;
        }
      });

      broadcastState(roomCode);
      return;
    }

    const isDaily = id && Array.isArray(game.dailyDoubles) && game.dailyDoubles.includes(id);

    if (isDaily) {
      game.activeQuestion = { ...(question || {}), isDailyDouble: true, dailyDoubleId: id, dailyDoubleTeam: null, revealed: false, judged: false };
    } else {
      game.activeQuestion = question;
      game.blacklistedTeams = [];
    }

    game.buzzerLocked = true;
    game.activeTeamId = null;
    if (id && !game.answeredQuestions.includes(id)) {
      game.answeredQuestions.push(id);
    }

    broadcastState(roomCode);
  });

  // Host assigns which team hit the Daily Double
  socket.on(EVENTS.ASSIGN_DAILY_DOUBLE, ({ roomCode, id, teamName }) => {
    const game = games[roomCode];
    if (!game || !game.activeQuestion) return;
    if (game.hostSocketId === socket.id) game.lastHostActivity = Date.now();
    if (game.activeQuestion.isDailyDouble && game.activeQuestion.dailyDoubleId === id) {
      game.activeQuestion.dailyDoubleTeam = teamName;
      if (game.teams && game.teams[teamName]) {
        game.teams[teamName].wager = null;
        game.teams[teamName].finalAnswer = null;
      }
      broadcastState(roomCode);
    }
  });

  // Allow host to reveal the current question (centralized reveal state)
  socket.on(EVENTS.REVEAL_QUESTION, (roomCode) => {
    const game = games[roomCode];
    if (!game || !game.activeQuestion) return;
    if (game.hostSocketId === socket.id) game.lastHostActivity = Date.now();
    game.activeQuestion.revealed = true;
    broadcastState(roomCode);
  });

  // Enable buzzers
  socket.on(EVENTS.UNLOCK_BUZZERS, (payload) => {
    const roomCode = typeof payload === "string" ? payload : payload?.roomCode;
    if (!roomCode || !games[roomCode]) return;
    if (games[roomCode].hostSocketId === socket.id) games[roomCode].lastHostActivity = Date.now();
    games[roomCode].buzzerLocked = false;
    broadcastState(roomCode);
  });

  // Register first buzz
  socket.on(EVENTS.BUZZ, ({ roomCode, teamName }) => {
    const game = games[roomCode];
    if (!game || game.buzzerLocked || game.blacklistedTeams.includes(teamName))
      return;
    game.buzzerLocked = true;
    game.activeTeamId = teamName;
    broadcastState(roomCode);
  });

  // Score validation
  socket.on(EVENTS.JUDGE_ANSWER, ({ roomCode, correct, teamName, points }) => {
    const game = games[roomCode];
    if (!game) return;
    if (game.hostSocketId === socket.id) game.lastHostActivity = Date.now();

    const isDaily = !!game.activeQuestion?.isDailyDouble;
    const resolvedTeam = teamName || (isDaily ? game.activeQuestion?.dailyDoubleTeam : game.activeTeamId);
    if (!resolvedTeam) return;

    const val = parseInt(points) || 0;

    // Prevent double-judging for Daily Double
    if (isDaily && game.activeQuestion?.judged) {
      return;
    }

    // Apply score change
    if (game.teams[resolvedTeam]) {
      game.teams[resolvedTeam].score += (correct ? val : -val);
    }

    if (isDaily) {
      // For Daily Double, reveal the answer and mark judged but do not clear the active question yet
      if (game.activeQuestion) {
        game.activeQuestion.revealed = true; // reveal answer
        game.activeQuestion.judged = true;
      }
      game.activeTeamId = null;
      game.buzzerLocked = true;
      // do not reset wager here; it will be reset when the host closes the question
    } else {
      // Reveal the question when a non-daily answer is judged correct
      if (correct && game.activeQuestion) {
        game.activeQuestion.revealed = true;
      }

      if (correct) {
        game.activeTeamId = null;
        game.buzzerLocked = true;
        game.blacklistedTeams = [];
      } else {
        game.blacklistedTeams.push(resolvedTeam);
        game.activeTeamId = null;
        game.buzzerLocked = false;
      }
    }

    broadcastState(roomCode);
  });

  // Handle wagers
  socket.on(EVENTS.SUBMIT_WAGER, ({ roomCode, teamName, wager }) => {
    const game = games[roomCode];
    if (game?.teams[teamName]) {
      if (game.hostSocketId === socket.id) game.lastHostActivity = Date.now();
      game.teams[teamName].wager = validateWager(game, teamName, wager);

      // keep buzzers locked during Daily Double when the chosen team wagers
      if (game.activeQuestion && game.activeQuestion.isDailyDouble && game.activeQuestion.dailyDoubleTeam === teamName) {
        game.buzzerLocked = true;
      }

      broadcastState(roomCode);
    }
  });

  // Final response storage
  socket.on(EVENTS.SUBMIT_FINAL_ANSWER, ({ roomCode, teamName, answer }) => {
    const game = games[roomCode];
    if (game?.teams[teamName]) {
      if (game.hostSocketId === socket.id) game.lastHostActivity = Date.now();
      game.teams[teamName].finalAnswer = answer;
      broadcastState(roomCode);
    }
  });
});

// Periodic cleanup of inactive rooms (destroy after host inactivity)
setInterval(() => {
  const now = Date.now();
  Object.keys(games).forEach((code) => {
    const g = games[code];
    if (!g || !g.lastHostActivity) return;
    if (now - g.lastHostActivity > ROOM_TTL_MS) {
      console.log(`Removing inactive room ${code} due to host inactivity`);
      // Notify clients in the room that state is gone and that the room has been closed
      try {
        io.to(code).emit(EVENTS.ROOM_CLOSED, { reason: 'host_inactive' });
        io.to(code).emit(EVENTS.STATE_UPDATE, null);
      } catch (e) {}
      delete games[code];
    }
  });
}, ROOM_CLEANUP_INTERVAL_MS);

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Studio active on port ${PORT}`));
