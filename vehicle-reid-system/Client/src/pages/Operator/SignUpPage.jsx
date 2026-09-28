import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import vsmsLogo from "../../assets/vsms-logo.png";

// Sapphire Veil palette — matches OperatorLayout / OperatorDashboard
const INK = "#0D2440";
const SAPPHIRE = "#2E5E99";
const STEEL = "#7BA4D0";
const DEEP = "#0C1A2B";
const CORAL = "#B25C50";

// Company domain admins must sign up with. Set via .env:
//   VITE_ADMIN_EMAIL_DOMAIN=company.com
// This is bundled into the JS (not a secret) — it's only for instant
// feedback here. The Express signup route MUST re-check
// process.env.ADMIN_EMAIL_DOMAIN server-side, or this is bypassable.
const ADMIN_EMAIL_DOMAIN = (
  import.meta.env.VITE_ADMIN_EMAIL_DOMAIN || "company.com"
).toLowerCase();

function isAdminEmailAllowed(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return domain === ADMIN_EMAIL_DOMAIN;
}

const VsmsLogoMark = ({ className = "h-8 w-8" }) => (
  <svg viewBox="0 0 32 32" className={className} fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect width="32" height="32" rx="8" fill="url(#vsmsGrad)" />
    <circle cx="14" cy="16" r="7" stroke="white" strokeWidth="2" />
    <circle cx="14" cy="16" r="2.3" fill="white" />
    <circle cx="25" cy="8" r="1.6" fill="#7BA4D0" />
    <circle cx="21" cy="11" r="1.2" fill="#7BA4D0" opacity="0.7" />
    <circle cx="18" cy="13.5" r="0.9" fill="#7BA4D0" opacity="0.4" />
    <defs>
      <linearGradient id="vsmsGrad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
        <stop stopColor="#2E5E99" />
        <stop offset="1" stopColor="#0D2440" />
      </linearGradient>
    </defs>
  </svg>
);

// Small eye / eye-off icon, matches SignInPage
const EyeIcon = ({ open }) =>
  open ? (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.98 8.98 0 013.122-.063c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-1.282 1.282L3 3l18 18" />
    </svg>
  ) : (
    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );

