"use client";
// The task's Drive folders: what goes where (the note), "Upload here" straight into that Google Drive folder
// (big videos too — the file goes from the browser to Google, not through the CRM), and "Open in Drive".
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import FileDrop from "@/components/FileDrop";
import { clientLink, finishDriveUpload, startDriveUpload } from "@/app/(crm)/drive/actions";

const link = (id) => `https://drive.google.com/drive/folders/${id}`;
const mb = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(n / 1e6))} MB`);

/** Sends one file to Google with progress; resolves with Google's file id. */
function send(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open("PUT", url);
    x.setRequestHeader("Content-Type", file.type || "application/octet-stream");
    x.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    x.onload = () => {
      if (x.status >= 200 && x.status < 300) {
        try {
          return resolve(JSON.parse(x.responseText).id);
        } catch {}
      }
      reject(new Error(`Google Drive said ${x.status}`));
    };
    x.onerror = () => reject(new Error("The upload stopped — check the internet and try again."));
    x.send(file);
  });
}

/** Managers: make this folder view-only for anyone with the link and copy it (for the client). */
function ClientLink({ taskId, driveId }) {
  const [state, setState] = useState({ busy: false, url: "", error: "" });
  const go = async () => {
    setState({ busy: true, url: "", error: "" });
    const r = await clientLink(taskId, driveId).catch((e) => ({ ok: false, error: e.message }));
    if (!r.ok) return setState({ busy: false, url: "", error: r.error });
    await navigator.clipboard.writeText(r.url).catch(() => {});
    setState({ busy: false, url: r.url, error: "" });
  };
  return (
    <span className="flex flex-col items-end gap-1">
      <button type="button" onClick={go} disabled={state.busy} className="btn-ghost btn-sm" title="Anyone with the link can view only this folder — no access request">
        <Icon name="link" size={12} /> {state.busy ? "Making link…" : state.url ? "Link copied ✓" : "Client link"}
      </button>
      {state.error && <span className="max-w-[260px] text-right text-[11px] text-rose-400">{state.error}</span>}
    </span>
  );
}

function Folder({ task, folder, files, canUpload, onUpload, busy, canShare }) {
  const input = useRef(null);
  const parts = folder.path.split(" / ");
  const name = parts.pop() || "Brand folder";
  return (
    <li className="flex flex-wrap items-center gap-3 rounded-2xl border border-line bg-panel-2/40 p-3.5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-amber-400/15 text-amber-500">
        <Icon name="board" size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="truncate text-[14px] font-medium">{name}</div>
        {parts.length > 0 && <div className="truncate text-[11px] text-faint">{parts.join(" / ")}</div>}
        {folder.note && <div className="mt-1 text-[12.5px] text-ink/80">“{folder.note}”</div>}
        {files.length > 0 && (
          <div className="mt-1 text-[11.5px] text-emerald-500">
            {files.length} file{files.length > 1 ? "s" : ""} uploaded here
          </div>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-start gap-2">
        {canUpload && (
          <>
            <input ref={input} type="file" multiple className="hidden" onChange={(e) => {
              const picked = [...(e.target.files || [])];
              e.target.value = "";
              if (picked.length) onUpload(folder, picked);
            }} />
            <button type="button" onClick={() => input.current?.click()} disabled={busy} className="btn-primary btn-sm">
              <Icon name="upload" size={13} /> Upload here
            </button>
          </>
        )}
        <a href={link(folder.drive_id)} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
          Open in Drive <Icon name="external" size={12} />
        </a>
        {canShare && <ClientLink taskId={task.id} driveId={folder.drive_id} />}
      </div>
    </li>
  );
}

export default function DriveUploads({ task, canUpload, canShare = false }) {
  const router = useRouter();
  const [status, setStatus] = useState(null); // { text, pct }
  const [error, setError] = useState("");
  const locked = ["sent_to_client", "done"].includes(task.status);
  const can = canUpload && !locked;
  const folders = task.folders || [];

  const upload = async (folder, files) => {
    setError("");
    for (const [i, file] of files.entries()) {
      const label = `${files.length > 1 ? `${i + 1} of ${files.length} · ` : ""}${file.name} (${mb(file.size)})`;
      setStatus({ text: `Starting ${label}…`, pct: 0 });
      const s = await startDriveUpload(task.id, folder.drive_id, { name: file.name, size: file.size, type: file.type }).catch((e) => ({ ok: false, error: e.message }));
      if (!s.ok) {
        setError(s.error);
        break;
      }
      try {
        const id = await send(s.url, file, (p) => setStatus({ text: `Uploading ${label} to ${folder.path.split(" / ").pop()}…`, pct: Math.round(p * 100) }));
        const r = await finishDriveUpload(task.id, folder.drive_id, id);
        if (!r.ok) throw new Error(r.error);
      } catch (e) {
        setError(`"${file.name}" didn't upload: ${e.message}`);
        break;
      }
    }
    setStatus(null);
    router.refresh();
  };

  if (!folders.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {/* One folder: dropping a file anywhere on the page puts it there */}
      {folders.length === 1 && <FileDrop enabled={can && !status} onFiles={(f) => upload(folders[0], f)} label={`Drop to upload to ${folders[0].path.split(" / ").pop() || "Drive"}`} hint="Goes straight into the Google Drive folder" />}
      <p className="text-[12.5px] text-muted">{can ? "Upload your work into these Google Drive folders — each file goes straight into its folder." : "This task's work goes into these Google Drive folders."}</p>
      <ul className="flex flex-col gap-2">
        {folders.map((f) => (
          <Folder key={f.drive_id} task={task} folder={f} files={(task.files || []).filter((x) => x.drive_folder_id === f.drive_id)} canUpload={can} onUpload={upload} busy={Boolean(status)} canShare={canShare} />
        ))}
      </ul>
      {status && (
        <div className="rounded-xl bg-panel-2 px-3.5 py-2.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="truncate">{status.text}</span>
            <span className="tabular-nums text-muted">{status.pct}%</span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line">
            <div className="h-full rounded-full bg-brand transition-[width]" style={{ width: `${status.pct}%` }} />
          </div>
          <p className="mt-1.5 text-[11px] text-faint">Keep this page open until it finishes.</p>
        </div>
      )}
      {error && <p className="rounded-xl bg-rose-400/10 px-3 py-2 text-[12.5px] text-rose-400">{error}</p>}
    </div>
  );
}
