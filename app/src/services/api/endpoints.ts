import { apiClient } from './client';
import type {
  EventDetailsResponse,
  HealthResponse,
  QueueAlertResponse,
  SeasonSummaryResponse,
  TeamSearchResponse,
  TriggerAlertPayload,
} from '@/types/api';

/**
 * Checks server health, season info, and connected data sources.
 * GET /api/health
 */
export async function fetchServerHealth(signal?: AbortSignal): Promise<HealthResponse> {
  return apiClient.get<HealthResponse>('/api/health', { signal });
}

/**
 * Searches for teams matching the query string.
 * In this PoC, searches matching BrickBot #15996 will succeed.
 * GET /api/teams?query=${query}
 */
export async function searchTeams(
  query?: string,
  signal?: AbortSignal
): Promise<TeamSearchResponse> {
  const encodedQuery = encodeURIComponent(query ?? '');
  return apiClient.get<TeamSearchResponse>(`/api/teams?query=${encodedQuery}`, { signal });
}

/**
 * Retrieves the aggregated season summary, record, OPR breakdown, period averages,
 * best match, and full events list for a team (defaults to BrickBot #15996).
 * Supports optional multi-season querying (?season=${season}).
 * GET /api/teams/${teamNumber}/season-summary?season=${season}
 */
export async function fetchTeamSeasonSummary(
  teamNumber = 15996,
  season?: number,
  signal?: AbortSignal
): Promise<SeasonSummaryResponse> {
  const queryParam = season !== undefined ? `?season=${season}` : '';
  return apiClient.get<SeasonSummaryResponse>(
    `/api/teams/${teamNumber}/season-summary${queryParam}`,
    { signal }
  );
}

/**
 * Fetches event metadata, computed statistics, match schedules, and active alerts.
 * GET /api/events/${eventCode}/details
 */
export async function fetchEventDetails(
  eventCode: string,
  signal?: AbortSignal
): Promise<EventDetailsResponse> {
  return apiClient.get<EventDetailsResponse>(`/api/events/${encodeURIComponent(eventCode)}/details`, {
    signal,
  });
}

/**
 * Retrieves the current live match queue alert, if active.
 * GET /api/mock/current-alert
 */
export async function fetchCurrentQueueAlert(
  signal?: AbortSignal
): Promise<QueueAlertResponse> {
  return apiClient.get<QueueAlertResponse>('/api/mock/current-alert', { signal });
}

/**
 * Triggers a simulated live match queue alert for BrickBot #15996.
 * POST /api/mock/trigger-queue-alert
 */
export async function triggerMockQueueAlert(
  payload?: TriggerAlertPayload,
  signal?: AbortSignal
): Promise<QueueAlertResponse> {
  return apiClient.post<QueueAlertResponse>(
    '/api/mock/trigger-queue-alert',
    payload ?? {},
    { signal }
  );
}

/**
 * Clears any currently active live match queue alert.
 * POST /api/mock/clear-alert
 */
export async function clearMockQueueAlert(
  signal?: AbortSignal
): Promise<QueueAlertResponse> {
  return apiClient.post<QueueAlertResponse>('/api/mock/clear-alert', undefined, { signal });
}
