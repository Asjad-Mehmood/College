import { can, getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, ctx: RouteContext<"/api/violation-files/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!can.viewReports(user.role)) return new Response("Not allowed", { status: 403 });
  const id = Number((await ctx.params).id);
  if (!Number.isInteger(id)) return new Response("Not found", { status: 404 });
  const file = await prisma.violationAttachment.findUnique({ where: { id } });
  if (!file) return new Response("Not found", { status: 404 });
  const download = new URL(request.url).searchParams.has("download");
  const name = encodeURIComponent(file.fileName);
  return new Response(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(file.size),
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
