const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export interface ClaimPayload {
  lat: number;
  lon: number;
  address_label: string;
}

export interface BuildPayload {
  claim_id: string;
  prefab: string;
  decal?: string;
  flag?: string;
  height_m: number;
}

export async function fetchNearby(lat: number, lon: number, radius_m = 2000) {
  const url = `${API_BASE}/nearby?lat=${lat}&lon=${lon}&radius_m=${radius_m}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Failed to load nearby claims');
  return res.json();
}

export async function createClaim(payload: ClaimPayload) {
  const token = localStorage.getItem('turf_token');
  if (!token) throw new Error('Not authenticated');
  
  const res = await fetch(`${API_BASE}/claims`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createBuild(payload: BuildPayload) {
  const token = localStorage.getItem('turf_token');
  const res = await fetch(`${API_BASE}/builds`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchVisibility(token: string, lat: number, lon: number, radius_m = 50) {
  const res = await fetch(`${API_BASE}/visibility?lat=${lat}&lon=${lon}&radius_m=${radius_m}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('visibility failed');
  return res.json();
}

export async function fetchFog(token: string, lat: number, lon: number, radius_m = 50, bbox?: { min_lon: number; min_lat: number; max_lon: number; max_lat: number }) {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    radius_m: String(radius_m),
  });
  if (bbox) {
    params.set('min_lon', String(bbox.min_lon));
    params.set('min_lat', String(bbox.min_lat));
    params.set('max_lon', String(bbox.max_lon));
    params.set('max_lat', String(bbox.max_lat));
  }
  const res = await fetch(`${API_BASE}/fog?${params.toString()}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('fog failed');
  return res.json();
}

export async function register(handle: string, email: string, password: string) {
  const res = await fetch(`${API_BASE}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ handle, email, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Registration failed');
  }
  return res.json();
}

export async function login(username: string, password: string) {
  const res = await fetch(`${API_BASE}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const error = await res.json();
    throw new Error(error.detail || 'Login failed');
  }
  return res.json();
}

export async function me(token: string) {
  const res = await fetch(`${API_BASE}/me`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error('auth failed');
  return res.json();
}

export async function fetchMessages(token: string, roomId: string, offset: number = 0, limit: number = 50) {
  const params = new URLSearchParams({
    room_id: encodeURIComponent(roomId),
    offset: String(offset),
    limit: String(limit),
  });
  const res = await fetch(`${API_BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    console.warn('Failed to fetch messages:', await res.text());
    return [];
  }
  return res.json();
}

export async function fetchUserProfile(userId: string) {
  const res = await fetch(`${API_BASE}/users/${userId}`);
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function verifyUser(userId: string, token: string) {
  const res = await fetch(`${API_BASE}/users/${userId}/verify`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function fetchTopRooms(limit = 10) {
  const res = await fetch(`${API_BASE}/chatrooms/top?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to load top rooms');
  return res.json();
}

export async function fetchMyClaims(token: string) {
  const res = await fetch(`${API_BASE}/my-claims`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to load claims');
  return res.json();
}

export interface BuildUpdate {
  prefab: string;
  flag?: string;
  decal?: string;
  height_m: number;
}

export async function updateBuild(buildId: string, payload: BuildUpdate, token: string) {
  const res = await fetch(`${API_BASE}/builds/${buildId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function deleteClaim(claimId: string, token: string) {
  const res = await fetch(`${API_BASE}/claims/${claimId}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateClaimLabel(claimId: string, addressLabel: string, token: string) {
  const res = await fetch(`${API_BASE}/claims/${claimId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ address_label: addressLabel }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
