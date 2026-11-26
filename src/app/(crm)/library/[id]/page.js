import { driveConnection } from "@/lib/drive";
import { notFound } from "next/navigation";
import LibraryView from "@/components/LibraryView";
import { requireMember } from "@/lib/auth";
import { canSeeLibrary } from "@/lib/permissions";
import { LIBRARY_FOLDERS, brandLibrary, canDeleteLibrary, canManageLibrary } from "@/lib/library";
import { db } from "@/lib/supabase/server";

const isUuid = (v) => /^[0-9a-f-]{36}$/i.test(String(v || ""));

export async function generateMetadata({ params }) {
  const { id } = await params;
  const { data } = isUuid(id) ? await db().from("brands").select("name").eq("id", id).maybeSingle() : { data: null };
  return { title: data ? `${data.name} · Library` : "Library" };
}

export default async function BrandLibraryPage({ params, searchParams }) {
  const { id } = await params;
  const { folder } = await searchParams;
  const me = await requireMember(canSeeLibrary);
  if (!isUuid(id)) notFound();
  const lib = await brandLibrary(id, me);
  if (!lib) notFound();
  return <LibraryView brand={lib.brand} assets={lib.assets} subfolders={lib.subfolders} foldersReady={lib.foldersReady} completed={lib.completed} missing={lib.missing} folders={LIBRARY_FOLDERS} canManage={canManageLibrary(me)} canDelete={canDeleteLibrary(me)} initialFolder={folder} locked={lib.locked} lockedCount={lib.lockedCount} canOpenLocked={!lib.locked.length} drive={Boolean((await driveConnection())?.root_id)} isAdmin={me.role === "admin"} />;
}
