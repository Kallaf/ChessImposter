const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

export function apiBaseUrl(): string {
  return API_URL;
}

export function wsBaseUrl(): string {
  return API_URL.replace(/^http/, 'ws');
}
