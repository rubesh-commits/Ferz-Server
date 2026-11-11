import os, uuid, shutil, sqlite3
from argon2 import PasswordHasher
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from argon2.exceptions import VerifyMismatchError
from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from PIL import Image
from pydantic import BaseModel
from pillow_heif import register_heif_opener
register_heif_opener()

app = FastAPI()
STORAGE_PATH = "storage"

DB_PATH = "app.db"
os.makedirs(STORAGE_PATH, exist_ok=True)

DEFAULT_QUOTA = 2 * 1024**3

app.add_middleware(
    SessionMiddleware,
    secret_key=os.environ["SESSION_SECRET"],
    https_only=os.environ.get("DEV") != "1",
    same_site="lax",
    max_age=60 * 60 * 24 * 14,
)
ph = PasswordHasher()
DUMMY_HASH = ph.hash("dummy-password")

def client_ip(request: Request) -> str:
    return request.headers.get("cf-connecting-ip") or (request.client.host if request.client else "unknown")

limiter = Limiter(key_func=client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

with db() as c:
    c.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY, username TEXT UNIQUE NOT NULL, pw_hash TEXT NOT NULL, is_admin INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS files (
        id INTEGER PRIMARY KEY, owner_id INTEGER NOT NULL, stored_name TEXT NOT NULL,
        original_name TEXT, uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP);
    """)

with db() as c:
    cols = [r["name"] for r in c.execute("PRAGMA table_info(users)")]
    if "quota_bytes" not in cols:
        c.execute(f"ALTER TABLE users ADD COLUMN quota_bytes INTEGER NOT NULL DEFAULT {DEFAULT_QUOTA}")
with db() as c:
    c.execute("""CREATE TABLE IF NOT EXISTS requests (
        id INTEGER PRIMARY KEY, username TEXT NOT NULL, pw_hash TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending', created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")

with db() as c:
    c.execute("""CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY, username TEXT, action TEXT NOT NULL,
        detail TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP)""")

def log(action, detail="", uid=None, username=None):
    try:
        with db() as c:
            if uid is not None and username is None:
                row = c.execute("SELECT username FROM users WHERE id=?", (uid,)).fetchone()
                username = row["username"] if row else None
            c.execute("INSERT INTO activity (username, action, detail) VALUES (?,?,?)",
                      (username, action, detail))
    except Exception:
        pass

def current_user(request: Request) -> int:
    uid = request.session.get("uid")
    if uid is None:
        raise HTTPException(401, "Not logged in")
    with db() as c:
        row = c.execute("SELECT 1 FROM users WHERE id=?", (uid,)).fetchone()
    if not row:
        request.session.clear()
        raise HTTPException(401, "Not logged in")
    return uid

def current_admin(uid: int = Depends(current_user)) -> int:
    with db() as c:
        row = c.execute("SELECT is_admin FROM users WHERE id=?", (uid,)).fetchone()
    if not row or not row["is_admin"]:
        raise HTTPException(403, "Admins only")
    return uid

@app.post("/login")
@limiter.limit("5/minute")
@limiter.limit("30/hour")
def login(request: Request, username: str = Form(...), password: str = Form(...)):
    row = db().execute("SELECT id, pw_hash FROM users WHERE username=?", (username,)).fetchone()
    ok = False
    try:
        ph.verify(row["pw_hash"] if row else DUMMY_HASH, password)
        ok = row is not None
    except VerifyMismatchError:
        pass
    if not ok:
        log("login_failed", username)
        raise HTTPException(401, "Invalid credentials")
    request.session.clear()
    request.session["uid"] = row["id"]
    log("login", uid=row["id"])
    return {"ok": True}

@app.post("/logout")
def logout(request: Request):
    log("logout", uid=request.session.get("uid"))
    request.session.clear()
    return {"ok": True}

@app.post("/request-user")
@limiter.limit("5/hour")
def request_user(request: Request, username: str = Form(...), password: str = Form(...)):
    username = username.strip()
    if not (3 <= len(username) <= 32) or len(password) < 8:
        raise HTTPException(400, "Username 3-32 characters, password at least 8 characters")
    with db() as c:
        taken = c.execute("SELECT 1 FROM users WHERE username=?", (username,)).fetchone()
        pending = c.execute("SELECT 1 FROM requests WHERE username=? AND status='pending'", (username,)).fetchone()
        if taken or pending:
            raise HTTPException(409, "Username not available")
        c.execute("INSERT INTO requests (username, pw_hash) VALUES (?,?)",
                  (username, ph.hash(password)))
    log("request_user", username, username=username)
    return {"ok": True}

@app.get("/me")
def me(uid: int = Depends(current_user)):
    row = db().execute("SELECT is_admin, quota_bytes FROM users WHERE id=?", (uid,)).fetchone()
    return {"id": uid, "is_admin": bool(row["is_admin"]),
            "quota": row["quota_bytes"], "used": user_used_bytes(uid)}

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".mp4", ".webm", ".heic", ".heif"}

def user_used_bytes(uid: int) -> int:
    d = os.path.join(STORAGE_PATH, str(uid))
    if not os.path.isdir(d):
        return 0
    return sum(e.stat().st_size for e in os.scandir(d) if e.is_file())

@app.post("/upload/")
def upload_media(file: UploadFile = File(...), uid: int = Depends(current_user)):
    with db() as c:
        quota = c.execute("SELECT quota_bytes FROM users WHERE id=?", (uid,)).fetchone()["quota_bytes"]
    used = user_used_bytes(uid)
    if used >= quota:
        raise HTTPException(413, "Storage limit reached")
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(400, "Unsupported file type")
    is_heic = ext in {".heic", ".heif"}
    if is_heic:
        ext = ".jpg"
    stored_name = f"{uuid.uuid4().hex}{ext}"
    user_dir = os.path.join(STORAGE_PATH, str(uid))
    os.makedirs(user_dir, exist_ok=True)
    path = os.path.join(user_dir, stored_name)
    if is_heic:
        Image.open(file.file).convert("RGB").save(path, "JPEG", quality=90)
    else:
        with open(path, "wb") as f:
            shutil.copyfileobj(file.file, f)
    if used + os.path.getsize(path) > quota:
      os.remove(path)
      raise HTTPException(413, "Not enough storage left")
    with db() as c:
        c.execute("INSERT INTO files (owner_id, stored_name, original_name) VALUES (?,?,?)",
                  (uid, stored_name, file.filename))
    log("upload", file.filename, uid=uid)
    return {"message": "Success", "filename": stored_name}

@app.get("/media/")
def get_media_list(uid: int = Depends(current_user)):
    rows = db().execute(
        "SELECT stored_name FROM files WHERE owner_id=? ORDER BY uploaded_at DESC, id DESC", (uid,)
    ).fetchall()
    return {"files": [r["stored_name"] for r in rows]}

@app.get("/photos/{filename}")
def get_photo(filename: str, uid: int = Depends(current_user)):
    row = db().execute("SELECT 1 FROM files WHERE owner_id=? AND stored_name=?",
                       (uid, filename)).fetchone()
    if not row:
        raise HTTPException(404)
    return FileResponse(os.path.join(STORAGE_PATH, str(uid), filename))

class NameList(BaseModel):
    names: list[str]

@app.post("/media/delete")
def delete_media(body: NameList, uid: int = Depends(current_user)):
    removed = []
    with db() as c:
        for name in body.names:
            cur = c.execute("DELETE FROM files WHERE owner_id=? AND stored_name=?", (uid, name))
            if cur.rowcount:
                removed.append(name)
    for name in removed:
        try:
            os.remove(os.path.join(STORAGE_PATH, str(uid), name))
        except FileNotFoundError:
            pass
    if removed: log("delete", f"{len(removed)} file(s)", uid=uid)
    return {"deleted": len(removed)}

@app.get("/media/info")
def media_info(uid: int = Depends(current_user)):
    rows = db().execute(
        "SELECT stored_name, original_name, uploaded_at FROM files WHERE owner_id=?", (uid,)
    ).fetchall()
    out = {}
    for r in rows:
        p = os.path.join(STORAGE_PATH, str(uid), r["stored_name"])
        out[r["stored_name"]] = {
            "name": r["original_name"],
            "uploaded": r["uploaded_at"],
            "bytes": os.path.getsize(p) if os.path.isfile(p) else None,
        }
    return {"info": out}

@app.get("/admin/users")
def admin_list_users(_: int = Depends(current_admin)):
    rows = db().execute("""
        SELECT u.id, u.username, u.is_admin, u.quota_bytes, COUNT(f.id) AS files
        FROM users u LEFT JOIN files f ON f.owner_id = u.id
        GROUP BY u.id ORDER BY u.id""").fetchall()
    out = []
    for r in rows:
        d = os.path.join(STORAGE_PATH, str(r["id"]))
        size = 0
        if os.path.isdir(d):
            size = sum(e.stat().st_size for e in os.scandir(d) if e.is_file())
        out.append({"id": r["id"], "username": r["username"],
            "is_admin": bool(r["is_admin"]), "files": r["files"],
            "bytes": size, "quota": r["quota_bytes"]})
    return {"users": out}

@app.post("/admin/users")
def admin_create_user(username: str = Form(...), password: str = Form(...),
                      is_admin: bool = Form(False), _: int = Depends(current_admin)):
    username = username.strip()
    if not username or len(password) < 8:
        raise HTTPException(400, "Username required, password at least 8 characters")
    try:
        with db() as c:
            c.execute("INSERT INTO users (username, pw_hash, is_admin) VALUES (?,?,?)",
                      (username, ph.hash(password), int(is_admin)))
    except sqlite3.IntegrityError:
        raise HTTPException(409, "Username already exists")
    log("create_user", username, uid=_)
    return {"ok": True}

@app.post("/admin/users/{user_id}/password")
def admin_reset_password(user_id: int, password: str = Form(...), _: int = Depends(current_admin)):
    if len(password) < 8:
        raise HTTPException(400, "Password must be at least 8 characters")
    with db() as c:
        cur = c.execute("UPDATE users SET pw_hash=? WHERE id=?", (ph.hash(password), user_id))
    if cur.rowcount == 0:
        raise HTTPException(404, "No such user")
    log("reset_password", f"user #{user_id}", uid=_)
    return {"ok": True}

@app.delete("/admin/users/{user_id}")
def admin_delete_user(user_id: int, admin_id: int = Depends(current_admin)):
    if user_id == admin_id:
        raise HTTPException(400, "You can't delete your own account")
    with db() as c:
        cur = c.execute("DELETE FROM users WHERE id=?", (user_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "No such user")
        c.execute("DELETE FROM files WHERE owner_id=?", (user_id,))
    shutil.rmtree(os.path.join(STORAGE_PATH, str(user_id)), ignore_errors=True)
    log("delete_user", f"user #{user_id}", uid=admin_id)
    return {"ok": True}

@app.post("/admin/users/{user_id}/quota")
def admin_set_quota(user_id: int, quota_gb: float = Form(...), _: int = Depends(current_admin)):
    if quota_gb < 0:
        raise HTTPException(400, "Quota can't be negative")
    with db() as c:
        cur = c.execute("UPDATE users SET quota_bytes=? WHERE id=?",
                        (int(quota_gb * 1024**3), user_id))
    if cur.rowcount == 0:
        raise HTTPException(404, "No such user")
    log("set_quota", f"user #{user_id}: {quota_gb} GB", uid=_)
    return {"ok": True}

@app.get("/admin/requests")
def admin_list_requests(_: int = Depends(current_admin)):
    rows = db().execute(
        "SELECT id, username, created_at FROM requests WHERE status='pending' ORDER BY id DESC"
    ).fetchall()
    return {"requests": [dict(r) for r in rows]}

@app.post("/admin/requests/{req_id}/approve")
def admin_approve_request(req_id: int, _: int = Depends(current_admin)):
    with db() as c:
        r = c.execute("SELECT username, pw_hash FROM requests WHERE id=? AND status='pending'",
                      (req_id,)).fetchone()
        if not r:
            raise HTTPException(404, "No such pending request")
        try:
            c.execute("INSERT INTO users (username, pw_hash) VALUES (?,?)",
                      (r["username"], r["pw_hash"]))
        except sqlite3.IntegrityError:
            raise HTTPException(409, "Username already exists")
        c.execute("UPDATE requests SET status='approved' WHERE id=?", (req_id,))
    log("approve_request", r["username"], uid=_)
    return {"ok": True}

@app.post("/admin/requests/{req_id}/reject")
def admin_reject_request(req_id: int, _: int = Depends(current_admin)):
    with db() as c:
        cur = c.execute("UPDATE requests SET status='rejected' WHERE id=? AND status='pending'",
                        (req_id,))
    if cur.rowcount == 0:
        raise HTTPException(404, "No such pending request")
    log("reject_request", f"request #{req_id}", uid=_)
    return {"ok": True}

@app.get("/admin/files")
def admin_list_files(_: int = Depends(current_admin)):
    rows = db().execute("""
        SELECT f.id, f.owner_id, f.stored_name, f.original_name, f.uploaded_at, u.username AS owner
        FROM files f LEFT JOIN users u ON u.id = f.owner_id
        ORDER BY f.uploaded_at DESC, f.id DESC""").fetchall()
    out = []
    for r in rows:
        p = os.path.join(STORAGE_PATH, str(r["owner_id"]), r["stored_name"])
        out.append({"id": r["id"], "name": r["original_name"] or r["stored_name"],
                    "owner": r["owner"], "uploaded": r["uploaded_at"],
                    "bytes": os.path.getsize(p) if os.path.isfile(p) else None})
    return {"files": out}

@app.get("/admin/files/{file_id}/download")
def admin_download_file(file_id: int, _: int = Depends(current_admin)):
    r = db().execute("SELECT owner_id, stored_name, original_name FROM files WHERE id=?",
                     (file_id,)).fetchone()
    if not r:
        raise HTTPException(404, "No such file")
    p = os.path.join(STORAGE_PATH, str(r["owner_id"]), r["stored_name"])
    if not os.path.isfile(p):
        raise HTTPException(404, "File missing on disk")
    base = os.path.splitext(r["original_name"] or "file")[0]
    return FileResponse(p, filename=base + os.path.splitext(r["stored_name"])[1])

@app.delete("/admin/files/{file_id}")
def admin_delete_file(file_id: int, admin_id: int = Depends(current_admin)):
    with db() as c:
        r = c.execute("SELECT owner_id, stored_name, original_name FROM files WHERE id=?",
                      (file_id,)).fetchone()
        if not r:
            raise HTTPException(404, "No such file")
        c.execute("DELETE FROM files WHERE id=?", (file_id,))
    try:
        os.remove(os.path.join(STORAGE_PATH, str(r["owner_id"]), r["stored_name"]))
    except FileNotFoundError:
        pass
    log("admin_delete_file", r["original_name"] or r["stored_name"], uid=admin_id)
    return {"ok": True}

@app.get("/admin/activity")
def admin_activity(_: int = Depends(current_admin)):
    rows = db().execute(
        "SELECT username, action, detail, created_at FROM activity ORDER BY id DESC LIMIT 200"
    ).fetchall()
    return {"activity": [dict(r) for r in rows]}

app.mount("/", StaticFiles(directory="frontend/dist", html=True), name="frontend")
