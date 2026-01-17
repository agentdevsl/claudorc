import { createContext, useContext, type ReactNode } from 'react';
import type { Services } from '@/app/services/services';

type ServiceProviderProps = {
  services: Services;
  children: ReactNode;
};

const ServiceContext = createContext<Services | null>(null);

export const ServiceProvider = ({ services, children }: ServiceProviderProps) => {
  return <ServiceContext.Provider value={services}>{children}</ServiceContext.Provider>;
};

export const useServices = (): Services => {
  const services = useContext(ServiceContext);
  if (!services) {
    throw new Error('useServices must be used within ServiceProvider');
  }
  return services;
};
