const Auth = {
  HASH: 'e9643d2889036edd0ba372c167b4275f0e0f479d3236a2e58a7ed8b8e2a608cb',
  SESSION_KEY: 'tb_auth',
  SESSION_TTL: 7 * 24 * 60 * 60 * 1000, // 7 days

  async sha256(text) {
    // crypto.subtle only works on HTTPS or localhost — fallback for LAN/HTTP
    if (window.crypto && window.crypto.subtle) {
      try {
        const encoder = new TextEncoder();
        const data = encoder.encode(text);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      } catch { /* fall through to fallback */ }
    }
    // Simple SHA-256 fallback (js implementation)
    return this.sha256Fallback(text);
  },

  sha256Fallback(str) {
    function rightRotate(value, amount) { return (value >>> amount) | (value << (32 - amount)); }
    const k = [
      0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,
      0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,
      0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,
      0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,
      0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,
      0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,
      0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,
      0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2
    ];
    let h0=0x6a09e667,h1=0xbb67ae85,h2=0x3c6ef372,h3=0xa54ff53a,h4=0x510e527f,h5=0x9b05688c,h6=0x1f83d9ab,h7=0x5be0cd19;
    const bytes = new TextEncoder().encode(str);
    const bitLen = bytes.length * 8;
    const padded = new Uint8Array(Math.ceil((bytes.length + 9) / 64) * 64);
    padded.set(bytes); padded[bytes.length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 4, bitLen, false);
    for (let offset = 0; offset < padded.length; offset += 64) {
      const w = new Uint32Array(64);
      for (let i = 0; i < 16; i++) w[i] = view.getUint32(offset + i * 4, false);
      for (let i = 16; i < 64; i++) {
        const s0 = rightRotate(w[i-15],7) ^ rightRotate(w[i-15],18) ^ (w[i-15]>>>3);
        const s1 = rightRotate(w[i-2],17) ^ rightRotate(w[i-2],19) ^ (w[i-2]>>>10);
        w[i] = (w[i-16] + s0 + w[i-7] + s1) | 0;
      }
      let a=h0,b=h1,c=h2,d=h3,e=h4,f=h5,g=h6,h=h7;
      for (let i = 0; i < 64; i++) {
        const S1 = rightRotate(e,6) ^ rightRotate(e,11) ^ rightRotate(e,25);
        const ch = (e & f) ^ (~e & g);
        const temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
        const S0 = rightRotate(a,2) ^ rightRotate(a,13) ^ rightRotate(a,22);
        const maj = (a & b) ^ (a & c) ^ (b & c);
        const temp2 = (S0 + maj) | 0;
        h=g; g=f; f=e; e=(d+temp1)|0; d=c; c=b; b=a; a=(temp1+temp2)|0;
      }
      h0=(h0+a)|0; h1=(h1+b)|0; h2=(h2+c)|0; h3=(h3+d)|0; h4=(h4+e)|0; h5=(h5+f)|0; h6=(h6+g)|0; h7=(h7+h)|0;
    }
    return [h0,h1,h2,h3,h4,h5,h6,h7].map(v=>(v>>>0).toString(16).padStart(8,'0')).join('');
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

  isLocalhost() {
    const h = location.hostname;
    return h === 'localhost' || h === '127.0.0.1' || h.startsWith('192.168.') || h.startsWith('10.');
  },

  init() {
    const loginScreen = document.getElementById('login-screen');
    const appMain = document.getElementById('app-main');
    const form = document.getElementById('login-form');
    const error = document.getElementById('login-error');

    // Skip auth on local network
    if (this.isLocalhost()) {
      loginScreen.style.display = 'none';
      appMain.style.display = '';
      return;
    }

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
