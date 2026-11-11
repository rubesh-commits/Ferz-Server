import { useState, useEffect } from 'react';

const fmtSize = (b) =>
  b == null ? "-" :
  b >= 1024 ** 3 ? (b / 1024 ** 3).toFixed(1) + " GB" :
  b >= 1024 ** 2 ? (b / 1024 ** 2).toFixed(1) + " MB" :
  b >= 1024 ? (b / 1024).toFixed(1) + " KB" : b + " B";
const fmt = fmtSize;
const when = (t) => new Date(t.replace(" ", "T") + "Z").toLocaleString();

export default function Admin({ onBack }) {
  const [dialog, setDialog] = useState(null);
  const [dialogValue, setDialogValue] = useState("");
  const [users, setUsers] = useState([]);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", is_admin: false });
  const [tab, setTab] = useState("users");
  const [requests, setRequests] = useState([]);
  const [files, setFiles] = useState([]);
  const [activity, setActivity] = useState([]);

  const load = () =>
    fetch("/admin/users")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d) => setUsers(d.users))
      .catch((s) => setError(`Could not load users (${s})`));

  useEffect(() => { load(); }, []);

  const loadRequests = () =>
  fetch("/admin/requests")
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d) => setRequests(d.requests))
    .catch(() => {});

  const loadFiles = () =>
  fetch("/admin/files").then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => setFiles(d.files)).catch(() => {});

  const loadActivity = () =>
  fetch("/admin/activity").then((r) => (r.ok ? r.json() : Promise.reject()))
    .then((d) => setActivity(d.activity)).catch(() => {});

  useEffect(() => { load(); loadRequests(); }, []);
  useEffect(() => {
    if (tab === "files") loadFiles();
    if (tab === "activity") loadActivity();
  }, [tab]);

  const call = async (url, opts) => {
    setError("");
    const res = await fetch(url, opts);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.detail || `Error ${res.status}`);
      return false;
    }
    load(); loadRequests();
    if (tab === "files") loadFiles();
    if (tab === "activity") loadActivity();
    return true;
  };

  const createUser = async (e) => {
    e.preventDefault();
    const ok = await call("/admin/users", {
      method: "POST",
      body: new URLSearchParams({ username: form.username, password: form.password, is_admin: form.is_admin }),
    });
    if (ok) setForm({ username: "", password: "", is_admin: false });
  };

  const resetPw = (u) => {
    const pw = window.prompt(`New password for ${u.username} (min 8 characters):`);
    if (pw) call(`/admin/users/${u.id}/password`, { method: "POST", body: new URLSearchParams({ password: pw }) });
  };

  const openQuota = (u) => {
    setDialogValue((u.quota / 1024 ** 3).toFixed(1));
    setDialog({ type: "quota", user: u });
  };
  const openDelete = (u) => setDialog({ type: "delete", user: u });
  const closeDialog = () => setDialog(null);

  const quotaValid = dialogValue !== "" && !isNaN(dialogValue) && Number(dialogValue) >= 0;

  const submitDialog = async () => {
    const { type, user } = dialog;
    if (type === "delete") {
      closeDialog();
      await call(`/admin/users/${user.id}`, { method: "DELETE" });
    } else if (quotaValid) {
      closeDialog();
      await call(`/admin/users/${user.id}/quota`, {
        method: "POST",
        body: new URLSearchParams({ quota_gb: dialogValue }),
      });
    }
  };

  const input = "bg-white/5 border border-white/10 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-[#e8b9a0]/60";
  const totalFiles = users.reduce((s, u) => s + u.files, 0);
  const totalBytes = users.reduce((s, u) => s + u.bytes, 0);

  return (
    <div className="min-h-screen bg-[#14151f] text-white p-4 sm:p-8">
      <div className="max-w-5xl mx-auto">
        <header className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-serif">Admin console</h1>
          <button onClick={onBack} className="text-sm text-neutral-400 hover:text-white">Back to drive</button>
        </header>

        {error && <p className="mb-4 text-sm text-red-400">{error}</p>}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          {[[users.length, "Users"], [totalFiles, "Files"], [fmt(totalBytes), "Storage used"], [requests.length, "Pending requests"]].map(([v, l]) => (
            <div key={l} className="bg-white/5 border border-white/10 rounded-2xl px-5 py-4">
              <div className="text-2xl font-serif">{v}</div>
              <div className="text-sm text-neutral-400">{l}</div>
            </div>
          ))}
        </div>

        <div className="flex gap-6 border-b border-white/10 mb-6">
          {[["users", "Users"], ["files", "All files"], ["requests", "Requests"], ["activity", "Activity"]].map(([k, label]) => (
            <button key={k} onClick={() => setTab(k)}
              className={"pb-3 px-1 text-sm transition-colors border-b-2 -mb-px " +
                (tab === k ? "border-[#e8b9a0] text-white" : "border-transparent text-neutral-400 hover:text-white")}>
              {label}
              {k === "requests" && requests.length > 0 && (
                <span className="ml-2 text-xs bg-[#e8b9a0] text-neutral-900 rounded-full px-2 py-0.5">{requests.length}</span>
              )}
            </button>
          ))}
        </div>

        {tab === "users" && (
        <>
          <form onSubmit={createUser} className="mb-8 flex flex-wrap gap-3 items-center">
            <input className={input} placeholder="Username" value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })} />
            <input className={input} type="password" placeholder="Password (8+ chars)" value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <label className="text-sm text-neutral-400 flex items-center gap-2">
              <input type="checkbox" checked={form.is_admin}
                onChange={(e) => setForm({ ...form, is_admin: e.target.checked })} /> Admin
            </label>
            <button className="bg-[#e8b9a0] hover:brightness-105 text-neutral-900 font-medium py-2 px-4 rounded-lg">Create user</button>
          </form>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-neutral-400">
                <tr><th className="py-2">User</th><th>Files</th><th>Storage</th><th></th></tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t border-neutral-800">
                    <td className="py-3">{u.username}{u.is_admin && <span className="ml-2 text-xs text-purple-400">admin</span>}</td>
                    <td>{u.files}</td>
                    <td>{fmt(u.bytes)} / {fmt(u.quota)}</td>
                    <td className="text-right space-x-4">
                      <button onClick={() => resetPw(u)} className="text-neutral-400 hover:text-white">Reset password</button>
                      <button onClick={() => openQuota(u)} className="text-neutral-400 hover:text-white">Set limit</button>
                      <button onClick={() => openDelete(u)} className="text-red-400 hover:text-red-300">Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>)}
        {tab === "requests" && (
          requests.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6">No pending requests.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-400">
                  <tr><th className="py-2">Username</th><th>Requested</th><th></th></tr>
                </thead>
                <tbody>
                  {requests.map((r) => (
                    <tr key={r.id} className="border-t border-white/10">
                      <td className="py-3">{r.username}</td>
                      <td className="text-neutral-400">
                        {new Date(r.created_at.replace(" ", "T") + "Z").toLocaleString()}
                      </td>
                      <td className="text-right space-x-4">
                        <button onClick={() => call(`/admin/requests/${r.id}/approve`, { method: "POST" })}
                          className="text-[#e8b9a0] hover:brightness-110">Approve</button>
                        <button onClick={() => call(`/admin/requests/${r.id}/reject`, { method: "POST" })}
                          className="text-red-400 hover:text-red-300">Reject</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "files" && (
          files.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6">No files yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-400">
                  <tr><th className="py-2">File</th><th>Owner</th><th>Size</th><th>Uploaded</th><th></th></tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.id} className="border-t border-white/10">
                      <td className="py-3 break-all pr-4">{f.name}</td>
                      <td>{f.owner || "-"}</td>
                      <td>{fmtSize(f.bytes)}</td>
                      <td className="text-neutral-400">{when(f.uploaded)}</td>
                      <td className="text-right space-x-4 whitespace-nowrap">
                        <a href={`/admin/files/${f.id}/download`} className="text-[#e8b9a0] hover:brightness-110">Download</a>
                        <button
                          onClick={() => window.confirm(`Delete ${f.name}? This can't be undone.`) &&
                            call(`/admin/files/${f.id}`, { method: "DELETE" })}
                          className="text-red-400 hover:text-red-300">Delete</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === "activity" && (
          activity.length === 0 ? (
            <p className="text-sm text-neutral-500 py-6">No activity recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-neutral-400">
                  <tr><th className="py-2">Time</th><th>User</th><th>Action</th><th>Details</th></tr>
                </thead>
                <tbody>
                  {activity.map((a, i) => (
                    <tr key={i} className="border-t border-white/10">
                      <td className="py-3 text-neutral-400 whitespace-nowrap pr-4">{when(a.created_at)}</td>
                      <td className="pr-4">{a.username || "-"}</td>
                      <td className="pr-4">{a.action.replace(/_/g, " ")}</td>
                      <td className="text-neutral-400 break-all">{a.detail}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {dialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={closeDialog}>
            <div className="w-full max-w-sm bg-neutral-900 border border-neutral-700 rounded-2xl p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
              {dialog.type === "delete" ? (
                <>
                  <h2 className="text-lg font-bold mb-2">Delete {dialog.user.username}?</h2>
                  <p className="text-sm text-neutral-400 mb-6">This permanently removes the user and all their files. This can’t be undone.</p>
                </>
              ) : (
                <>
                  <h2 className="text-lg font-bold mb-2">Storage limit</h2>
                  <p className="text-sm text-neutral-400 mb-4">Set the limit for {dialog.user.username} in GB.</p>
                  <input
                    autoFocus type="number" min="0" step="0.1"
                    className={input + " w-full mb-6"}
                    value={dialogValue}
                    onChange={(e) => setDialogValue(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitDialog()}
                  />
                </>
              )}
              <div className="flex justify-end gap-3">
                <button onClick={closeDialog} className="px-4 py-2 rounded-lg text-sm text-neutral-300 hover:bg-neutral-800 transition-colors">Cancel</button>
                <button
                  onClick={submitDialog}
                  disabled={dialog.type === "quota" && !quotaValid}
                  className={"px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-40 " +
                    (dialog.type === "delete" ? "bg-red-600 hover:bg-red-500" : "bg-[#e8b9a0] hover:brightness-105 text-neutral-900")}
                >
                  {dialog.type === "delete" ? "Delete" : "Save"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}