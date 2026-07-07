import { useForm } from "react-hook-form";
import { Sparkles } from "lucide-react";

interface LoginProps {
  onLogin: (displayName: string) => Promise<unknown>;
  loading: boolean;
  error: string | null;
}

interface LoginForm {
  displayName: string;
}

export function Login({ onLogin, loading, error }: LoginProps) {
  const { register, handleSubmit } = useForm<LoginForm>({ defaultValues: { displayName: "Marky" } });
  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand-mark">
          <Sparkles />
        </div>
        <h1>SolTower</h1>
        <p>Cozy Co-op Tower Defense Adventure</p>
        <form
          onSubmit={handleSubmit(async (values) => {
            await onLogin(values.displayName);
          })}
        >
          <label>
            Display name
            <input {...register("displayName")} minLength={2} maxLength={24} />
          </label>
          <button type="submit" disabled={loading}>
            {loading ? "Entering..." : "Enter SolBloom Village"}
          </button>
          {error ? <span className="form-error">{error}</span> : null}
        </form>
        <small>DEV_MODE uses mock Test Token only. No wallet or on-chain transaction exists.</small>
      </section>
    </main>
  );
}
