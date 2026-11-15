// Every client chat in one place, like the reference "Messages" screen:
//   [ brands + last message ] [ the conversation ] [ the brand: services, work, quick links ]
import Link from "next/link";
import BrandChat from "@/components/BrandChat";
import Icon from "@/components/Icon";
import { FilterPills, PageTop } from "@/components/Desk";
import { BrandMark, Empty } from "@/components/ui";
import { brandChat, brandChatUpload, markBrandRead, sendBrandMessage } from "@/app/(crm)/brands/actions";
import { chatMembers, loadChat, unreadCounts } from "@/lib/chat";
import { requireMember } from "@/lib/auth";
import { listBrands } from "@/lib/brands";
import { db } from "@/lib/supabase/server";
import { canSeeBrands } from "@/lib/permissions";
import { fmtDay } from "@/lib/format";

export const metadata = { title: "Messages" };

const IST = "Asia/Kolkata";
const dayKey = (d) => new Date(d).toLocaleDateString("en-CA", { timeZone: IST });
const clock = new Intl.DateTimeFormat("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
const nowMs = () => Date.now();
function when(iso) {
  if (!iso) return "";
  const k = dayKey(iso);
  if (k === dayKey(nowMs())) return clock.format(new Date(iso));
  if (k === dayKey(nowMs() - 864e5)) return "Yesterday";
  return fmtDay(iso);
}

export default async function MessagesPage({ searchParams }) {
  const me = await requireMember(canSeeBrands);
  const sp = await searchParams;
  const brands = (await listBrands()).filter((b) => b.stage === "active");
  const ids = brands.map((b) => b.id);
  const [unread, { data: recent }] = await Promise.all([
    unreadCounts(ids, me.id),
    ids.length
      ? db().from("brand_messages").select("brand_id, body, attachments, from_client, created_at, member:members(name)").in("brand_id", ids).order("created_at", { ascending: false }).limit(1000)
      : { data: [] },
  ]);
  const last = {};
  for (const m of recent || []) last[m.brand_id] ||= m;
  const list = [...brands].sort((a, b) => (last[b.id]?.created_at || "").localeCompare(last[a.id]?.created_at || "") || a.name.localeCompare(b.name));
  const onlyUnread = sp.show === "unread";
  const shown = onlyUnread ? list.filter((b) => unread[b.id]) : list;
  const totalUnread = Object.values(unread).reduce((n, c) => n + c, 0);
  const brand = list.find((b) => b.id === sp.brand) || shown[0] || list[0];
  const [chat, members] = brand ? await Promise.all([loadChat(brand.id), chatMembers()]) : [null, []];
  const href = (o) => {
    const q = new URLSearchParams(Object.entries({ show: sp.show, brand: brand?.id, ...o }).filter(([, v]) => v));
    return `/messages${q.size ? `?${q}` : ""}`;
  };
  const c = brand?.counts || {};
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;

  return (
    <div className="page">
      <PageTop
        title="Messages"
        sub={`${totalUnread} unread · chats with your clients`}
        right={
          <FilterPills
            items={[
              { label: "All", count: list.length, href: href({ show: "" }), on: !onlyUnread },
              { label: "Unread", count: Object.keys(unread).length, href: href({ show: "unread" }), on: onlyUnread },
            ]}
          />
        }
      />

      {!brand ? (
        <div className="card">
          <Empty icon="chat">No clients yet. Once a brand signs, its chat shows up here.</Empty>
        </div>
      ) : (
        <div className="rise card grid overflow-hidden p-0 lg:h-[calc(100svh-12.5rem)] lg:min-h-[560px] lg:grid-cols-[300px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)_290px]">
          {/* Conversations */}
          <aside className="flex min-h-0 flex-col border-b border-line lg:border-b-0 lg:border-r">
            <div className="p-3">
              <div className="flex items-center gap-2 rounded-full bg-panel-2 px-4 py-2.5 text-[13px] text-faint">
                <Icon name="search" size={15} /> {list.length} client chats
              </div>
            </div>
            <ul className="flex max-h-72 min-h-0 flex-1 flex-col gap-1 overflow-y-auto px-2 pb-2 lg:max-h-none">
              {shown.map((b) => {
                const m = last[b.id];
                const on = b.id === brand.id;
                const n = unread[b.id] || 0;
                return (
                  <li key={b.id}>
                    <Link href={href({ brand: b.id })} scroll={false} className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 transition ${on ? "bg-brand/10" : "hover:bg-panel-2"}`}>
                      <span className="relative">
                        <BrandMark name={b.name} size={40} />
                        {n > 0 && <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-panel" />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[13px] font-medium">{b.name}</span>
                          <span className={`shrink-0 text-[10px] ${n ? "font-medium text-brand" : "text-faint"}`}>{when(m?.created_at)}</span>
                        </span>
                        <span className="flex items-center justify-between gap-2">
                          <span className={`truncate text-[11.5px] ${n ? "text-ink" : "text-muted"}`}>
                            {m ? `${m.from_client ? "" : `${m.member?.name?.split(" ")[0] || "You"}: `}${m.body || (m.attachments?.length ? "📎 File" : "")}` : "No messages yet"}
                          </span>
                          {n > 0 && <span className="grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white">{n}</span>}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
              {!shown.length && <li className="px-3 py-6 text-center text-xs text-muted">No unread chats ✓</li>}
            </ul>
          </aside>

          {/* Conversation */}
          <div className="min-h-0 min-w-0">
            <BrandChat
              key={brand.id}
              brandId={brand.id}
              brandName={brand.name}
              side="team"
              meId={me.id}
              meName={me.name}
              initial={{ messages: chat.messages, reads: chat.reads }}
              lastReadAt={chat.mine[me.id] || null}
              load={brandChat.bind(null, brand.id)}
              send={sendBrandMessage.bind(null, brand.id)}
              upload={brandChatUpload.bind(null, brand.id)}
              markRead={markBrandRead.bind(null, brand.id)}
              className="h-[70svh] !rounded-none !border-0 !shadow-none lg:h-full"
              members={members}
            />
          </div>

          {/* The brand */}
          <aside className="hidden min-h-0 flex-col gap-4 overflow-y-auto border-l border-line p-5 xl:flex">
            <div className="flex flex-col items-center text-center">
              <BrandMark name={brand.name} size={72} />
              <h2 className="mt-3 text-lg font-medium">{brand.name}</h2>
              <p className="text-xs text-muted">{(brand.services || []).map((s) => s.name).join(" · ") || "Client"}</p>
              {brand.onboarded_at && <span className="mt-2 rounded-full bg-panel-2 px-2.5 py-1 text-[11px] text-muted">Client since {fmtDay(brand.onboarded_at)}</span>}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                ["tasks", "Tasks", `/brands/${brand.id}`],
                ["calendar", "Calendar", `/brands/${brand.id}?tab=calendar`],
                ["file", "Files", `/brands/${brand.id}?tab=files`],
                ["leads", "Lead", brand.lead?.id ? `/leads/${brand.lead.id}` : `/brands/${brand.id}?tab=about`],
              ].map(([icon, label, to]) => (
                <Link key={label} href={to} className="group flex flex-col items-center gap-1.5 text-[11px] text-muted hover:text-ink">
                  <span className="grid h-10 w-10 place-items-center rounded-full border border-line bg-panel transition group-hover:bg-panel-2">
                    <Icon name={icon} size={15} />
                  </span>
                  {label}
                </Link>
              ))}
            </div>
            <div className="rounded-2xl bg-panel-2 p-4">
              <div className="text-[11px] text-muted">Work so far</div>
              <div className="mt-1 text-lg font-medium">{c.done || 0} approved</div>
              <div className="mt-2 flex h-1.5 gap-1">
                <span className="rounded-full bg-brand" style={{ width: `${Math.max(3, pct)}%` }} />
                <span className="hatch flex-1 rounded-full" />
              </div>
              <div className="mt-2 text-[11px] text-muted">
                {c.open || 0} in work · {c.review || 0} to check{c.overdue ? <span className="text-rose-400"> · {c.overdue} late</span> : ""}
              </div>
              <Link href={`/brands/${brand.id}`} className="btn-primary btn-sm mt-3 w-full">
                Open workspace
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
