// Base URL for all API calls.
// In dev: empty string → Vite proxies /api/* to localhost:3001
// In production: set VITE_API_BASE_URL to your Railway backend URL
// e.g. https://hypersomnia-backend.up.railway.app
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined ?? '').replace(/\/$/, '')
