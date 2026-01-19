import { createContext, type ReactNode, useContext } from 'react';
import type { Services } from '@/app/services/services';

type ServiceProviderProps = {
  services: Services | null;
  children: ReactNode;
};

const ServiceContext = createContext<Services | null>(null);

export const ServiceProvider = ({
  services,
  children,
}: ServiceProviderProps): React.JSX.Element => {
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
};

/**
 * Get services from context.
 * Returns null on client side (data access goes through API endpoints).
 * Returns Services on server side.
 */
export const useServices = (): Services | null => {
  return useContext(ServiceContext);
};
