import type { Services } from '@/app/services/services';

// Client mode services - all data access goes through API endpoints
const clientServices: Services = {
  isClientMode: true,
};

export function useServiceSnapshot(): Services {
  return clientServices;
}
