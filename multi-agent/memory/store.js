export class MemoryStore {
  constructor() {
    this.sessions = new Map();
    this.context = new Map();
  }

  createSession(sessionId) {
    const session = {
      id: sessionId,
      messages: [],
      results: [],
      createdAt: Date.now(),
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId) {
    return this.sessions.get(sessionId);
  }

  addMessage(sessionId, role, content) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.messages.push({ role, content, timestamp: Date.now() });
    }
  }

  addResult(sessionId, result) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.results.push(result);
    }
  }

  setContext(key, value) {
    this.context.set(key, value);
  }

  getContext(key) {
    return this.context.get(key);
  }

  getProjectInfo(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return null;

    return {
      sessionId,
      messageCount: session.messages.length,
      results: session.results.map((r) => ({
        agent: r.agent,
        summary: r.response?.slice(0, 200),
      })),
    };
  }

  clearSession(sessionId) {
    this.sessions.delete(sessionId);
  }
}

export const globalStore = new MemoryStore();
