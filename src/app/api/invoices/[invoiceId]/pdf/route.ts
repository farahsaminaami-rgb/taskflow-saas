import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { pdfService } from "@/services/pdf.service";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  ctx: { params: Promise<{ invoiceId: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return NextResponse.json({ error: "Missing workspaceId" }, { status: 400 });

  const { invoiceId } = await ctx.params;

  try {
    const buf = await pdfService.renderInvoice(workspaceId, session.user.id, invoiceId);
    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="invoice-${invoiceId}.pdf"`,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch (error) {
    const status = error instanceof Error && /not found/i.test(error.message) ? 404 : 403;
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to render invoice PDF." },
      { status }
    );
  }
}
