import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/** Serves an uploaded student photo to signed-in staff (gate staff included). */
export async function GET(_: Request, ctx: RouteContext<"/api/student-photo/[rollNo]">) {
  if (!(await getCurrentUser())) return new Response("Sign in required", { status: 401 });
  const rollNo = decodeURIComponent((await ctx.params).rollNo);
  const photo = await prisma.studentPhoto.findUnique({ where: { rollNo } });
  if (!photo) return new Response("Not found", { status: 404 });
  return new Response(new Uint8Array(photo.data), {
    headers: {
      "Content-Type": photo.mimeType,
      // The URL carries a version (?v=…), so the photo can be cached for long.
      "Cache-Control": "private, max-age=2592000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
