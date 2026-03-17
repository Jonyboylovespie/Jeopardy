import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

// Main player component for the buzzer interface
export default function Player() {
  const { roomCode } = useParams();
  const location = useLocation();
  const teamName = new URLSearchParams(location.search).get("team");
  const [gameState, setGameState] = useState(null);
  const [wagerInput, setWagerInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");

  useEffect(() => {
    socket.emit("join_room", { roomCode, teamName });
    socket.on("state_update", (state) => setGameState(state));
    return () => socket.off("state_update");
  }, [roomCode, teamName]);

  const handleBuzz = () => {
    socket.emit("buzz", { roomCode, teamName });
  };

  const submitWager = () => {
    socket.emit("submit_wager", { roomCode, teamName, wager: wagerInput });
  };

  const submitAnswer = () => {
    socket.emit("submit_final_answer", {
      roomCode,
      teamName,
      answer: answerInput,
    });
  };

  if (!gameState) {
    return (
      <div className="min-h-screen bg-blue-900 text-white flex items-center justify-center">
        Loading...
      </div>
    );
  }

  const { activeQuestion, buzzerLocked, activeTeamId, blacklistedTeams } =
    gameState;
  const isBlacklisted = blacklistedTeams.includes(teamName);
  const teamState = gameState.teams[teamName] || {};

  if (activeQuestion && activeQuestion.isFinal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-900 text-white p-4 text-center">
        <h1 className="text-4xl font-bold text-yellow-400 mb-4">
          Final Jeopardy
        </h1>
        <h2 className="text-2xl mb-8">Score: ${teamState.score || 0}</h2>

        {teamState.wager === null || teamState.wager === undefined ? (
          <div className="flex flex-col items-center w-full max-w-md space-y-4">
            <p className="text-xl">Enter your wager:</p>
            <input
              type="number"
              value={wagerInput}
              onChange={(e) => setWagerInput(e.target.value)}
              className="text-black p-4 rounded w-full text-center font-bold text-2xl"
              placeholder="$0"
            />
            <button
              onClick={submitWager}
              className="px-8 py-4 bg-green-600 rounded font-bold text-xl w-full"
            >
              Lock Wager
            </button>
          </div>
        ) : teamState.finalAnswer === null ||
          teamState.finalAnswer === undefined ? (
          <div className="flex flex-col items-center w-full max-w-md space-y-4">
            <p className="text-xl">Enter your answer:</p>
            <input
              type="text"
              value={answerInput}
              onChange={(e) => setAnswerInput(e.target.value)}
              className="text-black p-4 rounded w-full text-center font-bold text-2xl"
              placeholder="Who/What is..."
            />
            <button
              onClick={submitAnswer}
              className="px-8 py-4 bg-green-600 rounded font-bold text-xl w-full"
            >
              Submit Answer
            </button>
          </div>
        ) : (
          <div className="text-3xl font-bold text-green-400 animate-pulse mt-8">
            Locked in! Look at the TV.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-blue-900 text-white p-4">
      <h1 className="text-3xl font-bold text-yellow-400 mb-2">
        Team: {teamName}
      </h1>
      <h2 className="text-xl mb-8">
        Score: ${gameState.teams[teamName]?.score || 0}
      </h2>

      {!activeQuestion ? (
        <div className="text-center text-2xl animate-pulse">
          Look at the TV! Waiting for host to select a question...
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-md">
          <p className="text-xl mb-8 text-center">{activeQuestion.question}</p>

          {activeTeamId ? (
            <div
              className={`text-3xl font-bold p-8 rounded-xl w-full text-center ${activeTeamId === teamName ? "bg-green-600" : "bg-red-600"}`}
            >
              {activeTeamId === teamName
                ? "YOU BUZZED IN!"
                : `${activeTeamId} BUZZED IN`}
            </div>
          ) : (
            <button
              onClick={handleBuzz}
              disabled={buzzerLocked || isBlacklisted}
              className={`w-64 h-64 rounded-full text-4xl font-bold shadow-2xl transition-all active:scale-95
                ${
                  buzzerLocked
                    ? "bg-gray-500 text-gray-300 cursor-not-allowed"
                    : isBlacklisted
                      ? "bg-red-900 text-gray-400 cursor-not-allowed"
                      : "bg-red-600 hover:bg-red-500 text-white shadow-[0_0_30px_rgba(220,38,38,0.6)]"
                }`}
            >
              {isBlacklisted ? "LOCKED OUT" : buzzerLocked ? "LOCKED" : "BUZZ"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
