import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

// Main host component for managing game state and UI
export default function Host() {
  const { roomCode } = useParams();
  const [gameState, setGameState] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("setup"); // setup, lobby, board, question
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());

  useEffect(() => {
    socket.emit("join_room", { roomCode, teamName: "HOST" });
    socket.on("state_update", (state) => setGameState(state));
    return () => socket.off("state_update");
  }, [roomCode]);

  // Handle game file upload
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      setGameData(JSON.parse(event.target.result));
      setPhase("lobby");
    };
    reader.readAsText(file);
  };

  // Starts the game from the lobby
  const startGame = () => {
    setPhase("board");
  };

  // Handles selecting a question from the board
  const selectQuestion = (q, catIndex, qIndex) => {
    const id = `${catIndex}-${qIndex}`;
    setAnsweredQuestions(new Set([...answeredQuestions, id]));
    socket.emit("select_question", { roomCode, question: q });
    setPhase("question");
  };

  // Unlocks buzzers for players
  const unlockBuzzers = () => {
    socket.emit("unlock_buzzers", roomCode);
  };

  // Judges the buzzed team's answer
  const judgeAnswer = (isCorrect) => {
    if (!gameState || !gameState.activeQuestion || !gameState.activeTeamId)
      return;
    const points = gameState.activeQuestion.value;
    const teamName = gameState.activeTeamId;
    socket.emit("judge", { roomCode, teamName, isCorrect, points });
    if (isCorrect) {
      setPhase("board");
    }
  };

  // Go back to board (e.g. no one gets it)
  const backToBoard = () => {
    socket.emit("select_question", { roomCode, question: null });
    setPhase("board");
  };

  const startFinalJeopardy = () => {
    socket.emit("select_question", {
      roomCode,
      question: { ...gameData.finalJeopardy, isFinal: true },
    });
    setPhase("final_wager");
  };

  const judgeFinal = (teamName, isCorrect) => {
    const team = gameState.teams[teamName];
    if (!team) return;
    const points = team.wager || 0;
    socket.emit("judge", { roomCode, teamName, isCorrect, points });
  };

  if (phase === "setup") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-900 text-white">
        <h1 className="text-4xl font-bold mb-4">Host Setup</h1>
        <p className="mb-4">Upload your Jeopardy JSON file</p>
        <input
          type="file"
          accept=".json"
          onChange={handleFileUpload}
          className="mb-4"
        />
      </div>
    );
  }

  if (phase === "lobby") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-900 text-white">
        <h1 className="text-6xl font-bold text-yellow-400 mb-8">
          Room Code: {roomCode}
        </h1>
        <h2 className="text-2xl mb-4">Teams Joined:</h2>
        <ul className="mb-8 text-xl">
          {gameState &&
            gameState.teams &&
            Object.keys(gameState.teams)
              .filter((t) => t !== "HOST")
              .map((t) => <li key={t}>{t}</li>)}
        </ul>
        <button
          onClick={startGame}
          className="px-8 py-3 bg-green-600 rounded font-bold"
        >
          Start Game
        </button>
      </div>
    );
  }

  if (phase === "question" && gameState?.activeQuestion) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-900 text-white p-8 text-center">
        <h2 className="text-5xl font-bold mb-8">
          {gameState.activeQuestion.question}
        </h2>

        {!gameState.activeTeamId && gameState.buzzerLocked && (
          <button
            onClick={unlockBuzzers}
            className="px-8 py-4 bg-yellow-500 text-black rounded font-bold text-2xl mb-4"
          >
            Unlock Buzzers
          </button>
        )}

        {!gameState.activeTeamId && !gameState.buzzerLocked && (
          <p className="text-2xl text-yellow-400 animate-pulse">
            Waiting for buzzes...
          </p>
        )}

        {gameState.activeTeamId && (
          <div className="flex flex-col items-center mt-8">
            <h3 className="text-4xl text-green-400 mb-4">
              {gameState.activeTeamId} buzzed in!
            </h3>
            <p className="text-xl mb-4">
              Answer: {gameState.activeQuestion.answer}
            </p>
            <div className="flex space-x-4">
              <button
                onClick={() => judgeAnswer(true)}
                className="px-6 py-3 bg-green-600 rounded font-bold text-xl"
              >
                Correct
              </button>
              <button
                onClick={() => judgeAnswer(false)}
                className="px-6 py-3 bg-red-600 rounded font-bold text-xl"
              >
                Incorrect
              </button>
            </div>
          </div>
        )}

        <button
          onClick={backToBoard}
          className="mt-12 px-6 py-2 border border-white rounded"
        >
          Back to Board
        </button>
      </div>
    );
  }

  if (phase === "final_wager") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-900 text-white p-8">
        <h2 className="text-5xl font-bold mb-8">
          Final Jeopardy Category: {gameData.finalJeopardy.category}
        </h2>
        <p className="text-2xl mb-8">Waiting for teams to enter wagers...</p>
        <div className="flex space-x-4 mb-8">
          {Object.entries(gameState.teams)
            .filter(([t]) => t !== "HOST")
            .map(([team, data]) => (
              <div
                key={team}
                className={`p-4 rounded ${data.wager !== null ? "bg-green-600" : "bg-red-600"}`}
              >
                {team}: {data.wager !== null ? "Wagered" : "Waiting"}
              </div>
            ))}
        </div>
        <button
          onClick={() => setPhase("final_question")}
          className="px-8 py-4 bg-yellow-500 text-black rounded font-bold text-2xl"
        >
          Show Question
        </button>
      </div>
    );
  }

  if (phase === "final_question") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-blue-900 text-white p-8">
        <h2 className="text-5xl font-bold mb-8">
          {gameData.finalJeopardy.question}
        </h2>
        <div className="w-full max-w-4xl space-y-4">
          {Object.entries(gameState.teams)
            .filter(([t]) => t !== "HOST")
            .map(([team, data]) => (
              <div
                key={team}
                className="bg-blue-800 p-4 rounded flex justify-between items-center"
              >
                <div>
                  <span className="font-bold text-2xl">{team}</span> (Wager: $
                  {data.wager || 0})
                  <br />
                  <span className="text-xl">
                    Answer: {data.finalAnswer || "Waiting..."}
                  </span>
                </div>
                <div className="flex space-x-2">
                  <button
                    onClick={() => judgeFinal(team, true)}
                    className="px-4 py-2 bg-green-600 rounded font-bold"
                  >
                    Correct
                  </button>
                  <button
                    onClick={() => judgeFinal(team, false)}
                    className="px-4 py-2 bg-red-600 rounded font-bold"
                  >
                    Incorrect
                  </button>
                </div>
              </div>
            ))}
        </div>
        <div className="mt-8 text-2xl font-bold text-green-400">
          Correct Answer: {gameData.finalJeopardy.answer}
        </div>
      </div>
    );
  }

  if (!gameData) {
    return (
      <div className="min-h-screen bg-blue-900 text-white p-4">
        Loading game data...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-900 text-white p-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-yellow-400">Room: {roomCode}</h1>
        <div className="flex space-x-4">
          {gameState &&
            gameState.teams &&
            Object.entries(gameState.teams)
              .filter(([t]) => t !== "HOST")
              .map(([team, data]) => (
                <div key={team} className="bg-blue-800 px-4 py-2 rounded">
                  <span className="font-bold">{team}:</span> ${data.score}
                </div>
              ))}
        </div>
      </div>

      <div className="grid grid-cols-6 gap-2">
        {gameData.round1 &&
          gameData.round1.map((cat, cIdx) => (
            <div key={cIdx} className="flex flex-col space-y-2">
              <div className="bg-blue-800 h-24 flex items-center justify-center text-center font-bold text-xl uppercase border-2 border-black">
                {cat.category}
              </div>
              {cat.questions &&
                cat.questions.map((q, qIdx) => {
                  const isAnswered = answeredQuestions.has(`${cIdx}-${qIdx}`);
                  return (
                    <button
                      key={qIdx}
                      onClick={() =>
                        !isAnswered && selectQuestion(q, cIdx, qIdx)
                      }
                      className={`h-24 flex items-center justify-center text-4xl font-bold border-2 border-black ${isAnswered ? "bg-blue-900 text-blue-900 cursor-default" : "bg-blue-700 text-yellow-400 hover:bg-blue-600"}`}
                    >
                      {!isAnswered ? `$${q.value}` : ""}
                    </button>
                  );
                })}
            </div>
          ))}
      </div>
      <button
        onClick={startFinalJeopardy}
        className="mt-8 px-8 py-4 bg-purple-600 hover:bg-purple-500 rounded font-bold text-2xl w-full"
      >
        Start Final Jeopardy
      </button>
    </div>
  );
}
