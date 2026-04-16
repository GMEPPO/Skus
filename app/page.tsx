import { redirect } from "next/navigation";

export default function HomePage() {
  const isDemo = process.env.SKIP_AUTH === "true";
  redirect(isDemo ? "/dashboard" : "/login");
}
