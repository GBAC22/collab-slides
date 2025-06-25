const API_URL = import.meta.env.VITE_API_URL;

export async function getProjects() {
  const res = await fetch(`${API_URL}/projects`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
  });
  return res.json();
}

export async function createProject(name: string) {
  const res = await fetch(`${API_URL}/projects`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('access_token')}`,
    },
    body: JSON.stringify({ name }),
  });
  return res.json();
}
