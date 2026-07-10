// Caminho relativo: como o frontend agora é servido pelo mesmo servidor
// que a API, isso funciona automaticamente em qualquer domínio
// (localhost, onrender.com, domínio próprio, etc.) sem precisar editar nada.
const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function clearSession() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

function getUser() {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
}

function setUser(user) {
    localStorage.setItem('user', JSON.stringify(user));
}

async function apiRequest(endpoint, method = 'GET', body = null, auth = true) {
    const headers = { 'Content-Type': 'application/json' };
    if (auth) {
        const token = getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
    }

    const options = { method, headers };
    if (body) options.body = JSON.stringify(body);

    const response = await fetch(`${API_BASE}${endpoint}`, options);
    const data = await response.json().catch(() => ({}));

    if (response.status === 401) {
        // Sessão expirada ou inválida: encerra e redireciona para o login
        clearSession();
        if (!window.location.pathname.includes('/Auth/')) {
            window.location.href = '../Auth/login.html';
        }
        throw new Error(data.error || 'Sessão expirada.');
    }

    if (!response.ok) {
        throw new Error(data.error || 'Erro desconhecido ao comunicar com o servidor.');
    }

    return data;
}

function requireAuth() {
    if (!getToken()) {
        window.location.href = '../Auth/login.html';
    }
}
