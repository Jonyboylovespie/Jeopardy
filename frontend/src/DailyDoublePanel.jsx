import React from "react";

export default function DailyDoublePanel({
  activeQ,
  gameState,
  assignDailyDouble,
  getTeamIds,
  judge,
  closeActiveQuestion,
}) {
  const chosen = activeQ.dailyDoubleTeam;
  const teams = getTeamIds();
  const chosenTeamData = chosen ? gameState?.teams?.[chosen] : null;
  const hasWager = chosenTeamData && chosenTeamData.wager !== null && chosenTeamData.wager !== undefined;
  const showQuestion = chosen && hasWager;
  const showAnswer = !!activeQ.revealed;

  return (
    <div className="min-h-screen bg-jeopardy-blue flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
      <h2 className="text-6xl font-korinna leading-tight max-w-5xl relative z-10 jeopardy-text-shadow">
        {showQuestion || showAnswer ? activeQ.question : "Daily Double!"}
      </h2>
      <div className="mt-16 w-full max-w-2xl relative z-10">
        {!chosen ? (
          <div className="bg-black/60 p-8 border-4 border-jeopardy-gold rounded-sm">
            <h3 className="text-3xl text-jeopardy-gold mb-4">Daily Double!</h3>
            <p className="text-white mb-4">Select which team chose the Daily Double</p>
            <div className="flex gap-3 justify-center flex-wrap">
              {teams.map((team) => (
                <button key={team} onClick={() => assignDailyDouble(team)} className="jeopardy-button h-12">
                  {team}
                </button>
              ))}
            </div>
          </div>
        ) : !hasWager ? (
          <div className="bg-black/60 p-8 border-4 border-jeopardy-gold rounded-sm">
            <h3 className="text-3xl text-jeopardy-gold mb-2">Team: {chosen}</h3>
            <div className="text-2xl mb-4">Score: ${chosenTeamData?.score || 0}</div>
            <div className="text-lg text-jeopardy-gold">Waiting for wager...</div>
          </div>
        ) : !showAnswer ? (
          <div className="flex flex-col items-center gap-6">
            <div className="text-jeopardy-gold text-2xl font-bold animate-pulse-slow tracking-widest uppercase">
              Wager locked: ${chosenTeamData.wager}
            </div>
            <div className="bg-black/60 p-6 rounded mt-4">
              <p className="text-2xl mb-6 font-swiss italic text-white/80">{activeQ.question}</p>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-6">
              <button onClick={() => judge(true)} className="jeopardy-button bg-green-600 text-white border-green-400 h-16">Correct</button>
              <button onClick={() => judge(false)} className="jeopardy-button bg-red-600 text-white border-red-400 h-16">Incorrect</button>
            </div>
          </div>
        ) : (
          <div className="bg-black/60 backdrop-blur-md p-8 border-4 border-jeopardy-gold rounded-sm">
            <h3 className="text-3xl text-jeopardy-gold font-korinna mb-2">Answer</h3>
            <p className="text-2xl mb-6 font-swiss italic text-white/80">"{activeQ.answer}"</p>
            <div className="text-xs text-jeopardy-blue uppercase tracking-widest">
              Press Close Question to continue
            </div>
          </div>
        )}
      </div>

      <button onClick={closeActiveQuestion} className="absolute bottom-8 right-8 text-white/30 hover:text-white uppercase tracking-widest text-sm">
        Close Question
      </button>
    </div>
  );
}
