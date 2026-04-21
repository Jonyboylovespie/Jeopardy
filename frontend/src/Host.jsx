import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import socket, { ensureSocketConnected } from "./socket";
import EVENTS from "./socketEvents";
import DailyDoublePanel from "./DailyDoublePanel";
import NormalQuestionPanel from "./NormalQuestionPanel";
import sampleGame from "../../sample_game.json";

const createEmptyQuestion = (val) => ({
  value: val,
  question: "",
  answer: "",
});

const createEmptyRound = (multiplier = 1) =>
  Array(6)
    .fill(null)
    .map(() => ({
      category: "",
      questions: [200, 400, 600, 800, 1000].map((val) =>
        createEmptyQuestion(val * multiplier),
      ),
    }));

const createEmptyGame = () => ({
  round1: createEmptyRound(1),
  round2: createEmptyRound(2),
  finalJeopardy: { category: "", question: "", answer: "" },
});

const ROUND_KEYS = ["round1", "round2"];
const QUESTIONS_PER_ROUND = 30;

export default function Host() {
  const { roomCode } = useParams();
  const [gameState, setGameState] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("setup");

  const [builderData, setBuilderData] = useState(() =>
    sampleGame ? JSON.parse(JSON.stringify(sampleGame)) : createEmptyGame(),
  );

  const [currentRoundKey, setCurrentRoundKey] = useState(ROUND_KEYS[0]);
  const [pendingQuestionId, setPendingQuestionId] = useState(null);
  const [finalJudgedTeams, setFinalJudgedTeams] = useState(new Set());

  const closeActiveQuestion = () => {
    const activeQ = gameState?.activeQuestion;
    if (!activeQ) return;
    if (!activeQ.revealed) {
      socket.emit(EVENTS.REVEAL_QUESTION, roomCode);
      return;
    }

    const nextCount = (gameState?.answeredQuestions || []).filter((id) => id.startsWith(currentRoundKey)).length;
    setPendingQuestionId(null);

    if (currentRoundKey === "round1" && nextCount >= QUESTIONS_PER_ROUND) {
      socket.emit(EVENTS.SELECT_QUESTION, { roomCode, question: null, id: null });
      setCurrentRoundKey("round2");
      setPhase("board");
      return;
    }

    if (currentRoundKey === "round2" && nextCount >= QUESTIONS_PER_ROUND) {
      const finalQuestion = { ...gameData.finalJeopardy, isFinal: true };
      socket.emit(EVENTS.SELECT_QUESTION, { roomCode, question: finalQuestion, id: null });
      setFinalJudgedTeams(new Set());
      setPhase("final_wager");
      return;
    }

    socket.emit(EVENTS.SELECT_QUESTION, { roomCode, question: null, id: null });
    setPhase("board");
  };

  const navigate = useNavigate();
  useEffect(() => {
    let cancelled = false;

    const onState = (state) => setGameState(state);
    const onClosed = () => navigate("/");

    socket.on(EVENTS.STATE_UPDATE, onState);
    socket.on(EVENTS.ROOM_CLOSED, onClosed);

    ensureSocketConnected()
      .then(() => {
        if (cancelled) return;
        socket.emit(EVENTS.JOIN_ROOM, { roomCode, teamName: "HOST" });
      })
      .catch(() => {
        if (!cancelled) {
          navigate("/");
        }
      });

    return () => {
      cancelled = true;
      socket.off(EVENTS.STATE_UPDATE, onState);
      socket.off(EVENTS.ROOM_CLOSED, onClosed);
    };
  }, [roomCode, navigate]);





  const handleFileUpload = (e) => {
    const reader = new FileReader();
    reader.onload = (event) => setBuilderData(JSON.parse(event.target.result));
    reader.readAsText(e.target.files[0]);
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

  const updateCategory = (round, cIdx, val) => {
    const next = { ...builderData };
    next[round][cIdx].category = val;
    setBuilderData(next);
  };

  const updateQuestion = (round, cIdx, qIdx, field, val) => {
    const next = { ...builderData };
    next[round][cIdx].questions[qIdx][field] = val;
    setBuilderData(next);
  };

  const updateFinal = (field, val) => {
    const next = { ...builderData };
    next.finalJeopardy[field] = val;
    setBuilderData(next);
  };

  const startGame = () => {
    socket.emit(EVENTS.START_GAME, { roomCode, gameData: builderData });
    setGameData(builderData);
    setCurrentRoundKey(ROUND_KEYS[0]);
    setFinalJudgedTeams(new Set());
    setPhase("board");
  };

  const selectQuestion = (q, cIdx, qIdx) => {
    const id = `${currentRoundKey}-${cIdx}-${qIdx}`;
    setPendingQuestionId(id);
    socket.emit(EVENTS.SELECT_QUESTION, {
      roomCode,
      question: q,
      id,
    });
    setPhase("question");
  };

  const judge = (correct) => {
    if (!gameState?.activeQuestion) return;
    const isDaily = !!gameState.activeQuestion?.isDailyDouble;
    const resolvedTeam = isDaily ? gameState.activeQuestion?.dailyDoubleTeam : gameState.activeTeamId;
    if (!resolvedTeam) return;
    const points = isDaily ? (gameState?.teams?.[resolvedTeam]?.wager || 0) : (parseInt(gameState.activeQuestion.value) || 0);

    // Tell server to apply the score
    socket.emit(EVENTS.JUDGE_ANSWER, {
      roomCode,
      correct,
      teamName: resolvedTeam,
      points,
    });

    // Do not close Daily Double here - server will reveal the answer and host should close afterwards
  };

  const assignDailyDouble = (team) => {
    if (!pendingQuestionId) return;
    socket.emit(EVENTS.ASSIGN_DAILY_DOUBLE, { roomCode, id: pendingQuestionId, teamName: team });
  };

  const getTeamIds = () =>
    Object.keys(gameState?.teams || {}).filter((team) => team !== "HOST");

  const judgeFinal = (teamName, correct) => {
    const wager = gameState?.teams?.[teamName]?.wager || 0;
    socket.emit(EVENTS.JUDGE_ANSWER, {
      roomCode,
      correct,
      teamName,
      points: wager,
    });

    setFinalJudgedTeams((prev) => new Set([...prev, teamName]));
  };

  const renderFinalWager = () => {
    const teams = getTeamIds();
    const allWagersIn = teams.every(
      (team) => gameState?.teams?.[team]?.wager !== null,
    );
    return (
      <div className="min-h-screen bg-jeopardy-dark-blue p-8 flex flex-col items-center justify-center text-center">
        <h2 className="text-5xl font-korinna text-jeopardy-gold mb-4">
          Final Jeopardy
        </h2>
        <div className="text-2xl text-jeopardy-blue mb-8 uppercase tracking-widest">
          Category: {gameData.finalJeopardy.category}
        </div>
        <div className="grid gap-4 w-full max-w-3xl">
          {teams.map((team) => (
            <div
              key={team}
              className="bg-black/40 border border-jeopardy-blue p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <span className="font-korinna text-2xl text-white">{team}</span>
                <span className="text-2xl font-korinna text-jeopardy-gold">${gameState?.teams?.[team]?.score || 0}</span>
              </div>
              <span
                className={`text-sm uppercase tracking-widest ${
                  gameState?.teams?.[team]?.wager !== null
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                {gameState?.teams?.[team]?.wager !== null
                  ? "Wager Locked"
                  : "Waiting"}
              </span>
            </div>
          ))}
        </div>
        <button
          onClick={() => setPhase("final_question")}
          className="jeopardy-button mt-10 h-16 text-xl"
          disabled={!allWagersIn}
        >
          Reveal Question
        </button>
      </div>
    );
  };

  const renderFinalQuestion = () => {
    const teams = getTeamIds();
    const allJudged =
      finalJudgedTeams.size === teams.length && teams.length > 0;
    const allFinalAnswersIn =
      teams.length > 0 &&
      teams.every((team) => {
        const answer = gameState?.teams?.[team]?.finalAnswer;
        return answer !== null && answer !== undefined;
      });
    return (
      <div className="min-h-screen bg-jeopardy-blue p-8 text-center">
        <h2 className="text-5xl font-korinna text-jeopardy-gold mb-6">
          Final Jeopardy
        </h2>
        <div className="text-3xl font-korinna mb-10">
          {gameData.finalJeopardy.question}
        </div>
        <div className="grid gap-4 max-w-4xl mx-auto">
          {teams.map((team) => {
            const teamData = gameState?.teams?.[team];
            const judged = finalJudgedTeams.has(team);
            return (
              <div
                key={team}
                className="bg-black/60 border border-jeopardy-blue p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4"
              >
                <div className="text-left">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-korinna text-white">{team}</div>
                    <div className="text-2xl font-korinna text-jeopardy-gold">${teamData?.score || 0}</div>
                  </div>
                  <div className="text-sm text-jeopardy-blue uppercase tracking-widest">
                    Wager: ${teamData?.wager || 0}
                  </div>
                  <div className="text-lg text-jeopardy-gold">
                    {allFinalAnswersIn
                      ? teamData?.finalAnswer || "No response"
                      : teamData?.finalAnswer
                        ? "Locked in"
                        : "Waiting for response..."}
                  </div>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => judgeFinal(team, true)}
                    className="jeopardy-button bg-green-600 text-white border-green-400 h-12"
                    disabled={
                      judged || !allFinalAnswersIn || !teamData?.finalAnswer
                    }
                  >
                    Correct
                  </button>
                  <button
                    onClick={() => judgeFinal(team, false)}
                    className="jeopardy-button bg-red-600 text-white border-red-400 h-12"
                    disabled={
                      judged || !allFinalAnswersIn || !teamData?.finalAnswer
                    }
                  >
                    Incorrect
                  </button>
                </div>
              </div>
            );
          })}
        </div>
        {allJudged && (
          <div className="mt-8 text-xl text-green-400 font-korinna">
            Correct Answer: {gameData.finalJeopardy.answer}
          </div>
        )}
        {allJudged && (
          <button
            onClick={() => setPhase("final_leaderboard")}
            className="jeopardy-button mt-10 h-16 text-xl mx-auto"
          >
            Show Final Leaderboard
          </button>
        )}
      </div>
    );
  };

  const renderFinalLeaderboard = () => {
    const teams = getTeamIds()
      .map((team) => ({
        team,
        score: gameState?.teams?.[team]?.score || 0,
      }))
      .sort((a, b) => b.score - a.score);
    return (
      <div className="min-h-screen bg-jeopardy-dark-blue p-8 flex flex-col items-center justify-center text-center">
        <h2 className="text-5xl font-korinna text-jeopardy-gold mb-10">
          Final Leaderboard
        </h2>
        <div className="grid gap-4 w-full max-w-2xl">
          {teams.map((t, idx) => (
            <div
              key={t.team}
              className="bg-black/50 border border-jeopardy-blue p-5 flex items-center justify-between"
            >
              <span className="text-xl text-jeopardy-blue font-bold">
                #{idx + 1}
              </span>
              <span className="text-3xl font-korinna text-white">{t.team}</span>
              <span className="text-3xl font-korinna text-jeopardy-gold">
                ${t.score}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderSetup = () => (
    <div className="min-h-screen bg-jeopardy-dark-blue p-8 font-swiss">
      <div className="max-w-6xl mx-auto">
        <header className="flex justify-between items-center mb-12 border-b-4 border-jeopardy-gold pb-4">
          <h1 className="text-5xl font-korinna glitter-text">
            Production Studio
          </h1>
          <div className="flex gap-4">
            <input
              type="file"
              onChange={handleFileUpload}
              className="hidden"
              id="upload"
            />
            <label htmlFor="upload" className="jeopardy-button cursor-pointer">
              Load Script
            </label>
            <button
              onClick={downloadJson}
              className="jeopardy-button border-blue-400 flex items-center justify-center"
            >
              Save JSON
            </button>
            <button
              onClick={startGame}
              className="jeopardy-button bg-green-700 text-white border-green-400"
            >
              On Air
            </button>
          </div>
        </header>
        <div className="grid grid-cols-1 gap-12">
          {["round1", "round2"].map((rk) => (
            <div
              key={rk}
              className="bg-black/30 p-6 rounded border-2 border-jeopardy-blue"
            >
              <h2 className="text-3xl font-korinna text-jeopardy-gold mb-6 uppercase">
                {rk === "round1" ? "Jeopardy! Round" : "Double Jeopardy!"}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-2">
                {builderData[rk].map((cat, cIdx) => (
                  <div
                    key={cIdx}
                    className="bg-black/20 p-2 border border-jeopardy-blue/30 flex flex-col gap-2"
                  >
                    <div className="h-12 flex items-center">
                      <input
                        className="jeopardy-input w-full border-jeopardy-gold text-[11px] py-1 h-full px-1"
                        value={cat.category}
                        onChange={(e) =>
                          updateCategory(rk, cIdx, e.target.value)
                        }
                        placeholder="CATEGORY"
                      />
                    </div>
                    <div className="flex flex-col gap-3">
                      {cat.questions.map((q, qIdx) => (
                        <div key={qIdx} className="flex flex-col gap-1">
                          <div className="flex items-center gap-1">
                            <span className="w-8 text-jeopardy-gold font-bold text-[9px] shrink-0 text-right">
                              ${q.value}
                            </span>
                            <textarea
                              className="jeopardy-input flex-1 text-[10px] h-10 text-left p-1 resize-none overflow-hidden"
                              value={q.question}
                              onChange={(e) =>
                                updateQuestion(
                                  rk,
                                  cIdx,
                                  qIdx,
                                  "question",
                                  e.target.value,
                                )
                              }
                              placeholder="Question"
                            />
                          </div>
                          <div className="flex items-center gap-1 pl-9">
                            <input
                              className="jeopardy-input flex-1 text-[9px] h-6 text-left px-1 border-green-900/50 text-green-400"
                              value={q.answer}
                              onChange={(e) =>
                                updateQuestion(
                                  rk,
                                  cIdx,
                                  qIdx,
                                  "answer",
                                  e.target.value,
                                )
                              }
                              placeholder="Answer"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="bg-black/30 p-6 rounded border-2 border-purple-900/50">
            <h2 className="text-3xl font-korinna text-purple-400 mb-6 uppercase">
              Final Jeopardy
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-purple-400 uppercase font-bold">
                  Category
                </span>
                <input
                  className="jeopardy-input w-full border-purple-400 h-14"
                  value={builderData.finalJeopardy.category}
                  onChange={(e) => updateFinal("category", e.target.value)}
                  placeholder="FINAL CATEGORY"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-purple-400 uppercase font-bold">
                  Question
                </span>
                <textarea
                  className="jeopardy-input w-full border-purple-400 h-24 text-left p-3 resize-none"
                  value={builderData.finalJeopardy.question}
                  onChange={(e) => updateFinal("question", e.target.value)}
                  placeholder="FINAL QUESTION"
                />
              </div>
              <div className="flex flex-col gap-2">
                <span className="text-[10px] text-green-400 uppercase font-bold">
                  Correct Answer
                </span>
                <input
                  className="jeopardy-input w-full border-green-600 text-green-400 h-14"
                  value={builderData.finalJeopardy.answer}
                  onChange={(e) => updateFinal("answer", e.target.value)}
                  placeholder="FINAL ANSWER"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderBoard = () => (
    <div className="min-h-screen bg-jeopardy-dark-blue p-6 flex flex-col">
      <div className="flex justify-between items-end mb-6">
        <h2 className="text-4xl font-korinna text-jeopardy-gold">
          Room: {roomCode}
        </h2>
        <div className="flex gap-4">
          {Object.entries(gameState?.teams || {})
            .filter(([n]) => n !== "HOST")
            .map(([name, data]) => (
              <div
                key={name}
                className="bg-black border-2 border-jeopardy-blue px-6 py-2 text-center"
              >
                <div className="text-xs text-jeopardy-blue font-bold uppercase">
                  {name}
                </div>
                <div className="text-2xl font-korinna text-white">
                  ${data.score}
                </div>
              </div>
            ))}
        </div>
      </div>
      <div className="grid grid-cols-6 gap-3 flex-1">
        {(gameData[currentRoundKey] || []).map((cat, cIdx) => (
          <div key={cIdx} className="flex flex-col gap-3">
            <div className="jeopardy-card h-28 text-white font-korinna text-xl font-bold shadow-heavy border-jeopardy-blue uppercase leading-tight">
              {cat.category}
            </div>
            {cat.questions.map((q, qIdx) => {
              const id = `${currentRoundKey}-${cIdx}-${qIdx}`;
              const answered = (gameState?.answeredQuestions || []).includes(id);
              return (
                <button
                  key={qIdx}
                  disabled={answered}
                  onClick={() => selectQuestion(q, cIdx, qIdx)}
                  className={`flex-1 jeopardy-card text-5xl font-korinna text-jeopardy-gold transition-all
                    ${
                      answered
                        ? "opacity-0 cursor-default"
                        : "hover:scale-105 hover:z-10 hover:border-white"
                    }`}
                >
                  {!answered && `$${q.value}`}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );

  const renderQuestion = () => {
    const activeQ = gameState?.activeQuestion;
    if (!activeQ) return null;

    if (activeQ.isDailyDouble) {
      return (
        <DailyDoublePanel
          activeQ={activeQ}
          gameState={gameState}
          assignDailyDouble={assignDailyDouble}
          getTeamIds={getTeamIds}
          judge={judge}
          closeActiveQuestion={closeActiveQuestion}
        />
      );
    }

    return (
      <NormalQuestionPanel
        activeQ={activeQ}
        gameState={gameState}
        judge={judge}
        socket={socket}
        roomCode={roomCode}
        closeActiveQuestion={closeActiveQuestion}
      />
    );
  }

  if (phase === "setup") return renderSetup();
  if (phase === "final_wager") return renderFinalWager();
  if (phase === "final_question") return renderFinalQuestion();
  if (phase === "final_leaderboard") return renderFinalLeaderboard();
  if (phase === "question" && gameState?.activeQuestion)
    return renderQuestion();
  if (gameData) return renderBoard();
  return (
    <div className="min-h-screen bg-jeopardy-dark-blue flex items-center justify-center font-korinna text-4xl text-jeopardy-gold">
      Loading...
    </div>
  );
}
