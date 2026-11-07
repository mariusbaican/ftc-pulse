import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  EventDetailsResponse,
  HealthResponse,
  QueueAlertResponse,
  SeasonSummaryResponse,
  TeamSearchResponse,
} from '@/types/api';
import { ApiError } from '@/services/api/client';
import {
  fetchCurrentQueueAlert,
  fetchEventDetails,
  fetchServerHealth,
  fetchTeamSeasonSummary,
  searchTeams,
} from '@/services/api/endpoints';

/**
 * Screen presentation statuses following the Four-State rule from expo-data-fetching.
 */
export type ScreenDataStatus = 'loading' | 'error' | 'empty' | 'success';

/**
 * Result shape returned by useApiQuery and domain hooks.
 */
export interface UseApiQueryResult<T> {
  data: T | null;
  status: ScreenDataStatus;
  isLoading: boolean;
  isRefreshing: boolean;
  error: ApiError | null;
  refetch: () => Promise<void>;
}

/**
 * Generic asynchronous data fetching hook.
 *
 * Implements:
 * 1. AbortController integration - automatically cancels stale in-flight requests
 *    when dependencies change or the component unmounts.
 * 2. Four-State rule ('loading' | 'error' | 'empty' | 'success').
 * 3. Pull-to-refresh preservation - retains stale data during background refetching
 *    and flags `isRefreshing: true`.
 * 4. Refetch retry capability without losing screen context on transient errors.
 */
export function useApiQuery<T>(
  fetcher: (signal: AbortSignal) => Promise<T>,
  deps: readonly unknown[],
  isEmptyFn?: (data: T) => boolean
): UseApiQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const isEmptyFnRef = useRef(isEmptyFn);
  isEmptyFnRef.current = isEmptyFn;

  const abortControllerRef = useRef<AbortController | null>(null);
  const isMountedRef = useRef<boolean>(true);
  const dataRef = useRef<T | null>(null);
  dataRef.current = data;

  const executeFetch = useCallback(async (isManualRefresh = false) => {
    // Abort prior in-flight request if still running
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (isManualRefresh) {
      if (dataRef.current !== null) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
    } else {
      setIsLoading(true);
      setData(null);
    }
    setError(null);

    try {
      const result = await fetcherRef.current(controller.signal);
      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }
      setData(result);
      setError(null);
    } catch (err: unknown) {
      if (!isMountedRef.current || controller.signal.aborted) {
        return;
      }
      if (err instanceof ApiError) {
        if (err.code === 'ABORTED') {
          return;
        }
        setError(err);
      } else if (err instanceof Error && err.name === 'AbortError') {
        return;
      } else {
        setError(
          new ApiError(
            err instanceof Error ? err.message : 'Unknown query error',
            0,
            'QUERY_ERROR',
            '',
            false
          )
        );
      }
    } finally {
      if (isMountedRef.current && !controller.signal.aborted) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    executeFetch(false);

    return () => {
      isMountedRef.current = false;
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const refetch = useCallback(async () => {
    await executeFetch(true);
  }, [executeFetch]);

  // Compute status according to the Four-State rule
  let status: ScreenDataStatus;
  if (isLoading && data === null) {
    status = 'loading';
  } else if (error && data === null) {
    status = 'error';
  } else if (data !== null && isEmptyFnRef.current?.(data)) {
    status = 'empty';
  } else {
    status = 'success';
  }

  return {
    data,
    status,
    isLoading,
    isRefreshing,
    error,
    refetch,
  };
}

/**
 * Hook for server health and connectivity check.
 */
export function useServerHealth(): UseApiQueryResult<HealthResponse> {
  return useApiQuery((signal) => fetchServerHealth(signal), []);
}

/**
 * Hook for team search with debouncing.
 * Debounces non-empty query typing by debounceMs while executing empty query
 * immediately so clearing search is instant.
 * Passes isEmptyFn: (res) => res.teams.length === 0.
 */
export function useTeamSearch(
  query: string,
  debounceMs = 180
): UseApiQueryResult<TeamSearchResponse> {
  const [debouncedQuery, setDebouncedQuery] = useState(query);

  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setDebouncedQuery(query);
      return;
    }

    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, debounceMs);

    return () => {
      clearTimeout(timer);
    };
  }, [query, debounceMs]);

  return useApiQuery(
    (signal) => searchTeams(debouncedQuery, signal),
    [debouncedQuery],
    (res) => res.teams.length === 0
  );
}

/**
 * Hook for season summary, W-L-T record, and global OPR.
 * Defaults to BrickBot #15996.
 */
export function useTeamSeasonSummary(
  teamNumber = 15996
): UseApiQueryResult<SeasonSummaryResponse> {
  return useApiQuery(
    (signal) => fetchTeamSeasonSummary(teamNumber, signal),
    [teamNumber],
    (res) => res.events.length === 0
  );
}

/**
 * Hook for event metadata, computed statistics, and match schedule.
 */
export function useEventDetails(
  eventCode: string
): UseApiQueryResult<EventDetailsResponse> {
  return useApiQuery(
    (signal) => fetchEventDetails(eventCode, signal),
    [eventCode]
  );
}

/**
 * Hook for currently active queue alert status.
 */
export function useCurrentQueueAlert(): UseApiQueryResult<QueueAlertResponse> {
  return useApiQuery(
    (signal) => fetchCurrentQueueAlert(signal),
    [],
    (res) => !res.active || !res.alert
  );
}
