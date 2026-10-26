import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { parseGraphFilters, serializeGraphFilters } from '../utils/graph/graphFilterState.js';

// The filters live in the URL, so a filtered view can be shared as a link.
export const useGraphFilters = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => parseGraphFilters(searchParams), [searchParams]);

  const updateFilters = useCallback(
    (patch) => setSearchParams(serializeGraphFilters({ ...filters, ...patch }), { replace: true }),
    [filters, setSearchParams]
  );
  const clearFilters = useCallback(() => setSearchParams(new URLSearchParams(), { replace: true }), [setSearchParams]);

  return { filters, updateFilters, clearFilters };
};
