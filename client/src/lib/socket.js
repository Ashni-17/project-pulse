
import { io } from 'socket.io-client';
import { TOKEN_KEY } from './api.js';

let socket;

// One shared connection per browser tab
export function getSocket() {
  if (!socket) {
    socket = io(
      import.meta.env.VITE_SOCKET_URL || window.location.origin,
      {
        auth: (cb) => {
          cb({
            token: localStorage.getItem(TOKEN_KEY),
          });
        },
      }
    );

    // Handle expired or invalidated sessions
    socket.on('session:invalidated', (payload) => {
      window.dispatchEvent(
        new CustomEvent('pulse:session-invalidated', {
          detail: {
            message:
              payload?.message ||
              'Your session has expired. Please sign in again.',
          },
        })
      );
    });

    // Handle rejected socket authentication
    socket.on('connect_error', (error) => {
      if (error.message === 'Unauthorized') {
        window.dispatchEvent(
          new CustomEvent('pulse:session-invalidated', {
            detail: {
              message:
                'Your session is no longer valid. Please sign in again.',
            },
          })
        );
      }
    });
  }

  return socket;
}

// Disconnect and clear the shared connection
export function disconnectSocket() {
  if (socket) {
    const currentSocket = socket;

    socket = undefined;

    currentSocket.removeAllListeners();
    currentSocket.disconnect();
  }
}
