const API_BASE_URL = 'https://firme-ro-api-production.up.railway.app/api';

const Auth = {
  getToken() {
    return localStorage.getItem('firmero_token');
  },
  setToken(token) {
    localStorage.setItem('firmero_token', token);
  },
  getUser() {
    const u = localStorage.getItem('firmero_user');
    return u ? JSON.parse(u) : null;
  },
  setUser(user) {
    localStorage.setItem('firmero_user', JSON.stringify(user));
  },
  logout() {
    localStorage.removeItem('firmero_token');
    localStorage.removeItem('firmero_user');
    window.location.href = 'index.html';
  },
  isAuthenticated() {
    return !!this.getToken();
  },
  
  // API Calls
  async login(email, password) {
    const res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Eroare la autentificare');
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  async register(email, password) {
    const res = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Eroare la înregistrare');
    this.setToken(data.token);
    this.setUser(data.user);
    return data;
  },

  // Utils pentru actualizarea Navbar-ului global
  updateNavbar() {
    const authLinks = document.querySelectorAll('.auth-links');
    if (!authLinks.length) return;

    authLinks.forEach(container => {
      if (this.isAuthenticated()) {
        const user = this.getUser();
        container.innerHTML = `
          <a href="contul-meu.html" class="nav-link">Contul Meu</a>
          <button onclick="Auth.logout()" class="nav-link btn-logout" style="background: none; border: none; color: inherit; cursor: pointer; padding: 0.5rem; font-family: inherit; font-size: 1rem;">Ieșire</button>
        `;
      } else {
        container.innerHTML = `
          <a href="login.html" class="nav-link">Autentificare</a>
          <a href="register.html" class="nav-link cta-button" style="padding: 0.5rem 1rem;">Creare Cont</a>
        `;
      }
    });
  }
};

// Când se încarcă DOM-ul, actualizăm navbar-ul automat
document.addEventListener('DOMContentLoaded', () => {
  Auth.updateNavbar();
});
