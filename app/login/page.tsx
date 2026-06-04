import { LoginForm } from "@/components/login-form";

export default function LoginPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  return <LoginForm nextPathPromise={searchParams} />;
}
