import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

const createEmptyQuestion = (
  value,
  categoryIndex,
  questionIndex,
  roundLabel,
) => ({
  value,
  question: `Round ${roundLabel} Question ${questionIndex + 1} for Category ${categoryIndex + 1}`,
  answer: `Answer ${roundLabel}-${categoryIndex + 1}-${questionIndex + 1}`,
});

const createEmptyRound = (roundLabel, valueMultiplier) =>
  Array.from({ length: 6 }, (_, categoryIndex) => ({
    category: `Category ${categoryIndex + 1}`,
    questions: Array.from({ length: 5 }, (_, questionIndex) =>
      createEmptyQuestion(
        (questionIndex + 1) * 100 * valueMultiplier,
        categoryIndex,
        questionIndex,
        roundLabel,
      ),
    ),
  }));

const createEmptyGame = () => ({
  round1: createEmptyRound("1", 1),
  round2: createEmptyRound("2", 2),
  finalJeopardy: {
    category: "Final Category",
    question: "Final question",
    answer: "Final answer",
  },
});

export default function Host() {
  const { roomCode } = useParams();
  const [gameState, setGameState] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("setup");
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  const [builderData, setBuilderData] = useState(createEmptyGame());
  const rounds = [
    { key: "round1", title: "First Round" },
    { key: "round2", title: "Second Round" },
  ];

  useEffect(() => {
    socket.emit("join_room", { roomCode, teamName: "HOST" });
    socket.on("state_update", (state) => setGameState(state));
    return () => socket.off("state_update");
  }, [roomCode]);

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

  const updateCategory = (roundKey, categoryIndex, value) => {
    setBuilderData((prev) => ({
      ...prev,
      [roundKey]: prev[roundKey].map((cat, idx) =>
        idx === categoryIndex ? { ...cat, category: value } : cat,
      ),
    }));
  };

  const updateQuestion = (
    roundKey,
    categoryIndex,
    questionIndex,
    field,
    value,
  ) => {
    const nextValue = field === "value" ? Number(value) : value;
    setBuilderData((prev) => ({
      ...prev,
      [roundKey]: prev[roundKey].map((cat, cIdx) => {
        if (cIdx !== categoryIndex) return cat;
        return {
          ...cat,
          questions: cat.questions.map((q, qIdx) =>
            qIdx === questionIndex ? { ...q, [field]: nextValue } : q,
          ),
        };
      }),
    }));
  };

  const updateFinal = (field, value) => {
    setBuilderData((prev) => ({
      ...prev,
      finalJeopardy: { ...prev.finalJeopardy, [field]: value },
    }));
  };

  const downloadJson = () => {
    const data = JSON.stringify(builderData, null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "jeopardy-game.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const useBuilderData = () => {
    setGameData(builderData);
    setPhase("lobby");
  };

  const startGame = () => {
    setPhase("board");
  };

  const selectQuestion = (q, catIndex, qIndex) => {
    const id = `${catIndex}-${qIndex}`;
    setAnsweredQuestions(new Set([...answeredQuestions, id]));
    socket.emit("select_question", { roomCode, question: q });
    setPhase("question");
  };

  const unlockBuzzers = () => {
    socket.emit("unlock_buzzers", roomCode);
  };

  const judgeAnswer = (isCorrect) => {
    if (!gameState || !gameState.activeQuestion || !gameState.activeTeamId)
      return;
    const points = gameState.activeQuestion.value;
    const teamName = gameState.activeTeamId;
    socket.emit("judge", { roomCode, teamName, isCorrect, points });
    if (isCorrect) {
      setPhase("board");
    } else {
      socket.emit("unlock_buzzers", roomCode);
    }
  };

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
      <div className="min-h-screen bg-blue-900 text-white p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex flex-col items-center space-y-2">
            <h1 className="text-4xl font-bold">Host Setup</h1>
            <p className="text-blue-200">
              Upload an existing game or build one below
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-blue-800 p-4 rounded border border-blue-700">
              <h2 className="text-2xl font-semibold mb-2">Upload JSON</h2>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                className="mb-2"
              />
            </div>

            <div className="bg-blue-800 p-4 rounded border border-blue-700">
              <h2 className="text-2xl font-semibold mb-3">Build a Game</h2>
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={useBuilderData}
                  className="px-4 py-2 bg-green-600 rounded font-bold"
                >
                  Use in Session
                </button>
                <button
                  onClick={downloadJson}
                  className="px-4 py-2 bg-yellow-500 text-black rounded font-bold"
                >
                  Download JSON
                </button>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            {rounds.map((round) => (
              <div
                key={round.key}
                className="bg-blue-800 p-4 rounded border border-blue-700"
              >
                <h2 className="text-2xl font-semibold mb-4">{round.title}</h2>
                <div className="grid gap-4 lg:grid-cols-2">
                  {builderData[round.key].map((cat, cIdx) => (
                    <div
                      key={`${round.key}-${cIdx}`}
                      className="bg-blue-900/60 p-3 rounded border border-blue-700"
                    >
                      <input
                        value={cat.category}
                        onChange={(e) =>
                          updateCategory(round.key, cIdx, e.target.value)
                        }
                        placeholder={`Category ${cIdx + 1}`}
                        className="w-full text-black p-2 rounded font-bold"
                      />
                      <div className="mt-3 space-y-3">
                        {cat.questions.map((q, qIdx) => (
                          <div
                            key={`${round.key}-${cIdx}-${qIdx}`}
                            className="grid gap-2"
                          >
                            <div className="grid gap-2 md:grid-cols-3">
                              <input
                                type="number"
                                value={q.value}
                                onChange={(e) =>
                                  updateQuestion(
                                    round.key,
                                    cIdx,
                                    qIdx,
                                    "value",
                                    e.target.value,
                                  )
                                }
                                className="text-black p-2 rounded"
                                placeholder="Value"
                              />
                              <input
                                value={q.question}
                                onChange={(e) =>
                                  updateQuestion(
                                    round.key,
                                    cIdx,
                                    qIdx,
                                    "question",
                                    e.target.value,
                                  )
                                }
                                className="text-black p-2 rounded md:col-span-2"
                                placeholder={`Question ${qIdx + 1}`}
                              />
                            </div>
                            <input
                              value={q.answer}
                              onChange={(e) =>
                                updateQuestion(
                                  round.key,
                                  cIdx,
                                  qIdx,
                                  "answer",
                                  e.target.value,
                                )
                              }
                              className="text-black p-2 rounded"
                              placeholder="Answer"
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            <div className="bg-blue-800 p-4 rounded border border-blue-700">
              <h2 className="text-2xl font-semibold mb-4">Final Jeopardy</h2>
              <div className="grid gap-3 md:grid-cols-3">
                <input
                  value={builderData.finalJeopardy.category}
                  onChange={(e) => updateFinal("category", e.target.value)}
                  className="text-black p-2 rounded"
                  placeholder="Category"
                />
                <input
                  value={builderData.finalJeopardy.question}
                  onChange={(e) => updateFinal("question", e.target.value)}
                  className="text-black p-2 rounded md:col-span-2"
                  placeholder="Question"
                />
                <input
                  value={builderData.finalJeopardy.answer}
                  onChange={(e) => updateFinal("answer", e.target.value)}
                  className="text-black p-2 rounded md:col-span-3"
                  placeholder="Answer"
                />
              </div>
            </div>
          </div>
        </div>
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
