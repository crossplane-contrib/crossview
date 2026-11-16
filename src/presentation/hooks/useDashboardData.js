import { createContext, useState, useEffect } from 'react';
import { GetCompositeResourcesUseCase } from '../../domain/usecases/GetCompositeResourcesUseCase.js';
import { GetClaimsUseCase } from '../../domain/usecases/GetClaimsUseCase.js';

export const DashboardDataContext = createContext(null);

const emptyResult = (loading) => ({ items: [], loading, error: null });

export const useDashboardData = (kubernetesRepository, selectedContext) => {
  const context = typeof selectedContext === 'string' ? selectedContext : selectedContext?.name;
  const [state, setState] = useState(null);

  useEffect(() => {
    let active = true;
    if (!context) {
      return () => { active = false; };
    }

    setState({
      context,
      repository: kubernetesRepository,
      compositeResources: emptyResult(true),
      claims: emptyResult(true),
    });

    const load = async (key, UseCase) => {
      let result;
      try {
        const response = await new UseCase(kubernetesRepository).execute(context, null, null);
        result = { items: Array.isArray(response) ? response : response.items, loading: false, error: null };
      } catch (error) {
        console.warn(`Failed to fetch dashboard ${key}:`, error.message);
        result = { items: [], loading: false, error: error.message };
      }
      if (active) {
        setState(previous => ({ ...previous, [key]: result }));
      }
    };

    load('compositeResources', GetCompositeResourcesUseCase);
    load('claims', GetClaimsUseCase);

    return () => { active = false; };
  }, [context, kubernetesRepository]);

  if (state?.context !== context || state?.repository !== kubernetesRepository || !context) {
    return {
      compositeResources: emptyResult(Boolean(context)),
      claims: emptyResult(Boolean(context)),
    };
  }
  return state;
};
