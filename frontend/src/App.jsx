import {
  BrowserRouter as Router,
  Routes,
  Route,
  useNavigate,
} from "react-router-dom";
import { useState } from "react";
import io from "socket.io-client";
import Host from "./Host";
import Player from "./Player";

const socket = io("http://localhost:3001");

function Home() {
  const navigate = useNavigate();
  const [roomCode, setRoomCode] = useState("");
  const [teamName, setTeamName] = useState("");

  const joinAsPlayer = () => {
    if (roomCode && teamName) {
      socket.emit("join_room", { roomCode, teamName });
      navigate(`/player/${roomCode}?team=${teamName}`);
    }
  };

  const createGame = () => {
    socket.emit("create_room");
    socket.once("room_created", (code) => {
      navigate(`/host/${code}`);
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-jeopardy-dark-blue p-4">
      <div className="absolute inset-0 overflow-hidden opacity-20 pointer-events-none">
        <div className="grid grid-cols-6 gap-2 rotate-12 scale-150">
          {[...Array(24)].map((_, i) => (
            <div
              key={i}
              className="h-32 border border-jeopardy-blue bg-blue-800/20"
            />
          ))}
        </div>
      </div>

      <div className="relative z-10 flex flex-col items-center w-full max-w-2xl">
        <div className="mb-12 text-center">
          <h1 className="text-8xl md:text-9xl font-korinna italic font-bold glitter-text tracking-tighter drop-shadow-2xl">
            JEOPARDY!
          </h1>
          <div className="h-1 w-full bg-jeopardy-gold mt-2 shadow-neon" />
        </div>

        <div className="grid md:grid-cols-2 gap-8 w-full">
          <div className="flex flex-col space-y-4 p-8 bg-black/40 border-2 border-jeopardy-blue backdrop-blur-sm rounded-sm">
            <h2 className="text-2xl text-jeopardy-gold font-korinna text-center">
              Executive Producer
            </h2>
            <button
              onClick={createGame}
              className="jeopardy-button h-16 text-xl shadow-heavy flex items-center justify-center"
            >
              Start New Show
            </button>
          </div>

          <div className="flex flex-col space-y-4 p-8 bg-black/40 border-2 border-jeopardy-blue backdrop-blur-sm rounded-sm">
            <h2 className="text-2xl text-jeopardy-gold font-korinna text-center">
              Contestant Entry
            </h2>
            <input
              className="jeopardy-input text-2xl h-14"
              placeholder="ROOM CODE"
              value={roomCode}
              onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
              maxLength={4}
            />
            <input
              className="jeopardy-input text-xl h-14"
              placeholder="TEAM NAME"
              value={teamName}
              onChange={(e) => setTeamName(e.target.value)}
            />
            <button
              onClick={joinAsPlayer}
              className="jeopardy-button bg-green-900/50 border-green-400 text-green-400 h-16 text-xl flex items-center justify-center"
            >
              Sign In
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/host/:roomCode" element={<Host />} />
        <Route path="/player/:roomCode" element={<Player />} />
      </Routes>
    </Router>
  );
}

export default App;
