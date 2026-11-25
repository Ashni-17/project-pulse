import { useEffect, useRef, useState } from 'react';
import { getSocket } from '../lib/socket.js';

const EVENTS = ['tasks:upsert', 'task:deleted', 'comment:created', 'activity:created',
  'member:added', 'member:removed', 'project:updated', 'project:deleted', 'project:refresh'];

/**
 * Joins a project's socket room and forwards server events to `handlers`.
 * Handlers are read through a ref so callers can pass inline functions without resubscribing.
 * After a dropped connection the hook re-joins and calls handlers.onResync() to catch up.
 */
export function useProjectSocket(projectId, handlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [online, setOnline] = useState([]);

  useEffect(() => {
    const socket = getSocket();
    let seenConnect = false;
    const join = () => socket.emit('project:join', projectId);

    const listeners = EVENTS.map((event) => [event, (payload) => ref.current[event]?.(payload)]);
    listeners.forEach(([event, fn]) => socket.on(event, fn));

    const onPresence = (p) => p.projectId === projectId && setOnline(p.users);
    const onConnect = () => {
      join();
      if (seenConnect) ref.current.onResync?.();
      seenConnect = true;
    };
    socket.on('presence', onPresence);
    socket.on('connect', onConnect);
    if (socket.connected) { join(); seenConnect = true; }

    return () => {
      socket.emit('project:leave', projectId);
      listeners.forEach(([event, fn]) => socket.off(event, fn));
      socket.off('presence', onPresence);
      socket.off('connect', onConnect);
    };
  }, [projectId]);

  return online;
}
