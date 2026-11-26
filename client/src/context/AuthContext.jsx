
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api, TOKEN_KEY } from '../lib/api.js';
import { disconnectSocket } from '../lib/socket.js';

const AuthContext = createContext(null);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const [loading, setLoading] = useState(
    Boolean(localStorage.getItem(TOKEN_KEY))
  );

  // Store session invalidation message
  const [sessionMessage, setSessionMessage] = useState('');

  // Logout and disconnect real-time socket
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    disconnectSocket();
    setUser(null);
    setLoading(false);
  }, []);

  // Restore existing login session
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);

    if (!token) {
      setLoading(false);
      return;
    }

    let active = true;

    api
      .get('/auth/me')
      .then((data) => {
        if (
          active &&
          localStorage.getItem(TOKEN_KEY) === token
        ) {
          setUser(data.user);
        }
      })
      .catch(() => {
        if (
          active &&
          localStorage.getItem(TOKEN_KEY) === token
        ) {
          logout();
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [logout]);

  // Handle unauthorized HTTP requests
  useEffect(() => {
    const handleUnauthorized = () => {
      setSessionMessage(
        'Your session is no longer valid. Please sign in again.'
      );

      logout();
    };

    window.addEventListener(
      'pulse:unauthorized',
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        'pulse:unauthorized',
        handleUnauthorized
      );
    };
  }, [logout]);

  // Handle Socket.IO session invalidation
  useEffect(() => {
    const handleSessionInvalidated = (event) => {
      setSessionMessage(
        event.detail?.message ||
          'Your session has expired. Please sign in again.'
      );

      logout();
    };

    window.addEventListener(
      'pulse:session-invalidated',
      handleSessionInvalidated
    );

    return () => {
      window.removeEventListener(
        'pulse:session-invalidated',
        handleSessionInvalidated
      );
    };
  }, [logout]);

  // Clear displayed session messages
  const clearSessionMessage = useCallback(() => {
    setSessionMessage('');
  }, []);

  const value = useMemo(() => {
    // Login after successful authentication
    const login = async (body) => {
      const data = await api.post('/auth/login', body);

      disconnectSocket();

      localStorage.setItem(TOKEN_KEY, data.token);

      setSessionMessage('');
      setUser(data.user);

      return data;
    };

    // Login using Google OAuth
    const googleLogin = async (code) => {
      const data = await api.post(
        '/auth/google/exchange',
        { code }
      );

      disconnectSocket();

      localStorage.setItem(TOKEN_KEY, data.token);

      setSessionMessage('');
      setUser(data.user);

      return data;
    };

    // Request registration OTP
    const register = async (body) => {
      return api.post('/auth/register', body);
    };

    // Verify OTP and create account
    const verifyOTP = async (registrationId, otp) => {
      return api.post('/auth/verify-otp', {
        registrationId,
        otp,
      });
    };

    // Request a new OTP
    const resendOTP = async (registrationId) => {
      return api.post('/auth/resend-otp', {
        registrationId,
      });
    };

    return {
      user,
      loading,
      login,
      googleLogin,
      register,
      verifyOTP,
      resendOTP,
      logout,
      sessionMessage,
      clearSessionMessage,
    };
  }, [
    user,
    loading,
    logout,
    sessionMessage,
    clearSessionMessage,
  ]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
