import PocketBase from "pocketbase";
export const pb = new PocketBase(import.meta.env.VITE_API_BASE || "http://localhost:8080");

// Realtime helper (optional)
export function subscribe(collection: string, handler: (e: any) => void) {
  return pb.collection(collection).subscribe("*", handler);
}
