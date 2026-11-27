import { AuthLayout } from "../components/layout/AuthLayout/AuthLayout";
import { LoginForm } from "../features/auth";

export function LoginPage() {
  return (
    <AuthLayout title="Log in" description="Log in to enter your availability.">
      <LoginForm />
    </AuthLayout>
  );
}