export default function SignUpPage() {
const { signup, adminSignup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [role, setRole] = useState("operator"); // "operator" | "admin"
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError("");

    if (!name || !email || !password || !confirmPassword) {
      setFormError("Please fill in all fields.");
      return;
    }
    if (password.length < 8) {
      setFormError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setFormError("Passwords do not match.");
      return;
    }
    if (role === "admin" && !isAdminEmailAllowed(email)) {
      setFormError(
        `Admin accounts must sign up with a "${ADMIN_EMAIL_DOMAIN}" e-mail address.`
      );
      return;
    }

    setSubmitting(true);
    try {
     if (role === "admin") {
  await adminSignup(name, email, password);
  navigate("/admin/dashboard", { replace: true });
} else {
  await signup(name, email, password);
  navigate("/operator/dashboard", { replace: true });
}
    } catch (err) {
      setFormError(err.message || "Signup failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const fieldStyle = { border: "1px solid #E4EAF2", backgroundColor: "#EAF0FB", color: INK };
  const onFieldFocus = (e) => {
    e.target.style.boxShadow = `0 0 0 3px ${SAPPHIRE}22`;
    e.target.style.borderColor = STEEL;
  };
  const onFieldBlur = (e) => {
    e.target.style.boxShadow = "none";
    e.target.style.borderColor = "#E4EAF2";
  };

  return (
<div className="min-h-screen w-full flex flex-col md:flex-row bg-white overflow-hidden">      {/* Left panel: form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 py-10 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-6">
            <VsmsLogoMark className="h-8 w-8" />
            <span
              className="text-[11px] tracking-[0.2em] uppercase font-mono pl-2.5"
              style={{ color: STEEL, borderLeft: "1px solid #E4EAF2" }}
            >
              CityTrace
            </span>
          </div>

          <h1 className="text-xl font-semibold mb-1" style={{ color: INK }}>
            Create an account
          </h1>
          <p className="text-sm mb-5" style={{ color: "#4B617D" }}>
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold underline underline-offset-2" style={{ color: SAPPHIRE }}>
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-3" noValidate>
            <div>
              <label htmlFor="name" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                style={fieldStyle}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
            </div>

<div>
  <label htmlFor="role" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
    Role
  </label>
  <select
    id="role"
    value={role}
    onChange={(e) => setRole(e.target.value)}
    className="w-full rounded-lg px-3.5 py-2 text-sm focus:outline-none transition-shadow"
    style={fieldStyle}
    onFocus={onFieldFocus}
    onBlur={onFieldBlur}
  >
    <option value="operator">Operator</option>
    <option value="admin">Admin</option>
  </select>
</div>

            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
                E-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder={role === "admin" ? `abc@${ADMIN_EMAIL_DOMAIN}` : "abc@gmail.com"}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                style={fieldStyle}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
              {role === "admin" && (
                <p className="mt-1.5 text-[11px]" style={{ color: "#93A2B8" }}>
                  Admin accounts require a @{ADMIN_EMAIL_DOMAIN} address.
                </p>
              )}
            </div>

            <div>
<label htmlFor="password" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
  Password
</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2 pr-10 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                  style={fieldStyle}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 transition-colors"
                  style={{ color: "#93A2B8" }}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showPassword} />
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
                Confirm password
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  autoComplete="new-password"
                  placeholder="••••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full rounded-lg px-3.5 py-2 pr-10 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                  style={fieldStyle}
                  onFocus={onFieldFocus}
                  onBlur={onFieldBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((s) => !s)}
                  className="absolute inset-y-0 right-0 flex items-center px-3 transition-colors"
                  style={{ color: "#93A2B8" }}
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  <EyeIcon open={showConfirmPassword} />
                </button>
              </div>
            </div>
<div className="text-right -mt-1.5">
  <Link to="/forgot-password" className="text-[11px] underline underline-offset-2 transition-colors" style={{ color: "#93A2B8" }}>
    Forgot password?
  </Link>
</div>
            {formError && (
              <p className="text-sm font-medium" style={{ color: CORAL }} role="alert">
                {formError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg py-2.5 text-sm font-semibold text-white transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ backgroundColor: submitting ? SAPPHIRE : INK }}
              onMouseEnter={(e) => !submitting && (e.currentTarget.style.backgroundColor = SAPPHIRE)}
              onMouseLeave={(e) => !submitting && (e.currentTarget.style.backgroundColor = INK)}
            >
              {submitting ? "Creating account..." : "Create account"}
            </button>
          </form>

        </div>
      </div>

      {/* Right panel: brand / visual */}
      <div
        className="hidden md:flex md:w-1/2 relative overflow-hidden flex-col justify-between p-10"
        style={{ background: `radial-gradient(ellipse 900px 500px at 80% -10%, ${SAPPHIRE}33, transparent 60%), ${DEEP}` }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, ${STEEL}14 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, ${STEEL}14 0 1px, transparent 1px 34px)`,
          }}
        />

        <div className="absolute rounded-full border" style={{ width: 340, height: 340, right: -80, top: 40, borderColor: `${STEEL}22` }} />

        <div className="relative flex items-center justify-between text-xs" style={{ color: "#B7CBE2" }}>
          <span className="flex items-center gap-2">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-70" style={{ backgroundColor: STEEL }} />
              <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ backgroundColor: STEEL }} />
            </span>
            All sectors online
          </span>
          <span>Support</span>
        </div>

        <div className="relative flex-1 flex flex-col items-center justify-center gap-5">
          <RadarVisual />
          <p className="text-sm max-w-xs text-center" style={{ color: "#B7CBE2" }}>
            Operators can monitor and register cameras. Admins review and
            approve every camera before it feeds the tracking pipeline.
          </p>
        </div>

        <div className="relative flex flex-col gap-3">
          <p className="text-lg font-medium text-white">Every camera. One trail.</p>
          <div className="flex items-center gap-1.5">
            <span className="w-5 h-1.5 rounded-full" style={{ backgroundColor: STEEL }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${STEEL}55` }} />
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `${STEEL}55` }} />
          </div>
        </div>
      </div>
    </div>
  );
}

