import type { LoaderFunctionArgs } from "@remix-run/cloudflare";
import { redirect } from "@remix-run/cloudflare";

// Registration is disabled — authentication is managed via Cloudflare Access
export async function loader({ request }: LoaderFunctionArgs) {
  return redirect("/auth/login");
}

export default function RegisterPage() {
  return null;
}
