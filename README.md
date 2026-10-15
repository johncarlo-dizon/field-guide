# FieldGuide

Field support knowledge base: errors and procedures with text and screenshots.
This is the starter project to test the connection: browser -> Next.js API -> PostgreSQL.

## 1. Requirements
- Node.js LTS
- PostgreSQL 16 or newer (running locally for now)

## 2. Create the database (psql or pgAdmin)
```sql
CREATE USER fieldguide_app WITH PASSWORD 'choose-a-password';
CREATE DATABASE fieldguide OWNER fieldguide_app;
```

## 3. Configure
PowerShell:
```powershell
copy .env.example .env.local
```
Edit `.env.local` and set the real password in `DATABASE_URL`.

## 4. Run
```powershell
npm install
npm run dev
```
Open http://localhost:3000

You should see "Connected to database fieldguide". Type a note and press Save,
and it appears in the list (it is stored in PostgreSQL).

## Test from a phone on the same network
```powershell
npm run dev:lan
```
Then open `http://<your-pc-ip>:3000` on the phone. (Plain HTTP is fine for this
connection test. The PWA and offline mode need HTTPS later.)

## Folder guide
- `src/app/page.tsx`        the screen (frontend)
- `src/app/api/health`      checks the database connection
- `src/app/api/ping`        saves and reads test rows
- `src/lib/db.ts`           shared PostgreSQL connection pool
- `.env.local`              secrets (never commit)

## Next steps
1. Replace the test table with real migrations (users, errors, blocks).
2. Add login (name + 4-digit PIN).
3. Build the error entries and search.
