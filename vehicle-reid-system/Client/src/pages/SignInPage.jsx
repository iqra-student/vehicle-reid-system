import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function SignInPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!email || !password) {
      setFormError("Please enter both email and password.");
      return;
    }

    setSubmitting(true);
    try {
      const user = await login(email, password);
      const redirectTo =
        location.state?.from?.pathname ||
        (user?.role === "admin" ? "/admin/dashboard" : "/operator/dashboard");
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setFormError(err.message || "Invalid email or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      {/* Left panel: form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="flex items-baseline gap-2 mb-10">
            <span className="text-lg font-semibold tracking-wide text-slate-900">
              VSMS
            </span>
            <span className="text-[11px] tracking-[0.2em] text-slate-400 uppercase">
              Smart City
            </span>
          </div>

          <h1 className="text-2xl font-semibold text-slate-900 mb-1">
            Sign in
          </h1>
          <p className="text-sm text-slate-500 mb-8">
            Don&apos;t have an operator account?{" "}
            <Link
              to="/signup"
              className="font-medium text-slate-900 underline underline-offset-2"
            >
              Sign Up
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label
                htmlFor="email"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                Operator ID / e-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="unit.operator@city.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-xs font-medium text-slate-600 mb-1.5"
              >
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-slate-200 bg-slate-50 px-3.5 py-2.5 pr-10 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    /* Eye-off icon */
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.98 8.98 0 013.122-.063c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-1.282 1.282L3 3l18 18" />
                    </svg>
                  ) : (
                    /* Eye icon */
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400 hover:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-slate-600">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-slate-300 text-slate-900 focus:ring-slate-400"
                />
                Remember this device
              </label>
              <Link
                to="/forgot-password"
                className="text-slate-500 hover:text-slate-700 underline underline-offset-2"
              >
                Forgot password?
              </Link>
            </div>

            {formError && (
              <p className="text-sm text-red-600" role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-md bg-slate-900 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px] text-slate-400">
            By signing in, you agree to the guideline&apos;s{" "}
            <Link to="/data-handling-policy" className="underline">
              data handling policy
            </Link>{" "}
            and confirm access is limited to authorized monitoring duties.
          </p>
        </div>
      </div>

      {/* Right panel: brand / visual */}
      <div className="hidden md:flex md:w-1/2 relative overflow-hidden bg-gradient-to-br from-[#1a1230] via-[#241a3d] to-[#0f0a1c] text-white flex-col justify-between p-10">
        <div className="flex items-center justify-between text-xs text-white/60">
          <span className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
            All sectors online
          </span>
          <span>Support</span>
        </div>

        <div className="flex-1 flex flex-col justify-center">
          <div className="self-end mb-8 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-xs text-white/70">
            48–52 match rate
          </div>
          <MiniTrailChart />
        </div>

        <p className="text-lg font-medium text-white/90">
          Every camera. One trail.
        </p>
      </div>
    </div>
  );
}

function MiniTrailChart() {
  const bars = [40, 62, 30, 78, 52, 68];
  return (
    <div className="flex items-end gap-3 h-40">
      {bars.map((h, i) => (
        <div
          key={i}
          className="w-6 rounded-t-sm bg-gradient-to-t from-violet-500/40 to-violet-300"
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}
