const Auth = {
  HASH: 'e9643d2889036edd0ba372c167b4275f0e0f479d3236a2e58a7ed8b8e2a608cb',
  SESSION_KEY: 'tb_auth',
  SESSION_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days

  async sha256(text) {
    const encoder = new TextEncoder();
    const data = encoder.encode(text);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  isLoggedIn() {
    try {
      const session = JSON.parse(localStorage.getItem(this.SESSION_KEY));
      if (!session) return false;
      if (Date.now() - session.ts > this.SESSION_TTL) {
        localStorage.removeItem(this.SESSION_KEY);
        return false;
      }
      return session.hash === this.HASH;
    } catch {
      return false;
    }
  },

  login(hash) {
    localStorage.setItem(this.SESSION_KEY, JSON.stringify({ hash, ts: Date.now() }));
  },

  logout() {
    localStorage.removeItem(this.SESSION_KEY);
    location.reload();
  },

  init() {
    const loginScreen = document.getElementById('login-screen');
    const appMain = document.getElementById('app-main');
    const form = document.getElementById('login-form');
    const error = document.getElementById('login-error');

    if (this.isLoggedIn()) {
      loginScreen.style.display = 'none';
      appMain.style.display = '';
      return;
    }

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const user = document.getElementById('login-user').value.trim();
      const pass = document.getElementById('login-pass').value;
      const hash = await this.sha256(`${user}:${pass}`);

      if (hash === this.HASH) {
        this.login(hash);
        loginScreen.style.display = 'none';
        appMain.style.display = '';
        // Trigger app init now that we're logged in
        if (typeof App !== 'undefined') App.init();
      } else {
        error.textContent = 'Credenciais incorretas';
        document.getElementById('login-pass').value = '';
        form.classList.add('shake');
        setTimeout(() => form.classList.remove('shake'), 500);
      }
    });
  }
};

document.addEventListener('DOMContentLoaded', () => Auth.init());
