import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { errorMessage } from "../api/client";
import { ErrorNote, Field } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export default function Login() {
  const { user, loading, signIn } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  if (loading) return <div className="loading">Loading…</div>;

  // Already signed in: go where they were headed, or home.
  if (user) {
    return <Navigate to={location.state?.from?.pathname ?? "/"} replace />;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");
    setBusy(true);
    try {
      await signIn(email.trim(), password);
      navigate(location.state?.from?.pathname ?? "/", { replace: true });
    } catch (err) {
      setError(errorMessage(err, "Could not sign in."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="fade-in"
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div className="page-head">
          <h1 className="page-title">Payroll</h1>
          <p className="muted" style={{ marginTop: 4 }}>
            Sign in to continue.
          </p>
        </div>

        <form className="form" onSubmit={handleSubmit}>
          {error ? <ErrorNote>{error}</ErrorNote> : null}

          <Field label="Email">
            <input
              className="field__input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
              autoFocus
            />
          </Field>

          <Field label="Password">
            <input
              className="field__input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>

          <button type="submit" className="btn btn--primary" disabled={busy}>
            {busy ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </main>
  );
}
