import type { RetraceApi } from './api';
import { createHttpService } from './httpService';
import { createMockService } from './mockService';

/** Data source: the real API by default; `VITE_API_MODE=mock` runs the UI on in-browser demo data. */
export const API_MODE: 'mock' | 'http' = import.meta.env.VITE_API_MODE === 'mock' ? 'mock' : 'http';

export function createApi(): RetraceApi {
  return API_MODE === 'mock' ? createMockService() : createHttpService();
}
