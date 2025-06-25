const API_URL = import.meta.env.VITE_API_URL;

export async function login(email: string, password: string): Promise<string | null> {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (res.ok) {
    localStorage.setItem('token', data.access_token);
    
    // Decodificar el token para guardar info básica del usuario
    const user = decodeToken(data.access_token);
    if (user) {
      localStorage.setItem('user', JSON.stringify(user));
    }

    return data.access_token;
  } else {
    alert(data.message || 'Error al iniciar sesión');
    return null;
  }
}

export async function register(email: string, password: string, name: string): Promise<boolean> {
  const res = await fetch(`${API_URL}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name }),
  });

  const data = await res.json();

  if (res.ok) {
    alert('Registro exitoso');
    return true;
  } else {
    alert(data.message || 'Error al registrarse');
    return false;
  }
}

export function getToken(): string | null {
  return localStorage.getItem('token');
}

export function getUser(): { id: string; email: string; planId?: string } | null {
  const userStr = localStorage.getItem('user');
  if (userStr) {
    try {
      return JSON.parse(userStr);
    } catch {
      return null;
    }
  }
  const token = getToken();
  if (token) {
    return decodeToken(token);
  }
  return null;
}

export function logout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Decodifica el token JWT (sin validación de firma, solo para lectura)
function decodeToken(token: string): { id: string; email: string; planId?: string } | null {
  try {
    const [, payloadBase64] = token.split('.');
    const payload = atob(payloadBase64);
    return JSON.parse(payload);
  } catch {
    return null;
  }
}
