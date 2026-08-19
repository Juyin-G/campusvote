const API_BASE = `${window.location.origin}/api`;
const TOKEN_KEY = 'campusvote_token';
const USER_KEY = 'campusvote_user';

const loginForm = document.getElementById('login-form');
const loginPanel = document.getElementById('login-panel');
const logoutPanel = document.getElementById('logout-panel');
const logoutBtn = document.getElementById('logout-btn');
const sessionStatus = document.getElementById('session-status');
const userInfo = document.getElementById('user-info');
const messagePanel = document.getElementById('message-panel');
const apiBaseLabel = document.getElementById('api-base');

apiBaseLabel.textContent = API_BASE;

function showMessage(text, type = 'success') {
  messagePanel.textContent = text;
  messagePanel.className = `message message--${type}`;
  messagePanel.classList.remove('hidden');
}

function hideMessage() {
  messagePanel.classList.add('hidden');
}

function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function renderUserInfo(user) {
  userInfo.innerHTML = `
    <div>
      <dt>Nombre</dt>
      <dd>${user.firstName} ${user.lastName}</dd>
    </div>
    <div>
      <dt>Email</dt>
      <dd>${user.email}</dd>
    </div>
    <div>
      <dt>Rol</dt>
      <dd>${user.role}</dd>
    </div>
  `;
  userInfo.classList.remove('hidden');
}

function setLoggedInView(user) {
  sessionStatus.textContent = 'Sesión activa';
  sessionStatus.className = 'status status--active';
  renderUserInfo(user);
  loginPanel.classList.add('hidden');
  logoutPanel.classList.remove('hidden');
}

function setLoggedOutView() {
  sessionStatus.textContent = 'Sin sesión activa';
  sessionStatus.className = 'status status--guest';
  userInfo.innerHTML = '';
  userInfo.classList.add('hidden');
  loginPanel.classList.remove('hidden');
  logoutPanel.classList.add('hidden');
  loginForm.reset();
}

function restoreSessionFromStorage() {
  const token = getToken();
  const user = getStoredUser();

  if (token && user) {
    setLoggedInView(user);
  } else {
    clearSession();
    setLoggedOutView();
  }
}

async function login(email, password) {
  const response = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'No se pudo iniciar sesión');
  }

  saveSession(data.data.token, data.data.user);
  setLoggedInView(data.data.user);
  showMessage('Login exitoso', 'success');
}

async function logout() {
  const token = getToken();

  if (!token) {
    clearSession();
    setLoggedOutView();
    return;
  }

  const response = await fetch(`${API_BASE}/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.error?.message || 'No se pudo cerrar sesión');
  }

  clearSession();
  setLoggedOutView();
  showMessage('Sesión cerrada correctamente', 'success');
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  hideMessage();

  const email = loginForm.email.value.trim();
  const password = loginForm.password.value;

  try {
    await login(email, password);
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

logoutBtn.addEventListener('click', async () => {
  hideMessage();

  try {
    await logout();
  } catch (error) {
    showMessage(error.message, 'error');
  }
});

restoreSessionFromStorage();
