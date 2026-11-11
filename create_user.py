import sys, sqlite3
from argon2 import PasswordHasher
u, p = sys.argv[1], sys.argv[2]
c = sqlite3.connect("app.db")
admin = 1 if len(sys.argv) > 3 and sys.argv[3] == "admin" else 0
c.execute("INSERT INTO users (username, pw_hash, is_admin) VALUES (?,?,?)", (u, PasswordHasher().hash(p), admin))
c.commit()