import { useState, useEffect, useRef } from 'react';
import Admin from './Admin';
import Profile from './Profile';
import { hubUrl, loginUrl } from './config';

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0" fill="none" stroke="currentColor"
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);
const NAV_ICONS = {
  all: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></>,
  photos: <><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="M21 16l-5-5-8 8" /></>,
  videos: <><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M10 9.5l5 2.5-5 2.5z" /></>,
  documents: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5" /><path d="M9 13h6M9 17h4" /></>,
};

const UPLOAD_ACCEPT = "image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.odt";

const extOf = (name) => {
  const match = /\.([^.]+)$/.exec(name || "");
  return match ? match[1].toUpperCase() : "FILE";
};

function DocumentPreview({ name, small = false }) {
  return (
    <div className={"flex h-full w-full flex-col items-center justify-center bg-gradient-to-br from-[#232436] to-[#191a26] text-neutral-400 " +
      (small ? "gap-0" : "gap-3")}>
      <svg viewBox="0 0 24 24" className={small ? "h-5 w-5" : "h-12 w-12"} fill="none" stroke="currentColor"
        strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
        <path d="M9 13h6M9 17h4" />
      </svg>
      {!small && (
        <span className="rounded-md border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] tracking-wide text-neutral-300">
          {extOf(name)}
        </span>
      )}
    </div>
  );
}

const API_URL = "";
const IDLE_UPLOAD = { state: "idle", progress: 0, index: 0, total: 0, name: "", failed: 0 };

