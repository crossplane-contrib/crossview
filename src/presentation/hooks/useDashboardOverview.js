import { useCallback } from 'react';
import { GetDashboardOverviewUseCase } from '../../domain/usecases/GetDashboardOverviewUseCase.js';
import { useCachedSnapshot } from './useCachedSnapshot.js';

export const useDashboardOverview = (kubernetesRepository, selectedContext) => {
  const contextName = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name;
  const load = useCallback(() => new GetDashboardOverviewUseCase(kubernetesRepository).execute(contextName),
    [kubernetesRepository, contextName]);
  return useCachedSnapshot(kubernetesRepository, contextName ? `dashboard:${contextName}` : null, load);
};
