import { NextRequest } from "next/server";
import { createHandler } from "@premieroctet/next-admin/dist/appHandler";
import { options, prisma } from "@/lib/next-admin-options";
import { requireRole } from "@elevate/auth/server-helpers";

const { run } = createHandler({
  apiBasePath: "/api/admin",
  prisma,
  options,
  onRequest: async (req: NextRequest) => {
    // Use the proper auth helper that validates role from Clerk metadata
    // and ensures user has at least reviewer role
    await requireRole('reviewer');
  },
});

export { run as GET, run as POST, run as PUT, run as DELETE };