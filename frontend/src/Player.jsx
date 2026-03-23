import { useState, useEffect } from "react";
import { useParams, useLocation } from "react-router-dom";
import socket from "./socket";
import EVENTS from "./socketEvents";

export default function Player() {
  const { roomCode } = useParams();
  const location = useLocation();
  const teamName = new URLSearchParams(location.search).get("team");
  const [gameState, setGameState] = useState(null);
  const [wagerInput, setWagerInput] = useState("");
  const [answerInput, setAnswerInput] = useState("");

  useEffect(() => {
    socket.emit(EVENTS.JOIN_ROOM, { roomCode, teamName });
    socket.on(EVENTS.STATE_UPDATE, (state) => setGameState(state));
    return () => socket.off(EVENTS.STATE_UPDATE);
  }, [roomCode, teamName]);

  const handleBuzz = () => {
    socket.emit(EVENTS.BUZZ, { roomCode, teamName });
  };

  const submitWager = () => {
    socket.emit(EVENTS.SUBMIT_WAGER, { roomCode, teamName, wager: wagerInput });
    setWagerInput("")
  };

  const submitAnswer = () => {
    socket.emit(EVENTS.SUBMIT_FINAL_ANSWER, {
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
  const teamState = gameState.teams[teamName] || {};

  if (activeQuestion && activeQuestion.isDailyDouble) {
    const ddTeam = activeQuestion.dailyDoubleTeam;
    // Chosen team: allow wager + answer like Final Jeopardy
    if (teamName === ddTeam) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center">
          <div className="bg-blue-900 w-full max-w-2xl p-8 rounded-xl border-4 border-white shadow-[0_0_30px_rgba(0,0,255,0.5)]">
            <h1
              className="text-5xl font-extrabold text-yellow-400 mb-6 uppercase tracking-widest"
              style={{ textShadow: "3px 3px 6px #000" }}
            >
              Daily Double
            </h1>
            <h2
              className={`text-3xl font-bold mb-8 ${
                teamState.score < 0 ? "text-red-400" : "text-green-400"
              }`}
              style={{ textShadow: "2px 2px 4px #000" }}
            >
              Score: ${teamState.score || 0}
            </h2>

            {teamState.wager === null || teamState.wager === undefined ? (
              <div className="flex flex-col items-center w-full space-y-6">
                <p className="text-2xl font-bold uppercase tracking-wide">
                  Enter your wager:
                </p>
                <input
                  type="number"
                  value={wagerInput}
                  onChange={(e) => setWagerInput(e.target.value)}
                  className="bg-blue-800 text-yellow-400 border-4 border-yellow-400 p-4 rounded w-full text-center font-extrabold text-4xl shadow-inner outline-none focus:border-white"
                  placeholder="$0"
                />
                <button
                  onClick={submitWager}
                  className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black border-2 border-white rounded font-extrabold text-2xl w-full uppercase tracking-widest transition-transform active:scale-95 shadow-lg"
                >
                  Lock Wager
                </button>
              </div>
            ) : (
              <div
                className="text-4xl font-extrabold text-green-400 animate-pulse mt-8 uppercase tracking-widest"
                style={{ textShadow: "2px 2px 4px #000" }}
              >
                Locked in! Look at the TV.
              </div>
            )}
          </div>
        </div>
      );
    }

    // Other teams: waiting view
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center text-center p-6">
        <div>
          <h1 className="text-4xl font-bold text-yellow-400 mb-4">Daily Double</h1>
          <p className="text-xl">Team {ddTeam} is submitting a wager...</p>
        </div>
      </div>
    );
  }

  if (activeQuestion && activeQuestion.isFinal) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-black text-white p-6 text-center">
        <div className="bg-blue-900 w-full max-w-2xl p-8 rounded-xl border-4 border-white shadow-[0_0_30px_rgba(0,0,255,0.5)]">
          <h1
            className="text-5xl font-extrabold text-yellow-400 mb-6 uppercase tracking-widest"
            style={{ textShadow: "3px 3px 6px #000" }}
          >
            Final Jeopardy
          </h1>
          <h2
            className={`text-3xl font-bold mb-8 ${
              teamState.score < 0 ? "text-red-400" : "text-green-400"
            }`}
            style={{ textShadow: "2px 2px 4px #000" }}
          >
            Score: ${teamState.score || 0}
          </h2>

          {teamState.wager === null || teamState.wager === undefined ? (
            <div className="flex flex-col items-center w-full space-y-6">
              <p className="text-2xl font-bold uppercase tracking-wide">
                Enter your wager:
              </p>
              <input
                type="number"
                value={wagerInput}
                onChange={(e) => setWagerInput(e.target.value)}
                className="bg-blue-800 text-yellow-400 border-4 border-yellow-400 p-4 rounded w-full text-center font-extrabold text-4xl shadow-inner outline-none focus:border-white"
                placeholder="$0"
              />
              <button
                onClick={submitWager}
                className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black border-2 border-white rounded font-extrabold text-2xl w-full uppercase tracking-widest transition-transform active:scale-95 shadow-lg"
              >
                Lock Wager
              </button>
            </div>
          ) : teamState.finalAnswer === null ||
            teamState.finalAnswer === undefined ? (
            <div className="flex flex-col items-center w-full space-y-6">
              <p className="text-2xl font-bold uppercase tracking-wide">
                Enter your answer:
              </p>
              <input
                type="text"
                value={answerInput}
                onChange={(e) => setAnswerInput(e.target.value)}
                className="bg-blue-800 text-white border-4 border-white p-4 rounded w-full text-center font-extrabold text-4xl shadow-inner outline-none focus:border-yellow-400"
                placeholder="Who/What is..."
              />
              <button
                onClick={submitAnswer}
                className="px-8 py-4 bg-yellow-500 hover:bg-yellow-400 text-black border-2 border-white rounded font-extrabold text-2xl w-full uppercase tracking-widest transition-transform active:scale-95 shadow-lg"
              >
                Submit Answer
              </button>
            </div>
          ) : (
            <div
              className="text-4xl font-extrabold text-green-400 animate-pulse mt-8 uppercase tracking-widest"
              style={{ textShadow: "2px 2px 4px #000" }}
            >
              Locked in! Look at the TV.
            </div>
          )}
        </div>
      </div>
    );
  }

  const teamScore = gameState.teams[teamName]?.score || 0;

  return (
    <div className="flex flex-col items-center min-h-screen bg-black text-white p-6">
      <div className="w-full max-w-md bg-blue-900 rounded-b-3xl border-b-4 border-x-4 border-blue-700 shadow-2xl p-6 flex flex-col items-center mb-12">
        <h1
          className="text-4xl font-extrabold text-yellow-400 mb-2 uppercase tracking-widest"
          style={{ textShadow: "3px 3px 6px #000" }}
        >
          {teamName}
        </h1>
        <h2
          className={`text-3xl font-bold ${
            teamScore < 0 ? "text-red-400" : "text-green-400"
          }`}
          style={{ textShadow: "2px 2px 4px #000" }}
        >
          ${teamScore}
        </h2>
      </div>

      <div className="flex-grow flex flex-col items-center justify-center w-full max-w-md">
        <div className="flex flex-col items-center w-full">
          {activeTeamId ? (
            <div
              className={`text-4xl font-extrabold p-8 rounded-2xl w-full text-center uppercase tracking-widest shadow-[inset_0_0_20px_rgba(0,0,0,0.5)] border-4 ${
                activeTeamId === teamName
                  ? "bg-green-600 border-green-400 text-white"
                  : "bg-red-700 border-red-500 text-red-200"
              }`}
              style={{ textShadow: "2px 2px 4px #000" }}
            >
              {activeTeamId === teamName
                ? "YOU BUZZED IN!"
                : `${activeTeamId} BUZZED`}
            </div>
          ) : (
            <button
              onClick={handleBuzz}
              disabled={!activeQuestion || buzzerLocked || isBlacklisted}
              className={`w-72 h-72 rounded-full text-5xl font-extrabold uppercase tracking-widest transition-all duration-75 outline-none
                ${
                  isBlacklisted
                    ? "bg-red-900 text-red-950 border-8 border-red-950 shadow-[0_10px_0_#450a0a,0_15px_20px_rgba(0,0,0,0.5)] cursor-not-allowed"
                    : !activeQuestion || buzzerLocked
                      ? "bg-gray-600 text-gray-400 border-8 border-gray-700 shadow-[0_10px_0_#374151,0_15px_20px_rgba(0,0,0,0.5)] cursor-not-allowed"
                      : "bg-red-500 text-white border-8 border-red-700 shadow-[0_15px_0_#991b1b,0_25px_30px_rgba(0,0,0,0.7)] hover:bg-red-400 active:translate-y-[15px] active:shadow-[0_0_0_#991b1b,0_0_0_rgba(0,0,0,0.7)] active:bg-red-600"
                }`}
              style={{
                textShadow:
                  !activeQuestion || buzzerLocked || isBlacklisted
                    ? "none"
                    : "2px 2px 4px #000",
              }}
            >
              {isBlacklisted
                ? "OUT"
                : !activeQuestion
                  ? "WAIT"
                  : buzzerLocked
                    ? "LOCKED"
                    : "BUZZ"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
