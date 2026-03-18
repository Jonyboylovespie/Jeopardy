import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

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
      <div className="min-h-screen bg-jeopardy-dark-blue flex items-center justify-center font-korinna text-2xl text-jeopardy-gold">
        Connecting to Studio...
      </div>
    );
  }

  const { activeQuestion, buzzerLocked, activeTeamId, blacklistedTeams } =
    gameState;
  const isBlacklisted = blacklistedTeams?.includes(teamName);
  const effectiveActiveTeamId = buzzerLocked ? activeTeamId : null;
  const teamState = gameState.teams[teamName] || {};

  const renderFinal = () => (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
      <h1 className="text-5xl font-korinna glitter-text mb-2">
        Final Jeopardy
      </h1>
      <div className="text-2xl text-jeopardy-gold mb-12 font-bold tracking-widest">
        ${teamState.score || 0}
      </div>
      {teamState.wager === null || teamState.wager === undefined ? (
        <div className="w-full max-w-sm space-y-6">
          <input
            type="number"
            value={wagerInput}
            onChange={(e) => setWagerInput(e.target.value)}
            className="jeopardy-input w-full text-4xl h-20"
            placeholder="WAGER"
          />
          <button
            onClick={submitWager}
            className="jeopardy-button w-full h-16 text-xl shadow-neon"
          >
            Lock Wager
          </button>
        </div>
      ) : teamState.finalAnswer === null ||
        teamState.finalAnswer === undefined ? (
        <div className="w-full max-w-sm space-y-6">
          <input
            type="text"
            value={answerInput}
            onChange={(e) => setAnswerInput(e.target.value)}
            className="jeopardy-input w-full text-2xl h-20"
            placeholder="RESPONSE"
          />
          <button
            onClick={submitAnswer}
            className="jeopardy-button w-full h-16 text-xl shadow-neon"
          >
            Submit Response
          </button>
        </div>
      ) : (
        <div className="text-4xl font-korinna text-green-400 animate-pulse-slow">
          Response Locked
        </div>
      )}
    </div>
  );

  if (activeQuestion?.isFinal) return renderFinal();

  return (
    <div className="flex flex-col items-center justify-between min-h-screen bg-jeopardy-dark-blue p-8">
      <div className="w-full flex justify-between items-start">
        <div className="text-left">
          <div className="text-xs text-jeopardy-blue font-bold uppercase tracking-widest">
            Team
          </div>
          <div className="text-3xl font-korinna text-white">{teamName}</div>
        </div>
        <div className="text-right">
          <div className="text-xs text-jeopardy-blue font-bold uppercase tracking-widest">
            Current Score
          </div>
          <div className="text-3xl font-korinna text-jeopardy-gold">
            ${teamState.score || 0}
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center w-full max-w-md">
        {!activeQuestion ? (
          <div className="text-center">
            <div className="text-6xl mb-4">📺</div>
            <p className="text-jeopardy-blue font-bold uppercase tracking-tighter animate-pulse-slow text-xl">
              Eyes on the Board
            </p>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center">
            {effectiveActiveTeamId ? (
              <div
                className={`w-full p-12 rounded-sm border-4 text-center transition-all ${
                  effectiveActiveTeamId === teamName
                    ? "bg-green-600 border-white shadow-neon"
                    : "bg-red-900/50 border-red-800"
                }`}
              >
                <div className="text-xl font-bold uppercase mb-2">
                  {effectiveActiveTeamId === teamName
                    ? "You Are"
                    : effectiveActiveTeamId}
                </div>
                <div className="text-4xl font-korinna">Buzzed In</div>
              </div>
            ) : (
              <button
                onClick={handleBuzz}
                disabled={buzzerLocked || isBlacklisted}
                className={`w-72 h-72 rounded-full border-8 text-5xl font-korinna transition-all active:scale-90 shadow-heavy
                  ${
                    buzzerLocked
                      ? "bg-gray-800 border-gray-900 text-gray-600"
                      : isBlacklisted
                        ? "bg-red-950 border-black text-red-900"
                        : "bg-red-600 border-red-400 text-white hover:bg-red-500 hover:shadow-neon"
                  }`}
              >
                {isBlacklisted ? "LOCKED" : buzzerLocked ? "WAIT" : "BUZZ"}
              </button>
            )}
          </div>
        )}
      </div>

      <div className="text-jeopardy-blue text-xs font-bold tracking-widest uppercase">
        Studio Room: {roomCode}
      </div>
    </div>
  );
}
