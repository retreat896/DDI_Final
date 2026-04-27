/**
 * useServerConfig – fetches /api/config once and caches the result.
 *
 * Returns { steamApiEnabled: boolean, loading: boolean }
 *
 * Usage:
 *   const { steamApiEnabled } = useServerConfig();
 */
import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE ?? 'http://localhost:5000';

let _cache = null; // module-level cache so it's only fetched once

export function useServerConfig() {
  const [config, setConfig]   = useState(_cache);
  const [loading, setLoading] = useState(!_cache);

  useEffect(() => {
    if (_cache) return; // already fetched
    fetch(`${API_BASE}/api/config`)
      .then(r => r.json())
      .then(data => {
        _cache = data;
        setConfig(data);
      })
      .catch(() => {
        // On error assume all features available (fail-open)
        _cache = { steam_api_enabled: true };
        setConfig(_cache);
      })
      .finally(() => setLoading(false));
  }, []);

  return {
    steamApiEnabled: config?.steam_api_enabled ?? true,
    loading,
  };
}
