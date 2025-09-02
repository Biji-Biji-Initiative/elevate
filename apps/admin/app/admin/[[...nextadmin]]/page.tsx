import { NextAdmin } from "@premieroctet/next-admin";
import { options } from "@/lib/next-admin-options";
import "@premieroctet/next-admin/dist/styles.css";

export default async function AdminPage(props: {
  params: Promise<{ nextadmin: string[] }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await props.params;
  const searchParams = await props.searchParams;
  
  return (
    <NextAdmin
      apiBasePath="/api/admin"
      options={options}
      params={params}
      searchParams={searchParams}
    />
  );
}