# PocketBase setup for Photo Roulette

## Run
```bash
docker compose up --build -d
```
- App: http://localhost:3000
- PocketBase Admin: http://localhost:8090/_/

## First-time setup
1. Open PocketBase Admin (http://localhost:8090/_/) and create the admin user.
2. Import schema: Settings → Import collections → upload `pocketbase/schema.json`.
3. Create an auth collection for players or use email/password via `users` collection.
4. In the web app, set `VITE_API_BASE=http://localhost:8090` (already in compose).

## Client usage examples
```ts
import { pb } from '@/integrations/pb';

// Read players
const players = await pb.collection('players').getFullList({
  filter: `room_id="${roomId}"`,
  sort: '-score'
});

// Subscribe realtime
const unsub = await pb.collection('players').subscribe('*', (e) => {
  console.log('players change', e.action, e.record);
});

// Upload photo
const formData = new FormData();
formData.append('room_id', roomId);
formData.append('player_id', playerId);
formData.append('file', fileInput.files[0]);
await pb.collection('photos').create(formData);
```

## Notes
- PocketBase stores files on disk under `pb_data/`.
- Use `pb.getFileUrl(record, record.file)` to render an image.
- For production, put PocketBase behind a reverse proxy with HTTPS.
