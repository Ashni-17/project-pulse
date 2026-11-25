import { io } from 'socket.io-client';
import { TOKEN_KEY } from './api.js';

let socket;

/** One shared connection per tab. The token is read on every (re)connect attempt. */
export function getSocket() {
  if (!socket) {
    socket = io(import.meta.env.VITE_SOCKET_URL || window.location.origin, {
      auth: (cb) => cb({ token: localStorage.getItem(TOKEN_KEY) }),
    });
  }
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = undefined;
}
