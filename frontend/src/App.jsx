import { useState, useEffect, useRef } from 'react';
import Admin from './Admin';
import StarSky from './StarSky';

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const NAV_ICONS = {
  all: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  photos: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></>,
  videos: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9.5l5 2.5-5 2.5z" /></>,
};

export default function App() {
  const [media, setMedia] = useState([]);
  const [selected, setSelected] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [authed, setAuthed] = useState(null); 
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [me, setMe] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [checked, setChecked] = useState([]);
  const [info, setInfo] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [mode, setMode] = useState("login");
  const [reqUser, setReqUser] = useState("");
  const [reqPass, setReqPass] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqDone, setReqDone] = useState(false);
  const [view, setView] = useState("grid");
  const [section, setSection] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const touchStart = useRef(0);

  const API_URL = ""; 

  const fetchMedia = () => {
    fetch(`${API_URL}/media/`)
      .then((res) => {
        if (res.status === 401) { setAuthed(false); return null; }
        return res.json();
      })
      .then((data) => { if (data) setMedia(data.files); })
      .catch((err) => console.error("Failed to fetch media:", err));
    fetch(`${API_URL}/media/info`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setInfo(d.info); }).catch(() => {});
    fetch(`${API_URL}/me`).then((r) => (r.ok ? r.json() : null))
      .then((d) => { if (d) setMe(d); }).catch(() => {});
  };

  useEffect(() => {
    fetch(`${API_URL}/me`)
      .then(async (res) => {
        setAuthed(res.ok);
        if (res.ok) { setMe(await res.json()); fetchMedia(); }
      })
      .catch(() => setAuthed(false));
  }, []);

  const handleUpload = async (event) => {
    const input = event.target;
    const files = Array.from(input.files);
    if (!files.length) return;

    setIsUploading(true);
    for (const file of files) {
      const formData = new FormData();
      formData.append("file", file);
      try {
        const response = await fetch(`${API_URL}/upload/`, {
          method: 'POST',
          body: formData,
        });
        if (response.status === 401) { setAuthed(false); break; }
        if (!response.ok) alert(`Upload failed: ${file.name}`);
      } catch (error) {
        console.error("Upload error:", error);
      }
    }
    fetchMedia();
    setIsUploading(false);
    input.value = "";
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch(`${API_URL}/login`, {
        method: 'POST',
        body: new URLSearchParams({ username, password }),
      });
      if (res.ok) {
        setPassword("");
        setAuthed(true);
        fetch(API_URL + "/me").then((r) => r.json()).then(setMe).catch(() => {});
        fetchMedia();
      } else if (res.status === 401) {
        setLoginError("Invalid username or password");
      } else if (res.status === 429) {
        setLoginError("Too many attempts. Wait a minute and try again.");
      } else {
        setLoginError(`Server error (${res.status})`);
      }
    } catch {
      setLoginError("Could not reach the server");
    }
  };

  const handleRequest = async (e) => {
    e.preventDefault();
    setReqError("");
    try {
      const res = await fetch(`${API_URL}/request-user`, {
        method: "POST",
        body: new URLSearchParams({ username: reqUser, password: reqPass }),
      });
      if (res.ok) { setReqDone(true); setReqPass(""); }
      else if (res.status === 409) setReqError("That username isn't available.");
      else if (res.status === 429) setReqError("Too many requests. Try again later.");
      else if (res.status === 400) setReqError("Username 3–32 characters, password at least 8.");
      else setReqError(`Server error (${res.status})`);
    } catch { setReqError("Could not reach the server"); }
  };

  const backToLogin = () => { setMode("login"); setReqDone(false); setReqError(""); setReqUser(""); setReqPass(""); };

  const handleLogout = async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST' });
    setAuthed(false);
    setMe(null); setShowAdmin(false);
    setMedia([]);
    setSelected(null);
  };

  const toggleCheck = (file) =>
  setChecked((prev) => (prev.includes(file) ? prev.filter((f) => f !== file) : [...prev, file]));

  const fmtSize = (b) =>
    b == null ? "unknown" : b > 1e9 ? (b / 1e9).toFixed(1) + " GB" : b > 1e6 ? (b / 1e6).toFixed(1) + " MB" : Math.round(b / 1e3) + " KB";

  const handleDeleteChecked = async () => {
    setConfirmOpen(false);
    const res = await fetch(API_URL + "/media/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ names: checked }),
    });
    if (res.status === 401) { setAuthed(false); return; }
    if (!res.ok) { alert("Delete failed."); return; }
    setChecked([]);
    setInfo(null);
    fetchMedia();
  };

  const handleDetails = async () => {
    const res = await fetch(API_URL + "/media/info");
    if (!res.ok) return;
    setInfo((await res.json()).info);
    setDetailsOpen(true);
  };

  const isVideo = (filename) => /\.(mp4|webm|ogg|mov)$/i.test(filename);
  const fmtStore = (b) =>
    b == null ? "-" : b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + " GB" :
    b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";
  const nameOf = (f) => info?.[f]?.name || f;
  const counts = {
    all: media.length,
    photos: media.filter((f) => !isVideo(f)).length,
    videos: media.filter((f) => isVideo(f)).length,
  };
  const idx = (f) => media.indexOf(f);
  const shown = media
    .filter((f) => section === "all" || (section === "videos") === isVideo(f))
    .filter((f) => nameOf(f).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "oldest" ? idx(b) - idx(a) :
      sort === "name" ? nameOf(a).localeCompare(nameOf(b)) :
      sort === "size" ? (info?.[b]?.bytes || 0) - (info?.[a]?.bytes || 0) :
      idx(a) - idx(b));
  const pct = me?.quota ? Math.min(100, (me.used / me.quota) * 100) : 0;

  const selIdx = selected ? shown.indexOf(selected) : -1;
  const go = (d) => { const n = shown[selIdx + d]; if (n) setSelected(n); };

  useEffect(() => {
    if (!selected) return;
    const onKey = (e) => {
      if (e.key === "ArrowRight") go(1);
      else if (e.key === "ArrowLeft") go(-1);
      else if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (authed === null) return null;
  if (!authed) {
    return (
      <div
        className="relative min-h-screen text-white flex items-center justify-center p-4 overflow-hidden"
        style={{ background: 'linear-gradient(to bottom, #15151c 0%, #1b1a33 45%, #2b2260 100%)' }}
      >
        <StarSky />
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="relative z-10 w-full max-w-sm bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 space-y-4 shadow-2xl">
            <h1 className="text-center text-4xl font-serif">Ferz Space</h1>
            <p className="text-center text-sm text-neutral-400 pb-2">Sign in to your private storage.</p>
            <input
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400/60"
              placeholder="Username" autoComplete="username"
              value={username} onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400/60"
              placeholder="Password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)}
            />
            {loginError && <p className="text-sm text-red-400">{loginError}</p>}
            <button className="w-full bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b] text-neutral-900 hover:brightness-105 transition font-medium py-3 rounded-xl">
              Log in
            </button>
            <button type="button" onClick={() => setMode("request")}
              className="w-full text-sm text-neutral-400 hover:text-white transition-colors pt-1">
              Create user
            </button>
          </form>
        ) : (
        <form onSubmit={handleRequest} className="relative z-10 w-full max-w-sm bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 space-y-4 shadow-2xl">
          <h1 className="text-center text-4xl font-serif">Create user</h1>
          {reqDone ? (
            <>
              <p className="text-center text-sm text-neutral-300 py-4">
                Request sent. The admin will review it and set up your account.
              </p>
              <button type="button" onClick={backToLogin}
                className="w-full text-sm text-neutral-400 hover:text-white transition-colors">
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <p className="text-center text-sm text-neutral-400 pb-2">Choose the username and password you want.</p>
              <input
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400/60"
                placeholder="Username" autoComplete="off"
                value={reqUser} onChange={(e) => setReqUser(e.target.value)}
              />
              <input
                type="password"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400/60"
                placeholder="Password (min 8 characters)" autoComplete="new-password"
                value={reqPass} onChange={(e) => setReqPass(e.target.value)}
              />
              {reqError && <p className="text-sm text-red-400">{reqError}</p>}
              <button className="w-full bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b] text-neutral-900 hover:brightness-105 transition font-medium py-3 rounded-xl">
                Request
              </button>
              <button type="button" onClick={backToLogin}
                className="w-full text-sm text-neutral-400 hover:text-white transition-colors pt-1">
                Back to sign in
              </button>
            </>
          )}
        </form>
        )}
      </div>
    );
  }

  if (showAdmin) return <Admin onBack={() => setShowAdmin(false)} />;

  return (
    <div className="min-h-screen bg-[#14151f] text-white font-sans flex">
      <nav className="hidden md:flex sticky top-0 self-start h-screen w-64 shrink-0 flex-col p-4 border-r border-white/10 bg-black/10">
        <h1 className="text-2xl font-serif px-2 mb-4">Ferz Space</h1>
        <label className="cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b] text-neutral-900 text-base font-medium py-3 rounded-xl mb-4 hover:brightness-105 transition">
          <Icon><path d="M12 5v14M5 12h14" /></Icon>
          {isUploading ? "Uploading..." : "New upload"}
          <input type="file" multiple className="hidden" accept="image/*,video/*"
            onChange={handleUpload} disabled={isUploading} />
        </label>
        {[["all", "All"], ["photos", "Photos"], ["videos", "Videos"]].map(([k, label]) => (
          <button key={k} onClick={() => setSection(k)}
            className={"flex justify-between items-center px-3 py-3 rounded-xl text-base transition-colors " +
              (section === k ? "bg-white/10 text-white" : "text-neutral-400 hover:bg-white/5 hover:text-white")}>
            <span className="flex items-center gap-3"><Icon>{NAV_ICONS[k]}</Icon>{label}</span>
            <span className="text-sm">{counts[k]}</span>
          </button>
        ))}
        <div className="mt-auto bg-white/5 border border-white/10 rounded-2xl p-4">
          <div className="text-sm font-medium mb-3">{media.length} items stored</div>
          <div className="h-2 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[#e8b9a0] transition-all duration-500" style={{ width: pct + "%" }} />
          </div>
          <p className="text-sm text-neutral-400 mt-3">{fmtStore(me?.used)} of {fmtStore(me?.quota)} used.</p>
        </div>
      </nav>
      <div className="flex-1 min-w-0 p-4 sm:p-8">
        <header className="mb-4 space-y-3">
          <div className="flex items-center justify-between md:hidden">
            <h1 className="text-2xl font-serif">Ferz Space</h1>
            <div className="flex items-center gap-4 text-sm text-neutral-400">
              {me?.is_admin && <button onClick={() => setShowAdmin(true)} className="hover:text-white">Admin</button>}
              <button onClick={handleLogout} className="hover:text-white">Log out</button>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search files"
              className="flex-1 min-w-0 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none focus:ring-2 focus:ring-[#e8b9a0]/60" />
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="bg-white/5 border border-white/10 rounded-xl px-2 sm:px-3 py-2.5 text-base sm:text-sm outline-none">
              <option value="newest" className="bg-neutral-900">Newest</option>
              <option value="oldest" className="bg-neutral-900">Oldest</option>
              <option value="name" className="bg-neutral-900">Name</option>
              <option value="size" className="bg-neutral-900">Size</option>
            </select>
            <button onClick={() => setView(view === "grid" ? "list" : "grid")}
              className="bg-white/5 border border-white/10 rounded-xl px-3 sm:px-4 py-2.5 text-sm hover:bg-white/10 transition-colors">
              {view === "grid" ? "List" : "Grid"}
            </button>
            {me?.is_admin && (
              <button onClick={() => setShowAdmin(true)} className="hidden md:block text-sm text-neutral-400 hover:text-white transition-colors">Admin</button>
            )}
            <button onClick={handleLogout} className="hidden md:block text-sm text-neutral-400 hover:text-white transition-colors">Log out</button>
          </div>
        </header>

        <div className="flex gap-2 mb-4 md:hidden">
          {[["all", "All"], ["photos", "Photos"], ["videos", "Videos"]].map(([k, label]) => (
            <button key={k} onClick={() => setSection(k)}
              className={"px-4 py-2 rounded-full text-sm " + (section === k ? "bg-white/15" : "bg-white/5 text-neutral-400")}>
              {label} {counts[k]}
            </button>
          ))}
        </div>
        <div className="md:hidden mb-4 text-xs text-neutral-400">
          {fmtStore(me?.used)} of {fmtStore(me?.quota)} used
          <div className="h-1 mt-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full bg-[#e8b9a0]" style={{ width: pct + "%" }} />
          </div>
        </div>

        <div className={"overflow-hidden transition-all duration-300 " + (checked.length ? "max-h-32 mb-4 opacity-100" : "max-h-0 opacity-0")}>
          <div className="flex flex-wrap items-center gap-4 bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl px-5 py-3 shadow-lg [&_button]:py-1.5 gap-y-1">
            <span className="text-sm text-neutral-300">{checked.length} selected</span>
            <button
              onClick={() => setChecked(checked.length === shown.length ? [] : [...media])}
              className="text-sm text-pink-400 hover:text-pink-300"
            >
              {checked.length === media.length ? "Deselect all" : "Select all"}
            </button>
            <button onClick={handleDetails} className="text-sm text-neutral-300 hover:text-white">Details</button>
            <button onClick={() => setConfirmOpen(true)} className="text-sm text-red-400 hover:text-red-300">Delete</button>
            <button onClick={() => setChecked([])} className="ml-auto text-sm text-neutral-400 hover:text-white">Cancel</button>
          </div>
        </div>
        
        {shown.length === 0 ? (
            <p className="text-sm text-neutral-500 py-10 text-center">
              {media.length === 0 ? "Nothing here yet. Upload some photos or videos." : "No matches."}
            </p>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 sm:gap-4 auto-rows-[200px] sm:auto-rows-[240px]">
              {shown.map((file) => (
                <div key={file}
                  className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-white/5 transition-all hover:scale-[1.02] hover:shadow-2xl hover:border-purple-400/50 flex flex-col"
                  onClick={() => setSelected(file)}>
                  {checked.includes(file) && (
                    <div className="absolute inset-0 rounded-2xl ring-2 ring-inset ring-purple-400 pointer-events-none z-10" />
                  )}
                  <button type="button" aria-label="Select"
                    onClick={(e) => { e.stopPropagation(); toggleCheck(file); }}
                    className={"absolute top-2 left-2 z-20 h--8 w-8 sm:h-6 sm:w-6 rounded-full border-2 flex items-center justify-center transition-all " +
                      (checked.includes(file)
                        ? "bg-purple-500 border-purple-500"
                        : "bg-black/40 border-white/70 backdrop-blur-sm hover:border-white hover:bg-black/60")}>
                    {checked.includes(file) && (
                      <svg viewBox="0 0 24 24" className="h-4 w-4 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                  <div className="flex-1 min-h-0">
                    {isVideo(file) ? (
                      <video src={`${API_URL}/photos/${file}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" muted preload="metadata" />
                    ) : (
                      <img src={`${API_URL}/photos/${file}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" />
                    )}
                  </div>
                  <div className="px-3 py-2 bg-black/20">
                    <div className="text-sm truncate">{nameOf(file)}</div>
                    <div className="text-xs text-neutral-400">{fmtSize(info?.[file]?.bytes)}</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
              {shown.map((file) => (
                <div key={file} onClick={() => setSelected(file)}
                  className={"flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/5 " +
                    (checked.includes(file) ? "bg-white/10" : "")}>
                  <button type="button" aria-label="Select"
                    onClick={(e) => { e.stopPropagation(); toggleCheck(file); }}
                    className={"h-5 w-5 shrink-0 rounded-full border-2 flex items-center justify-center " +
                      (checked.includes(file) ? "bg-purple-500 border-purple-500" : "border-white/50 hover:border-white")}>
                    {checked.includes(file) && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                  {isVideo(file) ? (
                    <video src={`${API_URL}/photos/${file}`} className="h-10 w-10 rounded-lg object-cover shrink-0" muted preload="metadata" />
                  ) : (
                    <img src={`${API_URL}/photos/${file}`} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" />
                  )}
                  <div className="min-w-0 flex-1 truncate text-sm">{nameOf(file)}</div>
                  <div className="text-xs text-neutral-400 w-20 text-right">{fmtSize(info?.[file]?.bytes)}</div>
                  <div className="hidden sm:block text-xs text-neutral-500 w-44 text-right">
                    {info?.[file]?.uploaded ? new Date(info[file].uploaded.replace(" ", "T") + "Z").toLocaleString() : ""}
                  </div>
                </div>
              ))}
            </div>
        )}
      </div>
      <aside className={"fixed bottom-0 inset-x-0 z-40 transition-transform duration-300 " +
        (detailsOpen ? "translate-y-0" : "translate-y-full") +
        " md:sticky md:top-0 md:inset-auto md:self-start md:h-screen md:shrink-0 md:overflow-hidden md:translate-y-0 md:transition-all " +
        (detailsOpen ? "md:w-80" : "md:w-0")}>
        <div className="w-full md:w-80 h-full p-4">
          <div className="h-full overflow-y-auto bg-[#1b1c28] md:bg-white/5 border border-white/10 backdrop-blur-xl rounded-2xl shadow-lg p-5 max-h-[70vh] md:max-h-none">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">Details</h2>
              <button onClick={() => setDetailsOpen(false)} className="text-neutral-400 hover:text-white text-2xl leading-none">&times;</button>
            </div>
            {checked.length === 0 ? (
              <p className="text-sm text-neutral-500">Tick items to see their details.</p>
            ) : (
              <>
                <p className="text-sm text-neutral-400 mb-3">
                  {checked.length} item(s), {fmtSize(checked.reduce((s, f) => s + (info?.[f]?.bytes || 0), 0))} total
                </p>
                <ul className="space-y-3">
                  {checked.map((f) => {
                    const i = info?.[f] || {};
                    return (
                      <li key={f} className="text-sm border-t border-neutral-800 pt-3">
                        <div className="font-medium break-all">{i.name || f}</div>
                        <div className="text-neutral-400">{isVideo(f) ? "Video" : "Photo"} · {fmtSize(i.bytes)}</div>
                        <div className="text-neutral-500">
                          {i.uploaded ? new Date(i.uploaded.replace(" ", "T") + "Z").toLocaleString() : ""}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}
          </div>
        </div>
      </aside>

      <label className="md:hidden fixed bottom-5 right-5 z-40 h-14 w-14 rounded-2xl bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b] text-neutral-900 text-3xl flex items-center justify-center shadow-xl cursor-pointer">
        +
        <input type="file" multiple className="hidden" accept="image/*,video/*"
          onChange={handleUpload} disabled={isUploading} />
      </label>

      {selected && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md transition-opacity"
          onClick={() => setSelected(null)}
          onTouchStart={(e) => { touchStart.current = e.touches[0].clientX; }}
          onTouchEnd={(e) => {
            const dx = e.changedTouches[0].clientX - touchStart.current;
            if (!isVideo(selected) && Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
          }}

        >
          <div className="relative w-full max-w-5xl max-h-full flex justify-center items-center" onClick={(e) => e.stopPropagation()}>
            <button 
              className="fixed top-3 right-3 z-10 h-11 w-11 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white text-3xl leading-none"
              onClick={() => setSelected(null)}
            >
              &times;
            </button>

            {isVideo(selected) ? (
              <video src={`${API_URL}/photos/${selected}`} controls autoPlay className="max-h-[80dvh] max-w-full rounded-lg shadow-2xl ring-1 ring-white/10" />
            ) : (
              <img src={`${API_URL}/photos/${selected}`} className="max-h-[80dvh] max-w-full rounded-lg shadow-2xl ring-1 ring-white/10 object-contain" />
            )}
          </div>
          {selIdx > 0 && (
            <button aria-label="Previous" onClick={(e) => { e.stopPropagation(); go(-1); }}
              className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white flex items-center justify-center transition-colors">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 6l-6 6 6 6" /></svg>
            </button>
          )}
          {selIdx >= 0 && selIdx < shown.length - 1 && (
            <button aria-label="Next" onClick={(e) => { e.stopPropagation(); go(1); }}
              className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-white/10 hover:bg-white/20 backdrop-blur-sm text-white flex items-center justify-center transition-colors">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          )}
          {selIdx >= 0 && (
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-xs text-white/60">
              {selIdx + 1} / {shown.length}
            </div>
          )}
        </div>
      )}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmOpen(false)}>
          <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-2">Delete {checked.length} item{checked.length === 1 ? "" : "s"}?</h2>
            <p className="text-sm text-neutral-400 mb-6">This permanently removes them from the server. This can’t be undone.</p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setConfirmOpen(false)} className="px-4 py-2 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">Cancel</button>
              <button onClick={handleDeleteChecked} className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 hover:bg-red-500 transition-colors">Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
