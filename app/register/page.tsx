import { RegisterForm } from "@/components/register-form";

export default function RegisterPage({
  searchParams
}: {
  searchParams?: Promise<{ next?: string }>;
}) {
  return <RegisterForm nextPathPromise={searchParams} />;
}
