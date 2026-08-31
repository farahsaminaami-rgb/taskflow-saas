import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-gate";

export default async function HomePage() {
  const session = await getSession();
  if (session?.user?.id) redirect("/app");
  redirect("/login");
}