// src/hooks/useCsvData.js
// Fetches the processed CSV session from /api/csv-session,
// caches it in module scope (only one fetch per page load),
// and exposes the enriched rows + session summary.

import { useState, useEffect } from 'react';

let _cache = null;   // module-level cache
let _promise = null; // deduplicate concurrent fetches

async function fetchCsvSession(serverIp = 'localhost') {
  if (_cache) return _cache;
  if (!_promise) {
    _promise = fetch(`http://${serverIp}:3001/api/csv-session`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { _cache = data; return data; })
      .catch(err => {
        _promise = null; // allow retry on next call
        throw err;
      });
  }
  return _promise;
}

/**
 * @param {string} serverIp  – IP of the BioPulse backend (default: localhost)
 * @returns {{ rows, summary, loading, error }}
 *   rows    – array of enriched reading objects (filtered, with all 16 ML features)
 *   summary – session-level averages and label counts
 */
export function useCsvData(serverIp = 'localhost') {
  const [state, setState] = useState({
    rows: [],
    summary: null,
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    fetchCsvSession(serverIp)
      .then(data => {
        if (!cancelled) {
          setState({ rows: data.rows ?? [], summary: data.summary ?? null, loading: false, error: null });
        }
      })
      .catch(err => {
        if (!cancelled) {
          setState(s => ({ ...s, loading: false, error: err.message }));
        }
      });

    return () => { cancelled = true; };
  }, [serverIp]);

  return state;
}

/** Force re-fetch on next call (e.g., after new data arrives). */
export function invalidateCsvCache() {
  _cache = null;
  _promise = null;
}
