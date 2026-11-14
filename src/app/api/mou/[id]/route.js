import { getCurrentMember } from "@/lib/auth";
import { getBrand } from "@/lib/brands";
import { buildMouPdf } from "@/lib/mou";
import { canOnboard } from "@/lib/permissions";

/** Live preview of the MOU draft as a PDF (admin / ops). ?download=1 saves it instead of opening it. */
export async function GET(request, { params }) {
  const me = await getCurrentMember();
  if (!me || !canOnboard(me)) return new Response("Not allowed", { status: 403 });
  const { id } = await params;
  const brand = await getBrand(id);
  if (!brand) return new Response("Not found", { status: 404 });
  const bytes = await buildMouPdf({
    brand: { ...brand, mou_version: brand.stage === "mou_draft" ? (brand.mou_version || 0) + 1 : brand.mou_version },
    lead: brand.lead,
    crmUrl: process.env.CRM_URL || new URL(request.url).origin,
  });
  const name = `MOU_${brand.name.replace(/[^\w]+/g, "_").slice(0, 60)}_x_Inloop.pdf`;
  const download = new URL(request.url).searchParams.has("download");
  return new Response(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
