import PocketBase from 'pocketbase';
export const pb = new PocketBase(import.meta.env.VITE_API_BASE || 'http://localhost:8090');

// Helper: subscribe to collection changes
export function subscribe(collection, handler) {
  return pb.collection(collection).subscribe('*', handler);
}
