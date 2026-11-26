import { api } from './api.js';

const base = (projectId) =>
  `/projects/${projectId}/ai`;

export const pulseAI = {

  plan(projectId, mode, prompt) {
    return api.post(`${base(projectId)}/plan`, {
      mode,
      prompt,
    });
  },

  intelligence(projectId) {
    return api.post(
      `${base(projectId)}/intelligence`,
      {}
    );
  },

  assign(projectId, taskId) {
    return api.post(`${base(projectId)}/assign`, {
      taskId,
    });
  },

  ask(projectId, question) {
    return api.post(`${base(projectId)}/ask`, {
      question,
    });
  },

};

export function getAIError(error) {

  switch (error.status) {

    case 0:
      return 'Cannot connect to the server. Check your internet connection.';

    case 400:
      return error.message || 'Please check your input.';

    case 401:
      return 'Your session has expired. Please sign in again.';

    case 403:
    case 404:
      return 'This project or task is no longer accessible.';

    case 429:
      return error.message || 'AI usage limit reached. Please try again later.';

    case 502:
      return 'Pulse AI returned an invalid response. Please try again.';

    case 503:
      return 'Pulse AI is temporarily unavailable. Please try again later.';

    case 504:
      return 'Pulse AI is taking longer than expected. Please try again.';

    default:
      return error.message || 'Something went wrong. Please try again.';

  }

}