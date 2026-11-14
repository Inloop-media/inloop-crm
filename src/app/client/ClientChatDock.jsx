"use client";

import { useState } from "react";
import Icon from "@/components/Icon";
import BrandChat from "@/components/BrandChat";
import { clientChat, clientChatUpload, clientMarkRead, clientSendMessage } from "./actions";

/** Desktop: the chat sits beside the work. Phone: a WhatsApp-style full-screen chat behind a button. */
export default function ClientChatDock({ brandId, brandName, initial, lastReadAt, unread }) {
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState(false);
  return (
    <>
      <div className={`${open ? "fixed inset-0 z-50 flex flex-col bg-bg p-2" : "hidden"} lg:sticky lg:top-5 lg:flex lg:p-0`}>
        {open && (
          <button type="button" onClick={() => setOpen(false)} className="btn-ghost btn-sm mb-2 self-start lg:hidden">
            <Icon name="back" size={13} /> Back to your work
          </button>
        )}
        <BrandChat
          brandId={brandId}
          brandName={brandName}
          side="client"
          initial={initial}
          lastReadAt={lastReadAt}
          load={clientChat}
          send={clientSendMessage}
          upload={clientChatUpload}
          markRead={clientMarkRead}
          className="h-full min-h-0 flex-1 lg:h-[calc(100svh-7rem)] lg:max-h-[760px] lg:flex-none"
        />
      </div>
      {!open && (
        <button
          type="button"
          onClick={() => (setOpen(true), setSeen(true))}
          className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-brand py-3.5 pl-4 pr-5 text-sm font-medium text-on-brand shadow-xl lg:hidden"
        >
          <Icon name="chat" size={18} /> Chat with Inloop
          {unread > 0 && !seen && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-emerald-400 px-1.5 text-[11px] font-bold text-black">{unread}</span>}
        </button>
      )}
    </>
  );
}
