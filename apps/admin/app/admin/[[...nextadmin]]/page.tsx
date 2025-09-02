import { NextAdmin } from "@premieroctet/next-admin";
import { prisma, options } from "@/lib/next-admin-options";
import "@premieroctet/next-admin/dist/styles.css";

export default function AdminPage({
  params,
  searchParams,
}: {
  params: { nextadmin: string[] };
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  return (
    <NextAdmin
      apiBasePath="/api/admin"
      prisma={prisma}
      options={options}
      params={params}
      searchParams={searchParams}
    />
  );
}