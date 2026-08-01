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

export default function SignUpPage() {
  const { signup } = useAuth();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    setSubmitting(true);
    try {
      // Intentionally no "role" field anywhere in this form or request.
      // The backend always assigns role: "operator" on signup;
      // admin accounts are provisioned out-of-band (seed script / DB promotion).
      await signup(name, email, password);
      navigate("/operator/dashboard", { replace: true });
    } catch (err) {
      setFormError(err.message || "Signup failed. Please try again.");
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
            Create an operator account
          </h1>
          <p className="text-sm mb-8" style={{ color: "#4B617D" }}>
            Already have an account?{" "}
            <Link to="/signin" className="font-semibold underline underline-offset-2" style={{ color: SAPPHIRE }}>
              Sign in
            </Link>
          </p>

          <form onSubmit={handleSubmit} className="space-y-5" noValidate>
            <div>
              <label htmlFor="name" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
                Full name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                placeholder="Jane Operator"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                style={fieldStyle}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
            </div>

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
              <input
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                style={fieldStyle}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-xs font-semibold mb-1.5" style={{ color: "#4B617D" }}>
                Confirm password
              </label>
              <input
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full rounded-lg px-3.5 py-2.5 text-sm placeholder:text-[#93A2B8] focus:outline-none transition-shadow"
                style={fieldStyle}
                onFocus={onFieldFocus}
                onBlur={onFieldBlur}
              />
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

          <p className="mt-8 text-center text-[11px]" style={{ color: "#93A2B8" }}>
            New accounts are provisioned with operator access only.
            Camera registrations require admin approval before going live.
          </p>
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

        {/* faint radar ring, echoing the dashboard map */}
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