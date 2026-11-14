"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Icon from "@/components/Icon";
import { signInClient } from "./actions";

/** "Client login": the ID + password Inloop shared with the brand. */
export default function ClientLoginForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [id, setId] = useState("");
  const [pw, setPw] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  if (!open)
    return (
      <button onClick={() => setOpen(true)} className="btn-ghost w-full justify-center">
        <Icon name="team" size={15} /> Client login
      </button>
    );
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        start(async () => {
          setError("");
          const r = await signInClient(id, pw);
          if (!r.ok) return setError(r.error);
          router.replace("/client");
          router.refresh();
        });
      }}
    >
      <div className="text-sm font-medium">Client login</div>
      <input className="field" placeholder="Login ID" autoComplete="username" autoCapitalize="none" value={id} onChange={(e) => setId(e.target.value)} autoFocus />
      <div className="relative">
        <input className="field pr-16" placeholder="Password" type={show ? "text" : "password"} autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} />
        <button type="button" onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted hover:text-ink">
          {show ? "Hide" : "Show"}
        </button>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      <button disabled={pending || !id || !pw} className="btn-primary justify-center">
        {pending ? "Signing in…" : "Sign in"} <Icon name="arrow" size={14} />
      </button>
    </form>
  );
}