function RadarVisual() {
  const blips = [
    { top: "28%", left: "36%", delay: "0s" },
    { top: "64%", left: "26%", delay: "0.6s" },
    { top: "70%", left: "66%", delay: "1.2s" },
    { top: "22%", left: "70%", alert: true, delay: "0.3s" },
  ];
  const size = 240;
  const ticks = Array.from({ length: 24 });

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <style>{`
        @keyframes radarSweepBeam { to { transform: rotate(360deg); } }
        .radar-beam { animation: radarSweepBeam 3.2s linear infinite; transform-origin: 50% 50%; }
        @keyframes radarCenterPulse { 0%, 100% { transform: scale(1); opacity: 1; } 50% { transform: scale(1.6); opacity: 0.4; } }
        .radar-center-el { animation: radarCenterPulse 2s ease-in-out infinite; }
        @keyframes radarPing { 0% { transform: scale(0.4); opacity: 0.8; } 100% { transform: scale(2.6); opacity: 0; } }
        .radar-ping-el { animation: radarPing 2.4s ease-out infinite; }
        @keyframes radarBlip { 0%, 100% { opacity: 1; } 50% { opacity: 0.55; } }
        .radar-blip-el { animation: radarBlip 2s ease-in-out infinite; }
      `}</style>

      <div
        className="absolute rounded-full"
        style={{ inset: -30, background: `radial-gradient(circle, ${STEEL}12, transparent 70%)` }}
      />

      {ticks.map((_, i) => {
        const angle = (360 / ticks.length) * i;
        const major = i % 6 === 0;
        return (
          <div
            key={i}
            className="absolute left-1/2 top-1/2"
            style={{
              width: 1,
              height: major ? 8 : 4,
              backgroundColor: major ? `${STEEL}70` : `${STEEL}35`,
              transform: `rotate(${angle}deg) translateY(-${size / 2 - (major ? 8 : 4)}px)`,
              transformOrigin: "center",
            }}
          />
        );
      })}

      {[10, 40, 70, 100].map((inset, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{ inset, border: `1px solid ${i === 3 ? STEEL + "90" : STEEL + "30"}` }}
        />
      ))}

      <div className="absolute" style={{ left: "50%", top: 10, bottom: 10, width: 1, backgroundColor: `${STEEL}20` }} />
      <div className="absolute" style={{ top: "50%", left: 10, right: 10, height: 1, backgroundColor: `${STEEL}20` }} />

      <div className="absolute inset-[10px] rounded-full overflow-hidden radar-beam">
        <div
          className="absolute inset-0"
          style={{ background: `conic-gradient(from 0deg, ${STEEL}55, transparent 26%)` }}
        />
        <div
          className="absolute top-1/2 left-1/2"
          style={{
            width: "50%",
            height: 2,
            background: `linear-gradient(90deg, ${STEEL}, transparent)`,
            transform: "translateY(-50%)",
            boxShadow: `0 0 8px 1px ${STEEL}`,
          }}
        />
      </div>

      <div
        className="absolute rounded-full radar-center-el"
        style={{ top: "50%", left: "50%", width: 6, height: 6, backgroundColor: STEEL, transform: "translate(-50%,-50%)" }}
      />

      {blips.map((b, i) => (
        <div
          key={i}
          className="absolute"
          style={{ top: b.top, left: b.left, width: 8, height: 8, transform: "translate(-50%, -50%)" }}
        >
          <div
            className="absolute inset-0 rounded-full radar-ping-el"
            style={{ backgroundColor: b.alert ? CORAL : STEEL, animationDelay: b.delay }}
          />
          <div
            className="absolute inset-0 rounded-full radar-blip-el"
            style={{ backgroundColor: b.alert ? CORAL : STEEL, boxShadow: `0 0 6px 1px ${(b.alert ? CORAL : STEEL)}90` }}
          />
        </div>
      ))}
    </div>
  );
}