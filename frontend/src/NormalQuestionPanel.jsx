import React from "react";
import EVENTS from "./socketEvents";

export default function NormalQuestionPanel({ activeQ, gameState, judge, socket, roomCode, closeActiveQuestion }) {
  return (
    <div className="min-h-screen bg-jeopardy-blue flex flex-col items-center justify-center p-12 text-center relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,255,255,0.1)_0%,transparent_70%)]" />
      <h2 className="text-6xl font-korinna leading-tight max-w-5xl relative z-10 jeopardy-text-shadow">
        {gameState.activeQuestion.question}
      </h2>
      <div className="mt-16 w-full max-w-2xl relative z-10">
        {!gameState.activeTeamId ? (
          activeQ.revealed ? (
            <div className="bg-black/60 backdrop-blur-md p-8 border-4 border-jeopardy-gold rounded-sm">
              <h3 className="text-3xl text-jeopardy-gold font-korinna mb-2">Answer</h3>
              <p className="text-2xl mb-6 font-swiss italic text-white/80">"{gameState.activeQuestion.answer}"</p>
              <div className="text-xs text-jeopardy-blue uppercase tracking-widest">Press Close Question to continue</div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-6">
              <div className="text-jeopardy-gold text-2xl font-bold animate-pulse-slow tracking-widest uppercase">
                {gameState.buzzerLocked ? "Preparing Buzzers..." : "Buzzers Active"}
              </div>
              {gameState.buzzerLocked && (
                <button onClick={() => socket.emit(EVENTS.UNLOCK_BUZZERS, roomCode)} className="jeopardy-button h-20 w-80 text-2xl shadow-neon">Open Floor</button>
              )}
            </div>
          )
        ) : (
          <div className="bg-black/60 backdrop-blur-md p-8 border-4 border-jeopardy-gold rounded-sm">
            <h3 className="text-3xl text-jeopardy-gold font-korinna mb-2">Team: {gameState.activeTeamId}</h3>
            {activeQ.revealed && (
              <p className="text-2xl mb-8 font-swiss italic text-white/80">"{gameState.activeQuestion.answer}"</p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => judge(true)} className="jeopardy-button bg-green-600 text-white border-green-400 h-16">Correct</button>
              <button onClick={() => judge(false)} className="jeopardy-button bg-red-600 text-white border-red-400 h-16">Incorrect</button>
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
