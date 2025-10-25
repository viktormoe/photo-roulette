import PocketBase from 'pocketbase';
export const pb = new PocketBase(import.meta.env.VITE_API_BASE || 'http://localhost:8080');

export async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); } finally { document.body.removeChild(ta); }
    return true;
  }
}

export function fileUrl(record, field) {
  const f = record && record[field];
  if (!record || !f) return '';
  return pb.getFileUrl(record, f);
}
