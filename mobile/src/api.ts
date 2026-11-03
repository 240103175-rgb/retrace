// The same API client and types as the web app (#28): imported, not copied.
import { createHttpService } from '../../frontend/src/services/httpService';

export { ApiError } from '../../frontend/src/services/types';
export type { CaseSummary, Evidence, EvidenceType, Risk, User } from '../../frontend/src/services/types';

/** Simulator: localhost works on iOS; the Android emulator reaches the host as 10.0.2.2. */
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3200/api/v1';

export const api = createHttpService(API_URL);
