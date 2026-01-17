/**
 * Unit tests for the scores module.
 */
import { describe, expect, it } from 'vitest';
import {
  calculateSessionHealth,
  createScoreIdempotencyKey,
  FAILURE_CATEGORIES,
  findDominantFailureMode,
  getErrorSeverity,
  SCORE_DOMINANT_FAILURE_MODE,
  SCORE_ERROR_SEVERITY,
  SCORE_FAILURE_CATEGORY,
  SCORE_SESSION_HEALTH,
  SCORE_SESSION_SUCCESS_RATE,
  SCORE_TOOL_SUCCESS,
  SESSION_HEALTH_VALUES,
} from './scores.js';

describe('Score Constants', () => {
  it('should have correct score names', () => {
    expect(SCORE_TOOL_SUCCESS).toBe('tool_success');
    expect(SCORE_FAILURE_CATEGORY).toBe('failure_category');
    expect(SCORE_ERROR_SEVERITY).toBe('error_severity');
    expect(SCORE_SESSION_SUCCESS_RATE).toBe('session_success_rate');
    expect(SCORE_SESSION_HEALTH).toBe('session_health');
    expect(SCORE_DOMINANT_FAILURE_MODE).toBe('dominant_failure_mode');
  });

  it('should have all failure categories', () => {
    expect(FAILURE_CATEGORIES).toContain('error');
    expect(FAILURE_CATEGORIES).toContain('failed');
    expect(FAILURE_CATEGORIES).toContain('exit_code');
    expect(FAILURE_CATEGORIES).toContain('http_server_error');
    expect(FAILURE_CATEGORIES).toContain('http_client_error');
    expect(FAILURE_CATEGORIES).toContain('timeout');
    expect(FAILURE_CATEGORIES).toContain('cancelled');
    expect(FAILURE_CATEGORIES).toContain('not_found');
    expect(FAILURE_CATEGORIES).toContain('permission_denied');
    expect(FAILURE_CATEGORIES).toContain('incomplete');
    expect(FAILURE_CATEGORIES).toContain('unknown');
  });

  it('should have session health values', () => {
    expect(SESSION_HEALTH_VALUES.HEALTHY).toBe('healthy');
    expect(SESSION_HEALTH_VALUES.DEGRADED).toBe('degraded');
    expect(SESSION_HEALTH_VALUES.UNHEALTHY).toBe('unhealthy');
  });
});

describe('getErrorSeverity', () => {
  it('should return high severity for critical errors', () => {
    expect(getErrorSeverity('permission_denied')).toBe(0.9);
    expect(getErrorSeverity('incomplete')).toBe(0.85);
    expect(getErrorSeverity('exit_code')).toBe(0.8);
  });

  it('should return medium-high severity for server errors', () => {
    expect(getErrorSeverity('timeout')).toBe(0.75);
    expect(getErrorSeverity('http_server_error')).toBe(0.7);
    expect(getErrorSeverity('error')).toBe(0.6);
  });

  it('should return medium severity for client errors', () => {
    expect(getErrorSeverity('failed')).toBe(0.5);
    expect(getErrorSeverity('http_client_error')).toBe(0.5);
  });

  it('should return lower severity for non-critical issues', () => {
    expect(getErrorSeverity('not_found')).toBe(0.4);
    expect(getErrorSeverity('cancelled')).toBe(0.3);
  });

  it('should return default severity for unknown types', () => {
    expect(getErrorSeverity('unknown')).toBe(0.5);
    expect(getErrorSeverity('some_new_error')).toBe(0.5);
    expect(getErrorSeverity(null)).toBe(0.5);
    expect(getErrorSeverity(undefined)).toBe(0.5);
  });
});

describe('createScoreIdempotencyKey', () => {
  it('should create consistent idempotency keys', () => {
    const key = createScoreIdempotencyKey('obs-123', 'tool_success');
    expect(key).toBe('obs-123-tool_success');
  });

  it('should handle different observation IDs', () => {
    const key1 = createScoreIdempotencyKey('obs-1', 'score');
    const key2 = createScoreIdempotencyKey('obs-2', 'score');
    expect(key1).not.toBe(key2);
  });

  it('should handle different score names', () => {
    const key1 = createScoreIdempotencyKey('obs-1', 'score_a');
    const key2 = createScoreIdempotencyKey('obs-1', 'score_b');
    expect(key1).not.toBe(key2);
  });
});

describe('calculateSessionHealth', () => {
  it('should return healthy for 0 errors', () => {
    expect(calculateSessionHealth(0)).toBe('healthy');
  });

  it('should return degraded for 1-2 errors', () => {
    expect(calculateSessionHealth(1)).toBe('degraded');
    expect(calculateSessionHealth(2)).toBe('degraded');
  });

  it('should return unhealthy for 3+ errors', () => {
    expect(calculateSessionHealth(3)).toBe('unhealthy');
    expect(calculateSessionHealth(10)).toBe('unhealthy');
    expect(calculateSessionHealth(100)).toBe('unhealthy');
  });
});

describe('findDominantFailureMode', () => {
  it('should return undefined for empty map', () => {
    expect(findDominantFailureMode({})).toBeUndefined();
  });

  it('should return the only error type for single entry', () => {
    expect(findDominantFailureMode({ timeout: 1 })).toBe('timeout');
  });

  it('should return the error type with highest count', () => {
    expect(
      findDominantFailureMode({
        timeout: 5,
        error: 2,
        exit_code: 1,
      })
    ).toBe('timeout');
  });

  it('should return the error type with highest count when not first', () => {
    expect(
      findDominantFailureMode({
        error: 2,
        timeout: 5,
        exit_code: 1,
      })
    ).toBe('timeout');
  });

  describe('tie-breaking behavior', () => {
    it('should return alphabetically first type when counts are tied', () => {
      // Same count for timeout and error, error comes first alphabetically
      expect(
        findDominantFailureMode({
          timeout: 3,
          error: 3,
        })
      ).toBe('error');
    });

    it('should handle multiple ties correctly', () => {
      // cancelled, error, timeout all have same count - cancelled is first alphabetically
      expect(
        findDominantFailureMode({
          timeout: 2,
          error: 2,
          cancelled: 2,
        })
      ).toBe('cancelled');
    });

    it('should handle tie with permission_denied', () => {
      // error and permission_denied tied - error comes first
      expect(
        findDominantFailureMode({
          permission_denied: 5,
          error: 5,
        })
      ).toBe('error');
    });

    it('should prefer higher count over alphabetical order', () => {
      // Even though 'a_error' comes before 'z_error', z_error has higher count
      expect(
        findDominantFailureMode({
          z_error: 10,
          a_error: 5,
        })
      ).toBe('z_error');
    });

    it('should handle complex tie-breaking scenario', () => {
      // exit_code=3, error=3, timeout=2, cancelled=1
      // Tie between exit_code and error - error wins alphabetically
      expect(
        findDominantFailureMode({
          exit_code: 3,
          error: 3,
          timeout: 2,
          cancelled: 1,
        })
      ).toBe('error');
    });
  });
});
