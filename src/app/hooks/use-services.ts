import type { Services } from '@/app/services/services';

// Client mode - services are undefined, all data access goes through API endpoints
// This is a marker type for client-side rendering where services are not available
type ClientModeServices = Partial<Services> & { isClientMode: true };

const clientServices: ClientModeServices = {
  isClientMode: true,
};

export function useServiceSnapshot(): ClientModeServices | Services {
  return clientServices;
}
