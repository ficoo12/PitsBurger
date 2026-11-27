import { AuthLayout } from "../components/layout/AuthLayout/AuthLayout";
import { LoginForm } from "../features/auth";

export function LoginPage() {
  return (
    <AuthLayout
      title="Log in to your account"
      description="Log in to manage schedules and employees."
    >
      <LoginForm />
    </AuthLayout>
  );
}