const uploadFile = (file, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/upload/`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(e.loaded);
    };
    xhr.onload = () => {
      if (xhr.status === 401) {
        reject(Object.assign(new Error("Not logged in"), { unauthorized: true }));
      } else if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        let detail = `Upload failed (${xhr.status})`;
        try {
          const body = JSON.parse(xhr.responseText);
          if (body.detail) detail = body.detail;
        } catch { /* not JSON */ }
        reject(new Error(`${file.name}: ${detail}`));
      }
    };
    xhr.onerror = () => reject(new Error(`${file.name}: network error`));
    xhr.onabort = () => reject(new Error(`${file.name}: upload cancelled`));
    const formData = new FormData();
    formData.append("file", file);
    xhr.send(formData);
  });

function UploadBar({ upload }) {
  const active = upload.state !== "idle";
  const done = upload.state === "done";
  const failed = done && upload.failed > 0;
  const label = done
    ? failed
      ? `Upload finished — ${upload.failed} of ${upload.total} failed`
      : `Uploaded ${upload.total} file${upload.total === 1 ? "" : "s"}`
    : upload.total > 1
      ? `Uploading ${upload.index} of ${upload.total} — ${upload.name}`
      : `Uploading ${upload.name}`;

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] flex justify-center px-4">
      <div
        role="status"
        aria-live="polite"
        aria-hidden={!active}
        className={"w-full max-w-sm overflow-hidden rounded-full border border-white/10 bg-[#1b1a26]/95 shadow-xl shadow-black/50 backdrop-blur-xl transition-transform duration-500 ease-out " +
          (active ? "translate-y-3" : "-translate-y-[150%]")}
      >
        <div className="px-3.5 pb-2.5 pt-2">
          <div className="flex items-center gap-2 text-xs">
            {done ? (
              failed ? (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-red-400" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16h.01" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 text-emerald-400" fill="none"
                  stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              )
            ) : (
              <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 shrink-0 animate-spin text-[#e8b9a0]" fill="none"
                stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="9" opacity="0.25" />
                <path d="M21 12a9 9 0 0 0-9-9" />
              </svg>
            )}
            <span className="min-w-0 flex-1 truncate text-neutral-200">{label}</span>
            <span className="shrink-0 tabular-nums text-neutral-400">{Math.round(upload.progress)}%</span>
          </div>
          <div className="mt-1.5 h-1 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={"h-full rounded-full transition-[width] duration-150 ease-out " +
                (failed ? "bg-red-400" : "bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b]")}
              style={{ width: `${upload.progress}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [media, setMedia] = useState([]);
  const [selected, setSelected] = useState(null);
  const [previewError, setPreviewError] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [upload, setUpload] = useState(IDLE_UPLOAD);
  const [authed, setAuthed] = useState(null);
  const [me, setMe] = useState(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [checked, setChecked] = useState([]);
  const [info, setInfo] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [view, setView] = useState("grid");
  const [section, setSection] = useState("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("newest");
  const touchStart = useRef(0);
  const uploadTimer = useRef(null);

  const redirectToLogin = () => window.location.replace(loginUrl());

  const fetchMedia = () => {
    fetch(`${API_URL}/media/`)
      .then((res) => {
        if (res.status === 401) { setAuthed(false); redirectToLogin(); return null; }
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
        if (!res.ok) { setAuthed(false); redirectToLogin(); return; }
        setAuthed(true);
        setMe(await res.json());
        fetchMedia();
      })
      .catch(() => { setAuthed(false); redirectToLogin(); });
  }, []);

  useEffect(() => () => clearTimeout(uploadTimer.current), []);

  const handleUpload = async (event) => {
    const input = event.target;
    const files = Array.from(input.files);
    if (!files.length) return;

    if (uploadTimer.current) {
      clearTimeout(uploadTimer.current);
      uploadTimer.current = null;
    }

    const totalBytes = files.reduce((sum, f) => sum + f.size, 0) || 1;
    let completedBytes = 0;
    let failed = 0;

    setIsUploading(true);
    setUpload({ state: "active", progress: 0, index: 1, total: files.length, name: files[0].name, failed: 0 });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUpload((u) => ({ ...u, index: i + 1, name: file.name }));
      try {
        await uploadFile(file, (loaded) => {
          const done = completedBytes + Math.min(loaded, file.size);
          setUpload((u) => ({ ...u, progress: Math.min(99, (done / totalBytes) * 100) }));
        });
      } catch (error) {
        if (error?.unauthorized) {
          setIsUploading(false);
          input.value = "";
          setAuthed(false);
          redirectToLogin();
          return;
        }
        failed += 1;
        console.error("Upload error:", error);
        alert(error?.message || `Upload failed: ${file.name}`);
      } finally {
        completedBytes += file.size;
        setUpload((u) => ({ ...u, progress: Math.min(99, (completedBytes / totalBytes) * 100) }));
      }
    }

    fetchMedia();
    setUpload((u) => ({ ...u, state: "done", progress: 100, failed }));
    uploadTimer.current = setTimeout(() => setUpload(IDLE_UPLOAD), 1800);
    setIsUploading(false);
    input.value = "";
  };

  const handleLogout = async () => {
    await fetch(`${API_URL}/logout`, { method: 'POST' });
    window.location.assign(hubUrl());
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
    if (res.status === 401) { setAuthed(false); redirectToLogin(); return; }
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
  const isImage = (filename) => /\.(jpe?g|png|webp|heic|heif|gif|avif)$/i.test(filename);
  const isDocument = (filename) => !isVideo(filename) && !isImage(filename);
  const isPreviewable = (filename) => /\.(pdf|doc|docx)$/i.test(filename);
  const kindOf = (filename) => (isVideo(filename) ? "Video" : isImage(filename) ? "Photo" : "Document");
  const matchesSection = (filename) =>
    section === "all" ? true :
    section === "videos" ? isVideo(filename) :
    section === "documents" ? isDocument(filename) :
    isImage(filename);
  const fmtStore = (b) =>
    b == null ? "-" : b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(2) + " GB" :
    b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + " MB" : Math.round(b / 1024) + " KB";
  const nameOf = (f) => info?.[f]?.name || f;
  const counts = {
    all: media.length,
    photos: media.filter(isImage).length,
    videos: media.filter(isVideo).length,
    documents: media.filter(isDocument).length,
  };
  const idx = (f) => media.indexOf(f);
  const shown = media
    .filter(matchesSection)
    .filter((f) => nameOf(f).toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) =>
      sort === "oldest" ? idx(b) - idx(a) :
      sort === "name" ? nameOf(a).localeCompare(nameOf(b)) :
      sort === "size" ? (info?.[b]?.bytes || 0) - (info?.[a]?.bytes || 0) :
      idx(a) - idx(b));
  const pct = me?.quota ? Math.min(100, (me.used / me.quota) * 100) : 0;

  const selIdx = selected ? shown.indexOf(selected) : -1;
  const openFile = (file) => {
    setPreviewError(false);
    setSelected(file);
  };

  const go = (d) => { const n = shown[selIdx + d]; if (n) openFile(n); };

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

  const pressTimer = useRef(null);
  const longPressed = useRef(false);
  const pressOrigin = useRef({ x: 0, y: 0 });
  const isTouch = () => window.matchMedia("(pointer: coarse)").matches;

  const pressCancel = () => {
    clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };

  const pressStart = (file, event) => {
    longPressed.current = false;
    pressCancel();
    const touch = event.touches?.[0];
    pressOrigin.current = { x: touch?.clientX ?? 0, y: touch?.clientY ?? 0 };
    pressTimer.current = setTimeout(() => {
      pressTimer.current = null;
      longPressed.current = true;
      toggleCheck(file);
      if (navigator.vibrate) navigator.vibrate(20);
    }, 450);
  };

  // Cancel the long press only once the finger actually moves (a small
  // tolerance keeps normal tap jitter from cancelling it).
  const pressMove = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    const dx = touch.clientX - pressOrigin.current.x;
    const dy = touch.clientY - pressOrigin.current.y;
    if (Math.hypot(dx, dy) > 12) pressCancel();
  };

  useEffect(() => () => clearTimeout(pressTimer.current), []);

  const pressProps = (file) => ({
    onTouchStart: (event) => pressStart(file, event),
    onTouchMove: pressMove,
    onTouchEnd: pressCancel,
    onTouchCancel: pressCancel,
    onContextMenu: (e) => e.preventDefault(),
    onClick: () => {
      if (longPressed.current) { longPressed.current = false; return; }
      if (checked.length > 0 && isTouch()) toggleCheck(file);
      else openFile(file);
    },
  });

  if (authed === null) return null;
  if (!authed) return null;

  if (showAdmin) return <Admin onBack={() => setShowAdmin(false)} />;

  if (showProfile) return (
    <Profile onBack={() => { setShowProfile(false); fetchMedia(); }} />
  );

  return (
    <div className="min-h-screen bg-[#14151f] text-white font-sans flex">
      <UploadBar upload={upload} />
      <nav className="hidden md:flex sticky top-0 self-start h-screen w-64 shrink-0 flex-col p-4 border-r border-white/10 bg-black/10">
        <h1 className="text-2xl font-serif px-2 mb-4">Ferz Space</h1>
        <label className="cursor-pointer flex items-center justify-center gap-2 bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b] text-neutral-900 text-base font-medium py-3 rounded-xl mb-4 hover:brightness-105 transition">
          <Icon><path d="M12 5v14M5 12h14" /></Icon>
          {isUploading ? `Uploading ${Math.round(upload.progress)}%` : "New upload"}
          <input type="file" multiple className="hidden" accept={UPLOAD_ACCEPT}
            onChange={handleUpload} disabled={isUploading} />
        </label>
        {[["all", "All"], ["photos", "Photos"], ["videos", "Videos"], ["documents", "Documents"]].map(([k, label]) => (
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
          <button onClick={() => setShowProfile(true)} className="mt-2 text-sm text-[#e8b9a0] hover:brightness-110 transition">
            Request more storage
          </button>
        </div>
      </nav>
      <div className="flex-1 min-w-0 p-4 sm:p-8">
        <header className="mb-4 space-y-3">
          <div className="flex items-center justify-between md:hidden">
            <h1 className="text-2xl font-serif">Ferz Space</h1>
            <div className="flex items-center gap-4 text-sm text-neutral-400">
              <button onClick={() => setShowProfile(true)} className="hover:text-white">Profile</button>
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
            <button onClick={() => setShowProfile(true)} className="hidden md:block text-sm text-neutral-400 hover:text-white transition-colors">Profile</button>
            {me?.is_admin && (
              <button onClick={() => setShowAdmin(true)} className="hidden md:block text-sm text-neutral-400 hover:text-white transition-colors">Admin</button>
            )}
            <button onClick={handleLogout} className="hidden md:block text-sm text-neutral-400 hover:text-white transition-colors">Log out</button>
          </div>
        </header>

        <div className="flex gap-2 mb-4 md:hidden overflow-x-auto">
          {[["all", "All"], ["photos", "Photos"], ["videos", "Videos"], ["documents", "Documents"]].map(([k, label]) => (
            <button key={k} onClick={() => setSection(k)}
              className={"shrink-0 whitespace-nowrap px-3 py-2 rounded-full text-sm " + (section === k ? "bg-white/15" : "bg-white/5 text-neutral-400")}>
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
              {media.length === 0 ? "Nothing here yet. Upload some photos, videos or documents." : "No matches."}
            </p>
          ) : view === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3 sm:gap-4 auto-rows-[200px] sm:auto-rows-[240px] select-none [-webkit-touch-callout:none]">
              {shown.map((file) => (
                <div key={file}
                  className="relative group cursor-pointer rounded-2xl overflow-hidden shadow-lg border border-white/10 bg-white/5 transition-all hover:scale-[1.02] hover:shadow-2xl hover:border-purple-400/50 flex flex-col"
                  {...pressProps(file)}>
                  {checked.includes(file) && (
                    <div className="absolute inset-0 rounded-2xl ring-2 ring-inset ring-purple-400 pointer-events-none z-10" />
                  )}
                  <button type="button" aria-label="Select"
                    onClick={(e) => { e.stopPropagation(); toggleCheck(file); }}
                    onTouchStart={(e) => e.stopPropagation()}
                    className={"absolute top-2 left-2 z-20 h-8 w-8 sm:h-6 sm:w-6 rounded-full border-2 flex items-center justify-center transition-all " +
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
                      <video src={`${API_URL}/photos/${file}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100" muted preload="metadata" pointer-events-none/>
                    ) : isImage(file) ? (
                      <img src={`${API_URL}/photos/${file}`} className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity" loading="lazy" pointer-events-none/>
                    ) : (
                      <DocumentPreview name={nameOf(file)} />
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
            <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden select-none">
              {shown.map((file) => (
                <div key={file} {...pressProps(file)}
                  className={"flex items-center gap-3 px-3 py-2 cursor-pointer border-b border-white/5 last:border-b-0 transition-colors hover:bg-white/5 " +
                    (checked.includes(file) ? "bg-white/10" : "")}>
                  <button type="button" aria-label="Select"
                    onClick={(e) => { e.stopPropagation(); toggleCheck(file); }}
                    onTouchStart={(e) => e.stopPropagation()}
                    className={"h-5 w-5 shrink-0 rounoded-full border-2 flex items-center justify-center " +
                      (checked.includes(file) ? "bg-purple-500 border-purple-500" : "border-white/50 hover:border-white")}>
                    {checked.includes(file) && (
                      <svg viewBox="0 0 24 24" className="h-3 w-3 text-white" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12l5 5L20 7" />
                      </svg>
                    )}
                  </button>
                  {isVideo(file) ? (
                    <video src={`${API_URL}/photos/${file}`} className="h-10 w-10 rounded-lg object-cover shrink-0" muted preload="metadata" pointer-events-none/>
                  ) : isImage(file) ? (
                    <img src={`${API_URL}/photos/${file}`} className="h-10 w-10 rounded-lg object-cover shrink-0" loading="lazy" pointer-events-none/>
                  ) : (
                    <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                      <DocumentPreview name={nameOf(file)} small />
                    </div>
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
                        <div className="text-neutral-400">{kindOf(f)} · {fmtSize(i.bytes)}</div>
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
        <input type="file" multiple className="hidden" accept={UPLOAD_ACCEPT}
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
            ) : isImage(selected) ? (
              <img src={`${API_URL}/photos/${selected}`} className="max-h-[80dvh] max-w-full rounded-lg shadow-2xl ring-1 ring-white/10 object-contain" />
            ) : isPreviewable(selected) && !previewError ? (
              <div className="flex h-[82dvh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#1b1c28] shadow-2xl">
                <div className="flex items-center gap-3 border-b border-white/10 px-4 py-2.5">
                  <span className="min-w-0 truncate text-sm text-neutral-200">{nameOf(selected)}</span>
                  <span className="hidden shrink-0 text-xs text-neutral-500 sm:inline">{extOf(nameOf(selected))}</span>
                  <div className="ml-auto flex shrink-0 items-center gap-3">
                    <a href={`${API_URL}/documents/${selected}`} download
                      className="text-xs font-medium text-[#e8b9a0] hover:brightness-110">Download</a>
                    <a href={`${API_URL}/preview/${selected}`} target="_blank" rel="noreferrer"
                      className="hidden text-xs text-neutral-400 hover:text-white sm:inline">Open</a>
                  </div>
                </div>
                <iframe
                  src={`${API_URL}/preview/${selected}`}
                  title={nameOf(selected)}
                  onLoad={(e) => {
                    try {
                      const text = e.currentTarget.contentDocument?.body?.innerText || "";
                      if (text.includes("LibreOffice") || text.includes('"detail"')) setPreviewError(true);
                    } catch { /* browser PDF viewer */ }
                  }}
                  className="min-h-0 w-full flex-1 bg-white"
                />
              </div>
            ) : (
              <div className="flex w-full max-w-sm flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/5 p-8 text-center backdrop-blur-xl">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-[#e8b9a0]/10 text-[#e8b9a0]">
                  <svg viewBox="0 0 24 24" className="h-10 w-10" fill="none" stroke="currentColor"
                    strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
                    <path d="M14 3v5h5" />
                    <path d="M9 13h6M9 17h4" />
                  </svg>
                </div>
                <div className="w-full min-w-0">
                  <p className="truncate text-lg font-medium">{nameOf(selected)}</p>
                  <p className="mt-1 text-sm text-neutral-400">
                    {extOf(nameOf(selected))} · {fmtSize(info?.[selected]?.bytes)}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-3">
                  <a href={`${API_URL}/documents/${selected}`} download
                    className="rounded-xl bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b] px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:brightness-105">
                    Download
                  </a>
                  <a href={`${API_URL}/photos/${selected}`} target="_blank" rel="noreferrer"
                    className="rounded-xl border border-white/15 px-4 py-2.5 text-sm text-neutral-200 transition hover:bg-white/5">
                    Open in new tab
                  </a>
                </div>
                {previewError && (
                  <p className="text-xs text-amber-300">Preview isn't available right now. Download the file instead.</p>
                )}
                <p className="text-xs text-neutral-500">Office files open in your system's default app.</p>
              </div>
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
