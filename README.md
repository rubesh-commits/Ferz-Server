# Ferz Space

A private, self-hosted cloud drive for photos and videos. Each user gets their own storage space, and an admin console manages accounts.

## Features

- Per-user login, with login rate limiting
- Upload photos and videos (HEIC is converted to JPEG)
- Search, sort, grid and list views, and a photo and video viewer
- Multi-select with details and delete
- Storage quota per user, set by the admin
- Create-user requests that an admin approves or rejects
- Admin console: users, all files, requests and an activity log

## Stack

- Backend: FastAPI, SQLite, Argon2 password hashing
- Frontend: React (Vite) and Tailwind CSS

## Run locally

```bash
# frontend
cd frontend
npm install
npm run build
cd ..

# backend
pip install fastapi uvicorn argon2-cffi slowapi pillow pillow-heif python-multipart itsdangerous
DEV=1 SESSION_SECRET="change-me" uvicorn main:app --host 127.0.0.1 --port 8000
```

Open `http://localhost:8000`. Use `create_user.py` to create the first admin account.

## Configuration

| Variable | Purpose |
|----------|---------|
| `SESSION_SECRET` | Required. A long random string used to sign sessions. |
| `DEV` | Set to `1` only for local HTTP testing. Leave unset in production. |

## Notes

- Uploads are stored in `storage/` and data in `app.db`.
