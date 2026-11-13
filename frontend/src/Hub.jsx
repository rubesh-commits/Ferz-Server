import { useEffect, useState } from 'react';
import StarSky from './StarSky';
import { driveUrl, safeNext } from './config';

const BG = { background: 'linear-gradient(to bottom, #15151c 0%, #1b1a33 45%, #2b2260 100%)' };
const inputClass = "w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:ring-2 focus:ring-purple-400/60";

const Icon = ({ children }) => (
  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor"
    strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{children}</svg>
);

const SERVICES = [
  {
    key: "drive",
    name: "Drive",
    description: "Photos, videos and personal files.",
    icon: <><path d="M4 7.5A2.5 2.5 0 0 1 6.5 5h11A2.5 2.5 0 0 1 20 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 16.5z" /><path d="M4 14l4.5-4.5a1.5 1.5 0 0 1 2.1 0L16 15" /><circle cx="9" cy="9.5" r="1.3" /></>,
  },
  {
    key: "portfolio",
    name: "Portfolio",
    description: "A public portfolio built from your work.",
    icon: <><circle cx="12" cy="8" r="3.2" /><path d="M5.5 20a6.5 6.5 0 0 1 13 0" /><path d="M3 20h18" /></>,
  },
  {
    key: "projects",
    name: "Project hosting",
    description: "Run and share your side projects.",
    icon: <><path d="M8.5 8.5 4 12l4.5 3.5" /><path d="M15.5 8.5 20 12l-4.5 3.5" /><path d="M13.5 5 10.5 19" /></>,
  },
];

export default function Hub() {
  const [authed, setAuthed] = useState(null);
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [reqUser, setReqUser] = useState("");
  const [reqPass, setReqPass] = useState("");
  const [reqError, setReqError] = useState("");
  const [reqDone, setReqDone] = useState(false);

  const next = new URLSearchParams(window.location.search).get("next");

  useEffect(() => {
    fetch("/me")
      .then((res) => {
        if (!res.ok) { setAuthed(false); return false; }
        const target = safeNext(next);
        if (target) { window.location.replace(target); return true; }
        setAuthed(true);
        return true;
      })
      .catch(() => setAuthed(false));
  }, [next]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError("");
    try {
      const res = await fetch("/login", {
        method: "POST",
        body: new URLSearchParams({ username, password }),
      });
      if (res.ok) {
        setPassword("");
        setAuthed(true);
        const target = safeNext(next);
        if (target) window.location.replace(target);
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
      const res = await fetch("/request-user", {
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

  const backToLogin = () => {
    setMode("login");
    setReqDone(false);
    setReqError("");
    setReqUser("");
    setReqPass("");
  };

  const handleLogout = async () => {
    await fetch("/logout", { method: "POST" });
    setAuthed(false);
    setMode("login");
  };

  if (authed === null) return null;

  if (!authed) {
    return (
      <div
        className="relative min-h-screen text-white flex items-center justify-center p-4 overflow-hidden"
        style={BG}
      >
        <StarSky />
        {mode === "login" ? (
          <form onSubmit={handleLogin} className="relative z-10 w-full max-w-sm bg-white/5 border border-white/10 backdrop-blur-xl rounded-3xl p-8 space-y-4 shadow-2xl">
            <h1 className="text-center text-4xl font-serif">Ferz Space</h1>
            <p className="text-center text-sm text-neutral-400 pb-2">Sign in to your private storage.</p>
            <input
              className={inputClass}
              placeholder="Username" autoComplete="username"
              value={username} onChange={(e) => setUsername(e.target.value)}
            />
            <input
              type="password"
              className={inputClass}
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
                  className={inputClass}
                  placeholder="Username" autoComplete="off"
                  value={reqUser} onChange={(e) => setReqUser(e.target.value)}
                />
                <input
                  type="password"
                  className={inputClass}
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

  return (
    <div className="relative min-h-screen text-white overflow-hidden" style={BG}>
      <StarSky />
      <div className="relative z-10 mx-auto flex min-h-screen max-w-5xl flex-col px-4 py-8 sm:px-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-serif">Ferz</h1>
            <p className="text-sm text-neutral-400">All your services, one login.</p>
          </div>
          <button onClick={handleLogout} className="text-sm text-neutral-400 hover:text-white transition-colors">
            Log out
          </button>
        </header>

        <main className="flex flex-1 flex-col justify-center py-12">
          <h2 className="text-center text-4xl font-serif">Choose a service</h2>
          <p className="mt-2 mb-10 text-center text-sm text-neutral-400">
            You're signed in. Pick where you want to go.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            {SERVICES.map((service) => {
              const available = service.key === "drive";
              const body = (
                <>
                  <div className={"flex h-12 w-12 items-center justify-center rounded-2xl " +
                    (available ? "bg-[#e8b9a0]/15 text-[#e8b9a0]" : "bg-white/5 text-neutral-500")}>
                    <Icon>{service.icon}</Icon>
                  </div>
                  <div className="mt-5 flex items-center gap-3">
                    <h3 className={"text-lg font-medium " + (available ? "text-white" : "text-neutral-400")}>
                      {service.name}
                    </h3>
                    {!available && (
                      <span className="rounded-full border border-white/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-neutral-500">
                        Coming soon
                      </span>
                    )}
                  </div>
                  <p className={"mt-1 text-sm " + (available ? "text-neutral-400" : "text-neutral-600")}>
                    {service.description}
                  </p>
                  {available && (
                    <span className="mt-5 inline-flex items-center gap-2 text-sm text-[#e8b9a0]">
                      Open Drive
                      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor"
                        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12h14M13 6l6 6-6 6" />
                      </svg>
                    </span>
                  )}
                </>
              );

              return available ? (
                <a key={service.key} href={driveUrl()}
                  className="group rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-xl transition-all hover:-translate-y-0.5 hover:border-[#e8b9a0]/50 hover:bg-white/[0.07] hover:shadow-2xl">
                  {body}
                </a>
              ) : (
                <div key={service.key} aria-disabled="true"
                  className="cursor-not-allowed rounded-3xl border border-white/5 bg-white/[0.02] p-6">
                  {body}
                </div>
              );
            })}
          </div>
        </main>
      </div>
    </div>
  );
}
