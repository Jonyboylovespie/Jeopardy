import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import io from "socket.io-client";

const socket = io("http://localhost:3001");

const createEmptyQuestion = (val) => ({
  value: val,
  question: "",
  answer: "",
});

const createEmptyRound = () =>
  Array(6)
    .fill(null)
    .map(() => ({
      category: "",
      questions: [200, 400, 600, 800, 1000].map(createEmptyQuestion),
    }));

const createEmptyGame = () => ({
  round1: createEmptyRound(),
  round2: createEmptyRound(),
  finalJeopardy: { category: "", question: "", answer: "" },
});

const ROUND_KEYS = ["round1", "round2"];
const QUESTIONS_PER_ROUND = 30;

export default function Host() {
  const { roomCode } = useParams();
  const [gameState, setGameState] = useState(null);
  const [gameData, setGameData] = useState(null);
  const [phase, setPhase] = useState("setup");
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());
  const [builderData, setBuilderData] = useState(createEmptyGame());
  const [revealAnswer, setRevealAnswer] = useState(false);
  const [currentRoundKey, setCurrentRoundKey] = useState(ROUND_KEYS[0]);
  const [pendingQuestionId, setPendingQuestionId] = useState(null);
  const [finalJudgedTeams, setFinalJudgedTeams] = useState(new Set());

  useEffect(() => {
    socket.emit("join_room", { roomCode, teamName: "HOST" });
    socket.on("state_update", (state) => setGameState(state));
    return () => socket.off("state_update");
  }, [roomCode]);

  useEffect(() => {
    setRevealAnswer(false);
  }, [gameState?.activeQuestion?.question]);

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
    socket.emit("start_game", { roomCode, gameData: builderData });
    setGameData(builderData);
    setCurrentRoundKey(ROUND_KEYS[0]);
    setAnsweredQuestions(new Set());
    setFinalJudgedTeams(new Set());
    setRevealAnswer(false);
    setPhase("board");
  };

  const selectQuestion = (q, cIdx, qIdx) => {
    const id = `${currentRoundKey}-${cIdx}-${qIdx}`;
    setPendingQuestionId(id);
    socket.emit("select_question", {
      roomCode,
      question: q,
      id,
    });
    setPhase("question");
  };

  const judge = (correct) => {
    if (!gameState?.activeQuestion || !gameState?.activeTeamId) return;
    const val = parseInt(gameState.activeQuestion.value) || 0;
    const teamName = gameState.activeTeamId;
    socket.emit("judge_answer", {
      roomCode,
      correct,
      teamName,
      points: val,
    });
    setGameState((prev) => {
      if (!prev?.teams?.[teamName]) return prev;
      const nextScore = prev.teams[teamName].score + (correct ? val : -val);
      return {
        ...prev,
        teams: {
          ...prev.teams,
          [teamName]: { ...prev.teams[teamName], score: nextScore },
        },
        activeTeamId: null,
        activeQuestion: prev.activeQuestion,
        buzzerLocked: correct ? true : false,
        blacklistedTeams: correct ? [] : [...prev.blacklistedTeams, teamName],
      };
    });
    if (correct) {
      setRevealAnswer(true);
    } else {
      setRevealAnswer(false);
    }
  };

  const getTeamIds = () =>
    Object.keys(gameState?.teams || {}).filter((team) => team !== "HOST");

  const judgeFinal = (teamName, correct) => {
    const wager = gameState?.teams?.[teamName]?.wager || 0;
    socket.emit("judge_answer", {
      roomCode,
      correct,
      teamName,
      points: wager,
    });
    setGameState((prev) => {
      if (!prev?.teams?.[teamName]) return prev;
      const nextScore = prev.teams[teamName].score + (correct ? wager : -wager);
      return {
        ...prev,
        teams: {
          ...prev.teams,
          [teamName]: { ...prev.teams[teamName], score: nextScore },
        },
      };
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
              <span className="font-korinna text-2xl text-white">{team}</span>
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
                  <div className="text-2xl font-korinna text-white">{team}</div>
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
              const answered =
                answeredQuestions.has(id) ||
                gameState?.answeredQuestions?.includes(id);
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

  const renderQuestion = () => (
    <div className="min-h-screen bg-jeopardy-blue flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
      <h2 className="text-6xl font-korinna leading-tight max-w-5xl relative z-10 jeopardy-text-shadow">
        {gameState.activeQuestion.question}
      </h2>
      <div className="mt-16 w-full max-w-2xl relative z-10">
        {!gameState.activeTeamId ? (
          revealAnswer ? (
            <div className="bg-black/60 backdrop-blur-md p-8 border-4 border-jeopardy-gold rounded-sm">
              <h3 className="text-3xl text-jeopardy-gold font-korinna mb-2">
                Answer
              </h3>
              <p className="text-2xl mb-6 font-swiss italic text-white/80">
                "{gameState.activeQuestion.answer}"
              </p>
              <div className="text-xs text-jeopardy-blue uppercase tracking-widest">
                Press Close Question to continue
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="text-jeopardy-gold text-2xl font-bold animate-pulse-slow tracking-widest uppercase">
                {gameState.buzzerLocked
                  ? "Preparing Buzzers..."
                  : "Buzzers Active"}
              </div>
              {gameState.buzzerLocked && (
                <button
                  onClick={() => socket.emit("unlock_buzzers", roomCode)}
                  className="jeopardy-button h-20 w-80 text-2xl shadow-neon"
                >
                  Open Floor
                </button>
              )}
            </div>
          )
        ) : (
          <div className="bg-black/60 backdrop-blur-md p-8 border-4 border-jeopardy-gold rounded-sm">
            <h3 className="text-3xl text-jeopardy-gold font-korinna mb-2">
              Team: {gameState.activeTeamId}
            </h3>
            {revealAnswer && (
              <p className="text-2xl mb-8 font-swiss italic text-white/80">
                "{gameState.activeQuestion.answer}"
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => judge(true)}
                className="jeopardy-button bg-green-600 text-white border-green-400 h-16"
              >
                Correct
              </button>
              <button
                onClick={() => judge(false)}
                className="jeopardy-button bg-red-600 text-white border-red-400 h-16"
              >
                Incorrect
              </button>
            </div>
          </div>
        )}
      </div>
      <button
        onClick={() => {
          if (!revealAnswer) {
            setRevealAnswer(true);
            return;
          }
          const pendingId = pendingQuestionId;
          const alreadyCounted = pendingId
            ? answeredQuestions.has(pendingId)
            : false;
          const nextCount =
            answeredQuestions.size + (pendingId && !alreadyCounted ? 1 : 0);

          if (pendingId && !alreadyCounted) {
            setAnsweredQuestions((prev) => new Set([...prev, pendingId]));
          }
          setPendingQuestionId(null);

          if (
            currentRoundKey === "round1" &&
            nextCount >= QUESTIONS_PER_ROUND
          ) {
            socket.emit("select_question", {
              roomCode,
              question: null,
              id: null,
            });
            setCurrentRoundKey("round2");
            setAnsweredQuestions(new Set());
            setRevealAnswer(false);
            setGameState((prev) =>
              prev
                ? { ...prev, activeQuestion: null, activeTeamId: null }
                : prev,
            );
            setPhase("board");
            return;
          }

          if (
            currentRoundKey === "round2" &&
            nextCount >= QUESTIONS_PER_ROUND
          ) {
            const finalQuestion = {
              ...gameData.finalJeopardy,
              isFinal: true,
            };
            socket.emit("select_question", {
              roomCode,
              question: finalQuestion,
              id: null,
            });
            setFinalJudgedTeams(new Set());
            setGameState((prev) =>
              prev
                ? {
                    ...prev,
                    activeQuestion: finalQuestion,
                    activeTeamId: null,
                    buzzerLocked: true,
                  }
                : prev,
            );
            setRevealAnswer(false);
            setPhase("final_wager");
            return;
          }

          socket.emit("select_question", {
            roomCode,
            question: null,
            id: null,
          });
          setGameState((prev) =>
            prev ? { ...prev, activeQuestion: null, activeTeamId: null } : prev,
          );
          setPhase("board");
        }}
        className="absolute bottom-8 right-8 text-white/30 hover:text-white uppercase tracking-widest text-sm"
      >
        Close Question
      </button>
    </div>
  );

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
