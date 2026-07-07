import { useForm } from "react-hook-form";

interface AdminLoginProps {
  onLogin: (email: string, password: string) => Promise<unknown>;
  loading: boolean;
  error: string | null;
}

interface LoginForm {
  email: string;
  password: string;
}

export function AdminLogin({ onLogin, loading, error }: AdminLoginProps) {
  const { register, handleSubmit } = useForm<LoginForm>({
    defaultValues: {
      email: "owner@soltower.local",
      password: "ChangeMe123!"
    }
  });

  return (
    <main className="admin-login">
      <section className="login-box">
        <h1>SolTower Admin</h1>
        <p>Development operations portal</p>
        <form
          onSubmit={handleSubmit(async (values) => {
            await onLogin(values.email, values.password);
          })}
        >
          <label>
            Email
            <input type="email" {...register("email")} />
          </label>
          <label>
            Password
            <input type="password" {...register("password")} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Checking..." : "Log In"}
          </button>
          {error ? <span className="error-text">{error}</span> : null}
        </form>
      </section>
    </main>
  );
}
