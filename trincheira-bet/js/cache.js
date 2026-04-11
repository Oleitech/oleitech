const Cache = {
  PREFIX: 'tb_',

  get(key) {
    try {
      const raw = localStorage.getItem(this.PREFIX + key);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      if (Date.now() - entry.ts > entry.ttl) {
        localStorage.removeItem(this.PREFIX + key);
        return null;
      }
      return entry.data;
    } catch {
      return null;
    }
  },

  set(key, data, ttl) {
    try {
      localStorage.setItem(this.PREFIX + key, JSON.stringify({ data, ts: Date.now(), ttl }));
    } catch {
      this.purge();
      try {
        localStorage.setItem(this.PREFIX + key, JSON.stringify({ data, ts: Date.now(), ttl }));
      } catch { /* storage full */ }
    }
  },

  remove(key) {
    localStorage.removeItem(this.PREFIX + key);
  },

  purge() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(this.PREFIX)) keys.push(k);
    }
    keys.forEach(k => {
      try {
        const entry = JSON.parse(localStorage.getItem(k));
        if (Date.now() - entry.ts > entry.ttl) localStorage.removeItem(k);
      } catch {
        localStorage.removeItem(k);
      }
    });
  },

  getRequestCount() {
    const today = new Date().toISOString().slice(0, 10);
    const raw = localStorage.getItem(this.PREFIX + 'req_counter');
    if (!raw) return { count: 0, date: today };
    try {
      const data = JSON.parse(raw);
      if (data.date !== today) return { count: 0, date: today };
      return data;
    } catch {
      return { count: 0, date: today };
    }
  },

  incrementRequestCount() {
    const today = new Date().toISOString().slice(0, 10);
    const current = this.getRequestCount();
    const newCount = current.date === today ? current.count + 1 : 1;
    localStorage.setItem(this.PREFIX + 'req_counter', JSON.stringify({ count: newCount, date: today }));
    return newCount;
  },

  getRemainingRequests() {
    return CONFIG.DAILY_LIMIT - this.getRequestCount().count;
  },

  clearAll() {
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.startsWith(this.PREFIX)) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));
  }
};
