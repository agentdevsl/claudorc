#!/usr/bin/env bun
/**
 * Debug script to check K8s client authentication
 */

import { KubeConfig, CoreV1Api } from '@kubernetes/client-node';

const kubeconfigPath = '/Users/aarone/Documents/repos/claudorc/config';

console.log('Loading kubeconfig from:', kubeconfigPath);

const kc = new KubeConfig();
kc.loadFromFile(kubeconfigPath);

console.log('\nCurrent context:', kc.getCurrentContext());

const user = kc.getCurrentUser();
console.log('\nUser config:');
console.log('  Name:', user?.name);
console.log('  Has client-certificate-data:', !!user?.certData);
console.log('  Has client-key-data:', !!user?.keyData);
console.log('  Cert data length:', user?.certData?.length);
console.log('  Key data length:', user?.keyData?.length);

const cluster = kc.getCurrentCluster();
console.log('\nCluster config:');
console.log('  Name:', cluster?.name);
console.log('  Server:', cluster?.server);
console.log('  Has CA data:', !!cluster?.caData);
console.log('  Skip TLS verify (before):', cluster?.skipTLSVerify);

// Set skipTLSVerify for local development
if (cluster) {
  cluster.skipTLSVerify = true;
  console.log('  Skip TLS verify (after):', cluster.skipTLSVerify);
}

// Try to make an API call
console.log('\n--- Testing API call ---');
const api = kc.makeApiClient(CoreV1Api);

try {
  const result = await api.listNamespace({ limit: 1 });
  console.log('Success! Got', result.items.length, 'namespace(s)');
  console.log('First namespace:', result.items[0]?.metadata?.name);
} catch (error: any) {
  console.log('API Error:', error.message || error);
  if (error.body) {
    console.log('Body:', JSON.stringify(error.body, null, 2));
  }
}
