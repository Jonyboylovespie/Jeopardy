import io from "socket.io-client";

const socketUrl = import.meta.env.VITE_SOCKET_URL;
const socket = io(socketUrl, {
  autoConnect: false,
  transports: ["websocket", "polling"],
  timeout: 10000,
  reconnectionAttempts: 5,
});

let connectPromise = null;

export function ensureSocketConnected() {
  if (socket.connected) {
    return Promise.resolve(socket);
  }

  if (connectPromise) {
    return connectPromise;
  }

  connectPromise = new Promise((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      connectPromise = null;
      resolve(socket);
    };

    const onError = (error) => {
      cleanup();
      connectPromise = null;
      reject(error);
    };

    const cleanup = () => {
      socket.off("connect", onConnect);
      socket.off("connect_error", onError);
    };

    socket.on("connect", onConnect);
    socket.on("connect_error", onError);
    socket.connect();
  });

  return connectPromise;
}

export default socket;
