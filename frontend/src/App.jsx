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

// Home screen for selecting host or player mode
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
    <div className="flex flex-col items-center justify-center min-h-screen space-y-6 text-white bg-blue-900">
      <h1 className="text-6xl font-bold text-yellow-400 drop-shadow-md">
        JEOPARDY!
      </h1>
      <button
        onClick={createGame}
        className="px-8 py-3 bg-blue-600 hover:bg-blue-500 rounded font-bold shadow-lg"
      >
        Host a Game
      </button>

      <div className="flex flex-col items-center space-y-3 pt-8 border-t border-blue-500">
        <h2 className="text-2xl font-semibold">Join a Game</h2>
        <input
          className="text-black p-2 rounded w-64 text-center uppercase font-bold"
          placeholder="ROOM CODE"
          value={roomCode}
          onChange={(e) => setRoomCode(e.target.value)}
          maxLength={4}
        />
        <input
          className="text-black p-2 rounded w-64 text-center font-bold"
          placeholder="TEAM NAME"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
        />
        <button
          onClick={joinAsPlayer}
          className="px-8 py-2 bg-green-600 hover:bg-green-500 rounded font-bold shadow-lg w-64"
        >
          Join
        </button>
      </div>
    </div>
  );
}

// Main application routing component
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
