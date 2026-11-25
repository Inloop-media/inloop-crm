"use client";
// My notes: a private to-do list on the dashboard (admin and the CBOs). Type and press Enter to add,
// tick it off when it's done, click the text to change it. Only the person who wrote it sees it.
import { useState, useTransition } from "react";
import Icon from "@/components/Icon";
import { addNote, deleteNote, updateNote } from "@/app/(crm)/notes/actions";

function Row({ note, onToggle, onSave, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const save = () => {
    setEditing(false);
    if (text.trim() && text.trim() !== note.text) onSave(text.trim());
    else setText(note.text);
  };
  return (
    <li className="group flex items-start gap-2.5 py-2">
      <button
        type="button"
        onClick={onToggle}
        aria-label={note.done ? "Mark as not done" : "Mark as done"}
        className={`mt-0.5 grid h-[18px] w-[18px] shrink-0 place-items-center rounded-md border transition ${note.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-ink/30 hover:border-brand"}`}
      >
        {note.done && <Icon name="check" size={11} />}
      </button>
      {editing ? (
        <textarea
          autoFocus
          value={text}
          rows={Math.min(6, Math.max(1, Math.ceil(text.length / 40)))}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) (e.preventDefault(), save());
            if (e.key === "Escape") (setText(note.text), setEditing(false));
          }}
          className="field min-w-0 flex-1 resize-none !py-1 text-[13px]"
        />
      ) : (
        <button type="button" onClick={() => !note.done && setEditing(true)} className={`min-w-0 flex-1 whitespace-pre-wrap break-words text-left text-[13px] leading-snug ${note.done ? "text-muted line-through" : ""}`}>
          {note.text}
        </button>
      )}
      <button type="button" onClick={onDelete} aria-label="Delete note" className="mt-0.5 shrink-0 text-faint opacity-60 transition hover:text-rose-400 group-hover:opacity-100">
        <Icon name="x" size={13} />
      </button>
    </li>
  );
}

export default function MyNotes({ initial }) {
  const [open, setOpen] = useState(initial.open);
  const [done, setDone] = useState(initial.done);
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const [showDone, setShowDone] = useState(false);
  const [, start] = useTransition();

  const run = (fn) =>
    start(async () => {
      const r = await fn();
      if (r && !r.ok) setError(r.error);
    });

  const add = (e) => {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    setError("");
    start(async () => {
      const r = await addNote(t);
      if (!r.ok) return (setError(r.error), setText(t));
      setOpen((o) => [...o, r.note]);
    });
  };
  const toggle = (n) => {
    if (n.done) {
      setDone((d) => d.filter((x) => x.id !== n.id));
      setOpen((o) => [...o, { ...n, done: false }]);
    } else {
      setOpen((o) => o.filter((x) => x.id !== n.id));
      setDone((d) => [{ ...n, done: true }, ...d]);
    }
    run(() => updateNote(n.id, { done: !n.done }));
  };
  const saveText = (n, t) => {
    setOpen((o) => o.map((x) => (x.id === n.id ? { ...x, text: t } : x)));
    run(() => updateNote(n.id, { text: t }));
  };
  const remove = (n) => {
    setOpen((o) => o.filter((x) => x.id !== n.id));
    setDone((d) => d.filter((x) => x.id !== n.id));
    run(() => deleteNote(n.id));
  };
  const clearDone = () => {
    setDone([]);
    run(() => deleteNote("done"));
  };

  return (
    <section className="card rise min-w-0 p-5">
      <header className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-brand/12 text-brand">
          <Icon name="list" size={15} />
        </span>
        <h2 className="text-[15px] font-medium">My notes</h2>
        {open.length > 0 && <span className="text-[13px] tabular-nums text-muted">{open.length}</span>}
        <span className="ml-auto flex items-center gap-1 text-[11px] text-faint">
          <Icon name="lock" size={11} /> Only you
        </span>
      </header>

      {initial.missing ? (
        <p className="mt-3 text-[12.5px] text-muted">Notes aren&apos;t set up yet — run migration 032_my_notes.sql in Supabase.</p>
      ) : (
        <>
          <form onSubmit={add} className="mt-3">
            <input value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} placeholder="Add something to do… (Enter)" className="field w-full text-[13px]" />
          </form>
          {error && <p className="mt-2 text-[12px] text-rose-400">{error}</p>}
          {open.length ? (
            <ul className="mt-2 divide-y divide-line">
              {open.map((n) => (
                <Row key={n.id} note={n} onToggle={() => toggle(n)} onSave={(t) => saveText(n, t)} onDelete={() => remove(n)} />
              ))}
            </ul>
          ) : (
            <p className="py-4 text-[12.5px] text-muted">Nothing on your list. Write what you need to get done.</p>
          )}
          {done.length > 0 && (
            <div className="mt-2 border-t border-line pt-2">
              <div className="flex items-center text-[12px] text-muted">
                <button type="button" onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1 hover:text-ink">
                  <Icon name="chevron" size={11} className={`transition ${showDone ? "rotate-180" : ""}`} /> Done · {done.length}
                </button>
                {showDone && (
                  <button type="button" onClick={clearDone} className="ml-auto hover:text-rose-400">
                    Clear done
                  </button>
                )}
              </div>
              {showDone && (
                <ul className="mt-1">
                  {done.map((n) => (
                    <Row key={n.id} note={n} onToggle={() => toggle(n)} onSave={() => {}} onDelete={() => remove(n)} />
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
