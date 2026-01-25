const API_BASE = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000';

export interface ClaimPayload {
  owner_id: string;
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
  const res = await fetch(`${API_BASE}/claims`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function createBuild(payload: BuildPayload) {
  const res = await fetch(`${API_BASE}/builds`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
