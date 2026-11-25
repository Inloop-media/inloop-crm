"use client";
// Drag files from the computer anywhere onto the page: a full-screen "Drop to upload" layer shows while
// they're over it, and letting go hands the files to onFiles. (Without this, a file dropped a little
// outside the upload box just opens in the browser.)
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Icon from "@/components/Icon";

const hasFiles = (e) => [...(e.dataTransfer?.types || [])].includes("Files");

export default function FileDrop({ onFiles, label = "Drop to upload", hint = "", enabled = true, accept }) {
  const [over, setOver] = useState(false);
  const depth = useRef(0);
  const cb = useRef(onFiles);
  useEffect(() => {
    cb.current = onFiles;
  });

  useEffect(() => {
    if (!enabled) return;
    const enter = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current += 1;
      setOver(true);
    };
    const overFn = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    };
    const leave = (e) => {
      if (!hasFiles(e)) return;
      depth.current = Math.max(0, depth.current - 1);
      if (!depth.current) setOver(false);
    };
    const drop = (e) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth.current = 0;
      setOver(false);
      let files = [...(e.dataTransfer.files || [])].filter((f) => f.size > 0);
      if (accept) files = files.filter((f) => accept.test(f.name));
      if (files.length) cb.current(files);
    };
    window.addEventListener("dragenter", enter);
    window.addEventListener("dragover", overFn);
    window.addEventListener("dragleave", leave);
    window.addEventListener("drop", drop);
    return () => {
      window.removeEventListener("dragenter", enter);
      window.removeEventListener("dragover", overFn);
      window.removeEventListener("dragleave", leave);
      window.removeEventListener("drop", drop);
    };
  }, [enabled, accept]);

  if (!over || !enabled) return null;
  return createPortal(
    <div className="pointer-events-none fixed inset-0 z-[120] grid place-items-center bg-[rgb(12_11_18/0.45)] p-6 backdrop-blur-[2px]">
      <div className="flex w-full max-w-md flex-col items-center gap-3 rounded-[28px] border-2 border-dashed border-brand bg-panel px-8 py-12 text-center shadow-[0_40px_80px_-30px_rgb(0_0_0/0.6)]">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/12 text-brand">
          <Icon name="upload" size={24} />
        </span>
        <p className="text-[17px] font-medium">{label}</p>
        {hint && <p className="text-[12.5px] text-muted">{hint}</p>}
      </div>
    </div>,
    document.body,
  );
}
