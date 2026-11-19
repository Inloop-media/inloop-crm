// Direct messages: talk one-to-one with your head, your team, or the other heads.
import Link from "next/link";
import Icon from "@/components/Icon";
import DirectChat from "@/components/DirectChat";
import { Avatar } from "@/components/ui";
import { requireMember } from "@/lib/auth";
import { dmContacts, loadConversation, threads } from "@/lib/dm";
import { canCreateLead, isSales, salesTeam } from "@/lib/permissions";
import { listAssignees } from "@/lib/leads";

export const metadata = { title: "Direct messages" };

const timeFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "numeric", minute: "2-digit" });
const dateFmt = new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short" });
const keyFmt = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" });
const nowMs = () => Date.now();
const when = (d) => (keyFmt.format(new Date(d)) === keyFmt.format(new Date(nowMs())) ? timeFmt.format(new Date(d)) : dateFmt.format(new Date(d)));
function preview(m, meId) {
  const you = m.from_id === meId ? "You: " : "";
  if (m.kind === "lead") return `${you}🟢 Lead · ${m.meta?.brand || m.meta?.name || ""}`;
  if (m.body) return you + m.body;
  return `${you}📎 ${(m.attachments || []).length > 1 ? `${m.attachments.length} files` : m.attachments?.[0]?.name || "File"}`;
}

export default async function DmPage({ searchParams }) {
  const { with: withId } = await searchParams;
  const me = await requireMember();
  const [contacts, byOther] = await Promise.all([dmContacts(me), threads(me.id)]);
  // Conversations with recent messages first, then everyone else in the usual order (heads first)
  const list = [...contacts].sort((a, b) => {
    const ta = byOther[a.id]?.last.created_at || "";
    const tb = byOther[b.id]?.last.created_at || "";
    return tb.localeCompare(ta) || a.rank - b.rank || a.name.localeCompare(b.name);
  });
  const other = contacts.find((c) => c.id === withId) || null;
  const initial = other ? await loadConversation(me.id, other.id) : [];
  const canAddLeads = canCreateLead(me);
  // Sales executives share leads with their head; a head can also pass one to another head
  const canShareLead = Boolean(other) && isSales(me) && !canAddLeads;
  // Who the sales head can give a published lead to: themselves and their team (admin / ops: all of sales)
  const staff = me.role === "admin" || me.role === "ops";
  const assignees = canAddLeads && other ? (await listAssignees()).filter((m) => staff || m.id === me.id || salesTeam(me).includes(m.id)).map((m) => ({ id: m.id, name: m.name })) : [];

  return (
    <div className="page">
      <div className="rise card grid h-[calc(100svh-150px)] min-h-[520px] overflow-hidden p-0 md:grid-cols-[320px_minmax(0,1fr)]">
        {/* People */}
        <aside className={`min-h-0 flex-col border-line md:flex md:border-r ${other ? "hidden" : "flex"}`}>
          <div className="border-b border-line px-4 py-3.5">
            <h1 className="text-[17px] font-semibold tracking-tight">Direct messages</h1>
            <p className="text-xs text-muted">Your manager, your team and the other managers.</p>
          </div>
          <ul className="min-h-0 flex-1 overflow-y-auto p-2">
            {list.map((c) => {
              const t = byOther[c.id];
              const on = c.id === other?.id;
              return (
                <li key={c.id}>
                  <Link href={`/dm?with=${c.id}`} className={`flex items-center gap-3 rounded-xl px-2.5 py-2.5 transition ${on ? "bg-brand/10 ring-1 ring-inset ring-brand/30" : "hover:bg-panel-2"}`}>
                    <Avatar name={c.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[14px] ${t?.unread ? "font-semibold" : "font-medium"}`}>{c.name}</span>
                        {t && <span className={`shrink-0 text-[10.5px] ${t.unread ? "font-semibold text-brand" : "text-faint"}`}>{when(t.last.created_at)}</span>}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className={`min-w-0 flex-1 truncate text-[12px] ${t?.unread ? "text-ink" : "text-muted"}`}>{t ? preview(t.last, me.id) : c.label}</span>
                        {t?.unread > 0 && <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">{t.unread}</span>}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
            {!list.length && (
              <li className="px-4 py-10 text-center text-sm text-muted">
                No one to message yet. Once you&apos;re in a group with a manager (Team page), they show up here.
              </li>
            )}
          </ul>
        </aside>

        {/* The conversation */}
        <section className={`min-h-0 ${other ? "flex" : "hidden md:flex"} flex-col`}>
          {other ? (
            <DirectChat key={other.id} meId={me.id} other={other} initial={initial} canAddLeads={canAddLeads} canShareLead={canShareLead} assignees={assignees} />
          ) : (
            <div className="m-auto max-w-xs p-6 text-center text-sm text-muted">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-panel-2 text-brand">
                <Icon name="chat" size={20} />
              </div>
              Pick someone on the left to start a conversation.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
