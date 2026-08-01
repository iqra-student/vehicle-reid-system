
import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import vsmsLogo from "../../assets/vsms-logo.png";

// Sapphire Veil palette — matches OperatorLayout / OperatorDashboard
const INK = "#0D2440";
const SAPPHIRE = "#2E5E99";
const STEEL = "#7BA4D0";
const DEEP = "#0C1A2B";
const CORAL = "#B25C50";

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

  const fieldStyle = { border: "1px solid #E4EAF2", backgroundColor: "#FAFCFE", color: INK };
  const onFieldFocus = (e) => {
    e.target.style.boxShadow = `0 0 0 3px ${SAPPHIRE}22`;
    e.target.style.borderColor = STEEL;
  };
  const onFieldBlur = (e) => {
    e.target.style.boxShadow = "none";
    e.target.style.borderColor = "#E4EAF2";
  };

  return (
    <div className="min-h-screen w-full flex flex-col md:flex-row bg-white">
      {/* Left panel: form */}
      <div className="w-full md:w-1/2 flex items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-2.5 mb-10">
            <img src={vsmsLogo} alt="VSMS" className="h-6 w-auto" />
            <span
              className="text-[11px] tracking-[0.2em] uppercase font-mono pl-2.5"
              style={{ color: STEEL, borderLeft: "1px solid #E4EAF2" }}
            >
              Smart City
            </span>
          </div>

          <h1 className="text-2xl font-semibold mb-1" style={{ color: INK }}>
            Sign in
          </h1>
          <p className="text-sm mb-8" style={{ color: "#4B617D" }}>
            Don&apos;t have an operator account?{" "}
            <Link to="/signup" className="font-semibold underline underline-offset-2" style={{ color: SAPPHIRE }}>
              Sign Up
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
                Operator ID / e-mail
              </label>
              <input
                id="email"
                type="email"
                autoComplete="username"
                placeholder="unit.operator@city.gov"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                style={fieldStyle}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
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
                  className="w-full rounded-lg px-3.5 py-2.5 pr-10 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
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
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858-5.908a8.98 8.98 0 013.122-.063c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m-1.282 1.282L3 3l18 18" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2" style={{ color: "#4B617D" }}>
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded"
                  style={{ borderColor: "#E4EAF2", accentColor: SAPPHIRE }}
                />
                Remember this device
              </label>
              <Link to="/forgot-password" className="underline underline-offset-2 transition-colors" style={{ color: "#93A2B8" }}>
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
              {submitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <p className="mt-8 text-center text-[11px]" style={{ color: "#93A2B8" }}>
            By signing in, you agree to the guideline&apos;s{" "}
            <Link to="/data-handling-policy" className="underline" style={{ color: STEEL }}>
              data handling policy
            </Link>{" "}
            and confirm access is limited to authorized monitoring duties.
          </p>
        </div>
      </div>

      {/* Right panel: brand / visual */}
      <div
        className="hidden md:flex md:w-1/2 relative overflow-hidden flex-col justify-between p-10"
        style={{ background: `radial-gradient(ellipse 900px 500px at 25% -10%, ${SAPPHIRE}33, transparent 60%), ${DEEP}` }}
      >
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: `repeating-linear-gradient(0deg, ${STEEL}14 0 1px, transparent 1px 34px), repeating-linear-gradient(90deg, ${STEEL}14 0 1px, transparent 1px 34px)`,
          }}
        />

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

        <div className="relative flex justify-end -mt-1">
          <div
            className="flex items-center gap-2 rounded-full pl-3 pr-4 py-1.5 text-[11px] font-mono tracking-wide"
            style={{ border: `1px solid ${STEEL}40`, backgroundColor: `${STEEL}14`, color: "#DCE7F5" }}
          >
            <span style={{ color: STEEL }}>RE-ID MATCH</span>
            <span className="font-bold text-white">96%</span>
            <span className="w-8 h-px" style={{ background: `linear-gradient(90deg, ${STEEL}, transparent)` }} />
          </div>
        </div>

        <div className="relative flex-1 flex flex-col items-center justify-center gap-5">
          <RadarVisual />
          <span className="font-mono text-[9px] tracking-[0.15em]" style={{ color: `${STEEL}90` }}>
            NETWORK SYNC ACTIVE
          </span>
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

// Radar sweep visual, echoing the "Live City Map" panel on the dashboard —
// concentric rings, tick marks, a glowing rotating scan beam, a pulsing
// center, and camera blips that ping like live detections.
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

      {/* soft outer glow */}
      <div
        className="absolute rounded-full"
        style={{ inset: -30, background: `radial-gradient(circle, ${STEEL}12, transparent 70%)` }}
      />

      {/* tick marks around the outer ring */}
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

      {/* concentric rings */}
      {[10, 40, 70, 100].map((inset, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{ inset, border: `1px solid ${i === 3 ? STEEL + "90" : STEEL + "30"}` }}
        />
      ))}

      {/* crosshair */}
      <div className="absolute" style={{ left: "50%", top: 10, bottom: 10, width: 1, backgroundColor: `${STEEL}20` }} />
      <div className="absolute" style={{ top: "50%", left: 10, right: 10, height: 1, backgroundColor: `${STEEL}20` }} />

      {/* rotating scan beam: soft trail + crisp bright edge */}
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

      {/* pulsing center */}
      <div
        className="absolute rounded-full radar-center-el"
        style={{ top: "50%", left: "50%", width: 6, height: 6, backgroundColor: STEEL, transform: "translate(-50%,-50%)" }}
      />

      {/* camera blips with expanding ping rings */}
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