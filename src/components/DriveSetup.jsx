"use client";
// Admin, Brands page: connect the company Google Drive (tech@) and make every brand's folder tree there.
import { useState } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { setupBrandDrive } from "@/app/(crm)/drive/actions";

const MSG = { connected: "Google Drive connected.", cancelled: "Connecting Drive was cancelled.", failed: "Couldn't connect Drive — try again." };

export default function DriveSetup({ conn, brands, ready, notice }) {
  const router = useRouter();
  const [run, setRun] = useState(null); // { done, total, name }
  const [error, setError] = useState("");
  const missing = brands.filter((b) => !ready.includes(b.id));

  const setupAll = async () => {
    setError("");
    const list = missing.length ? missing : brands;
    for (const [i, b] of list.entries()) {
      setRun({ done: i, total: list.length, name: b.name });
      const r = await setupBrandDrive(b.id);
      if (!r.ok) {
        setError(`${b.name}: ${r.error}`);
        break;
      }
    }
    setRun(null);
    router.refresh();
  };

  return (
    <section className="card rise mb-5 flex flex-wrap items-center gap-4 p-4">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-amber-400/15 text-amber-500">
        <Icon name="board" size={19} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium">Google Drive</div>
        <div className="text-[12px] text-muted">
          {conn
            ? `Connected as ${conn.email || "the company account"} · ${brands.length - missing.length} of ${brands.length} brands have their folders`
            : "Connect the company Drive (tech@) — task work then uploads straight into each brand's folders."}
        </div>
        {notice && <div className={`mt-1 text-[12px] ${notice === "connected" ? "text-emerald-500" : "text-rose-400"}`}>{MSG[notice] || notice}</div>}
        {run && (
          <div className="mt-1 text-[12px] text-ink/80">
            Making folders… {run.done + 1} of {run.total} · {run.name}
          </div>
        )}
        {error && <div className="mt-1 text-[12px] text-rose-400">{error}</div>}
      </div>
      <div className="flex flex-wrap gap-2">
        {conn?.root_id && (
          <a href={`https://drive.google.com/drive/folders/${conn.root_id}`} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
            Open in Drive <Icon name="external" size={12} />
          </a>
        )}
        {conn && missing.length > 0 && (
          <button type="button" onClick={setupAll} disabled={Boolean(run)} className="btn-primary btn-sm">
            {run ? "Making folders…" : `Make folders for ${missing.length} brand${missing.length > 1 ? "s" : ""}`}
          </button>
        )}
        <a href="/api/drive/connect" className={conn ? "btn-ghost btn-sm" : "btn-primary btn-sm"}>
          {conn ? "Reconnect" : "Connect Drive"}
        </a>
      </div>
    </section>
  );
}
