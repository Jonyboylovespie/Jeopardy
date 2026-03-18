# Jeopardy

A real-time, Jeopardy-style game built with a React + Vite frontend and a Node.js + Express + Socket.IO backend. Hosts control the board and scoring while players join from their own devices to buzz and submit Final Jeopardy wagers/answers.

## Features

- Live host and player experiences powered by Socket.IO
- Real-time buzzer locking and team scoring
- Final Jeopardy flow with wagers and answer submission
- Host-driven judging and leaderboard updates
- Responsive UI designed for game-night setups

## Tech Stack

- Frontend: React, Vite, Tailwind CSS, React Router
- Backend: Node.js, Express, Socket.IO

## Project Structure

- `frontend/`: React + Vite client application
- `backend/`: Express + Socket.IO server

## Getting Started

### Prerequisites

- Node.js and npm installed

### Install dependencies

Frontend:

    cd frontend
    npm install

Backend:

    cd backend
    npm install

### Run the backend

From `backend/`:

    node server.js

Optional (auto-reload):

    npx nodemon server.js

The backend listens on port `3001` by default.

### Run the frontend

From `frontend/`:

    npm run dev

Vite will serve the app on:

- http://localhost:5173

## Usage

1. Open the app in a browser and click **Start New Show** to create a room.
2. The host view opens at `/host/:roomCode`.
3. Players join from the home screen with the room code and a team name.
4. The host runs the board and controls judging.
5. During Final Jeopardy:
   - Players enter wagers first.
   - The host reveals the question after all wagers are locked.
   - Players submit answers from their devices.
   - Answers remain hidden on the host view until all teams are locked in.

## Configuration Notes

The frontend connects to the Socket.IO server at `http://localhost:3001`. If you deploy the backend elsewhere, update the Socket.IO client URL in:

- `frontend/src/App.jsx`
- `frontend/src/Host.jsx`
- `frontend/src/Player.jsx`

## Scripts

Frontend (`frontend/package.json`):

- `npm run dev` – start dev server
- `npm run build` – build for production
- `npm run preview` – preview production build
- `npm run lint` – run ESLint

Backend (`backend/package.json`):

- `npm test` – placeholder (no tests configured)

## License

ISC