import { useEffect, useState } from 'react';

const GB = 1024 ** 3;

const fmt = (b) =>
  b == null ? "—" :
  b >= GB ? (b / GB).toFixed(2) + " GB" :
  b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + " MB" :
  b >= 1024 ? (b / 1024).toFixed(1) + " KB" : b + " B";

const when = (t) => new Date(t.replace(" ", "T") + "Z").toLocaleString();

const statusStyle = {
  pending: "border-amber-400/30 bg-amber-400/10 text-amber-300",
  approved: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  rejected: "border-red-400/30 bg-red-400/10 text-red-300",
};

export default function Profile({ onBack }) {
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [gb, setGb] = useState("");
  const [reason, setReason] = useState("");
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState("");

  const load = () =>
    fetch("/profile")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => {
        setProfile(d);
        if (!d.requests.some((q) => q.status === "pending")) {
          setGb(String(Number((d.quota / GB).toFixed(1)) + 1));
        }
      })
      .catch((s) => setError(`Could not load your profile (${s})`));

  useEffect(() => { load(); }, []);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setNotice("");
    const value = Number(gb);
    const currentGb = profile ? profile.quota / GB : 0;
    if (!Number.isFinite(value) || value <= currentGb) {
      setError(`Enter a limit higher than your current ${currentGb.toFixed(1)} GB.`);
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/profile/quota-requests", {
        method: "POST",
        body: new URLSearchParams({ requested_gb: String(value), reason }),
      });
      if (res.ok) {
        setReason("");
        setNotice("Request sent. An admin will review it.");
        load();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.detail || `Error ${res.status}`);
      }
    } catch {
      setError("Could not reach the server");
    } finally {
      setSending(false);
    }
  };

  if (!profile) {
    return (
      <div className="min-h-screen bg-[#14151f] text-white p-6 sm:p-8">
        <div className="mx-auto max-w-2xl">
          <button onClick={onBack} className="text-sm text-neutral-400 hover:text-white">Back to drive</button>
          <p className={"mt-6 text-sm " + (error ? "text-red-400" : "text-neutral-400")}>
            {error || "Loading profile…"}
          </p>
        </div>
      </div>
    );
  }

  const pending = profile.requests.find((q) => q.status === "pending");
  const past = profile.requests.filter((q) => q.status !== "pending");
  const usedPct = profile.quota ? Math.min(100, (profile.used / profile.quota) * 100) : 0;
  const input = "bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-[#e8b9a0]/60";

  return (
    <div className="min-h-screen bg-[#14151f] text-white p-4 sm:p-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <h1 className="text-3xl font-serif">Profile</h1>
          <button onClick={onBack} className="text-sm text-neutral-400 hover:text-white">Back to drive</button>
        </header>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-medium">{profile.username}</h2>
            {profile.is_admin && (
              <span className="rounded-full border border-purple-400/30 bg-purple-400/10 px-2 py-0.5 text-xs text-purple-300">
                admin
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-neutral-400">Storage</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10">
            <div className="h-full bg-[#e8b9a0] transition-all duration-500" style={{ width: usedPct + "%" }} />
          </div>
          <p className="mt-3 text-sm text-neutral-400">
            {fmt(profile.used)} of {fmt(profile.quota)} used
          </p>
        </section>

        <section className="mb-6 rounded-3xl border border-white/10 bg-white/5 p-6">
          <h2 className="text-lg font-medium">Need more storage?</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Ask for a higher limit. An admin will review your request.
          </p>
          {notice && <p className="mt-3 text-sm text-emerald-400">{notice}</p>}

          {pending ? (
            <div className="mt-5 rounded-2xl border border-amber-400/30 bg-amber-400/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm text-amber-200">Request pending</span>
                <span className="text-sm text-amber-100">{fmt(pending.requested_bytes)}</span>
              </div>
              <p className="mt-1 text-xs text-amber-200/70">Sent {when(pending.created_at)}</p>
              {pending.reason && <p className="mt-2 text-sm text-neutral-300">{pending.reason}</p>}
            </div>
          ) : (
            <form onSubmit={submit} className="mt-5 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm text-neutral-400" htmlFor="quota-gb">
                  New storage limit (GB)
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="quota-gb" type="number" min="0.1" step="0.5" required
                    className={input + " w-40"} value={gb}
                    onChange={(e) => setGb(e.target.value)}
                  />
                  <span className="text-sm text-neutral-500">
                    current {Number((profile.quota / GB).toFixed(1))} GB
                  </span>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm text-neutral-400" htmlFor="quota-reason">
                  Reason <span className="text-neutral-600">(optional)</span>
                </label>
                <textarea
                  id="quota-reason" rows="3" maxLength={500}
                  className={input + " w-full resize-y"}
                  placeholder="What are you storing that needs more space?"
                  value={reason} onChange={(e) => setReason(e.target.value)}
                />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button
                disabled={sending}
                className="rounded-xl bg-gradient-to-r from-[#e8b9a0] to-[#d9a58b] px-4 py-2.5 text-sm font-medium text-neutral-900 transition hover:brightness-105 disabled:opacity-40"
              >
                {sending ? "Sending…" : "Request increase"}
              </button>
            </form>
          )}
        </section>

        {past.length > 0 && (
          <section className="rounded-3xl border border-white/10 bg-white/5 p-6">
            <h2 className="mb-4 text-lg font-medium">Past requests</h2>
            <ul className="space-y-3">
              {past.map((q) => (
                <li key={q.id} className="flex flex-wrap items-start justify-between gap-2 border-t border-white/5 pt-3 first:border-0 first:pt-0">
                  <div className="min-w-0">
                    <p className="text-sm text-neutral-200">{fmt(q.requested_bytes)}</p>
                    {q.reason && <p className="mt-0.5 text-xs text-neutral-500 break-all">{q.reason}</p>}
                    <p className="mt-0.5 text-xs text-neutral-500">{when(q.created_at)}</p>
                  </div>
                  <span className={"rounded-full border px-2 py-0.5 text-xs capitalize " + (statusStyle[q.status] || "")}>
                    {q.status}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
