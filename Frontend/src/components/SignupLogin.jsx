import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
} from "lucide-react";

import { useAuth } from "../context/authContext.jsx";

const BRAND = {
  name: "Dastarkhwan",
  descriptor: "Hyderabadi kitchen",
};

const ROUTES = {
  home: "/",
  terms: "/terms",
  privacy: "/privacy",
};

const ROLE_HOME = {
  customer: "/customer",
  central_admin: "/admin",
  outlet_manager: "/manager",
};

const ROLE_LABEL = {
  customer: "Customer account",
  central_admin: "Central Admin",
  outlet_manager: "Outlet Manager",
};

const MODES = ["login", "signup", "staff"];
const OTP_LENGTH = 6;

const PHONE_RE = /^[6-9]\d{9}$/;
const PINCODE_RE = /^[1-9]\d{5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// These are only development phone-number prefill shortcuts.
// Authentication always goes through the real backend.
const DEMO_ENABLED = import.meta.env.DEV;

const HERO_IMAGE =
  "https://images.unsplash.com/photo-1589302168068-964664d93dc0?auto=format&fit=crop&w=1500&q=85";

function BrandMark({ className = "" }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={className}
      fill="none"
      aria-hidden="true"
    >
      <path d="M20 4v4M9 14c0-3.3 4.9-6 11-6s11 2.7 11 6M6 14h28M8 14c0 12 4.5 22 12 22s12-10 12-22M14 22c2.2 1.6 9.8 1.6 12 0" />
    </svg>
  );
}

function Logo({ light = false }) {
  return (
    <Link
      to={ROUTES.home}
      className={`sl-logo ${light ? "sl-logo-light" : ""}`}
      aria-label={`${BRAND.name} home`}
    >
      <BrandMark className="sl-mark" />
      <span>
        <strong>{BRAND.name}</strong>
        <small>{BRAND.descriptor}</small>
      </span>
    </Link>
  );
}

function Banner({ children, tone = "error" }) {
  const success = tone === "success";

  return (
    <div
      className={`sl-banner ${success ? "sl-banner-success" : ""}`}
      role={success ? "status" : "alert"}
    >
      {success ? <Check size={17} /> : <AlertCircle size={17} />}
      <span>{children}</span>
    </div>
  );
}

function Field({ id, label, error, hint, children }) {
  return (
    <div className="sl-field">
      <label htmlFor={id}>{label}</label>

      {children}

      {error ? (
        <p
          id={id ? `${id}-error` : undefined}
          className="sl-field-error"
          role="alert"
        >
          {error}
        </p>
      ) : hint ? (
        <p id={id ? `${id}-hint` : undefined} className="sl-field-hint">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function OtpInput({ digits, onChange, disabled, hasError }) {
  const refs = useRef([]);

  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const focusAt = (index) => {
    refs.current[Math.max(0, Math.min(OTP_LENGTH - 1, index))]?.focus();
  };

  const handleChange = (index, event) => {
    const chars = event.target.value.replace(/\D/g, "");
    const next = [...digits];

    if (!chars) {
      next[index] = "";
      onChange(next);
      return;
    }

    if (chars.length > 1) {
      chars
        .slice(0, OTP_LENGTH)
        .split("")
        .forEach((char, position) => {
          next[position] = char;
        });

      onChange(next);
      focusAt(Math.min(chars.length, OTP_LENGTH) - 1);
      return;
    }

    next[index] = chars;
    onChange(next);

    if (index < OTP_LENGTH - 1) {
      focusAt(index + 1);
    }
  };

  const handleKeyDown = (index, event) => {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      event.preventDefault();

      const next = [...digits];
      next[index - 1] = "";

      onChange(next);
      focusAt(index - 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      focusAt(index - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      focusAt(index + 1);
    }
  };

  const handlePaste = (event) => {
    const pasted = event.clipboardData
      .getData("text")
      .replace(/\D/g, "")
      .slice(0, OTP_LENGTH);

    if (!pasted) return;

    event.preventDefault();

    const next = Array(OTP_LENGTH).fill("");

    pasted.split("").forEach((char, index) => {
      next[index] = char;
    });

    onChange(next);
    focusAt(Math.min(pasted.length, OTP_LENGTH) - 1);
  };

  return (
    <div className="sl-otp" role="group" aria-label="One-time password">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          value={digit}
          onChange={(event) => handleChange(index, event)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          onFocus={(event) => event.target.select()}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          aria-invalid={hasError}
          disabled={disabled}
        />
      ))}
    </div>
  );
}

const COPY = {
  login: {
    eyebrow: "WELCOME BACK",
    title: "Good to have you back.",
    description: "Sign in to pick up where the good food left off.",
  },
  signup: {
    eyebrow: "JOIN OUR TABLE",
    title: "Make yourself at home.",
    description:
      "Create an account and get closer to the flavours of Hyderabad.",
  },
  staff: {
    eyebrow: "TEAM ACCESS",
    title: "Staff sign in.",
    description:
      "Secure access for authorised restaurant staff. Your role is assigned to your account.",
  },
};

export default function SignupLogin({
  initialMode = "login",
  onAuthenticated,
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const { user: authenticatedUser, requestOtp, login } = useAuth();

  const requestedMode = searchParams.get("mode");

  const mode = MODES.includes(requestedMode) ? requestedMode : initialMode;

  const copy = COPY[mode];

  const [step, setStep] = useState("details");
  const [status, setStatus] = useState("idle");

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [pincode, setPincode] = useState("");
  const [email, setEmail] = useState("");

  const [accepted, setAccepted] = useState(false);

  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState("");

  const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(""));

  const [otpError, setOtpError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  // This value comes only from the backend response.
  // It is never generated or hardcoded in the frontend.
  const [devOtp, setDevOtp] = useState(null);

  const [showDemo, setShowDemo] = useState(false);

  const phoneRef = useRef(null);
  const nameRef = useRef(null);

  const busy = status !== "idle";
  const otp = otpDigits.join("");

  const showTabs = step === "details" && mode !== "staff";

  useEffect(() => {
    if (resendIn <= 0) return undefined;

    const timer = window.setTimeout(
      () => setResendIn((value) => value - 1),
      1000,
    );

    return () => window.clearTimeout(timer);
  }, [resendIn]);

  const setMode = (nextMode) => {
    setStep("details");
    setStatus("idle");
    setErrors({});
    setFormError("");
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setOtpError("");
    setResendIn(0);
    setDevOtp(null);

    setSearchParams({ mode: nextMode }, { replace: true });
  };
  const getSignupProfile = () => ({
    name: name.trim(),
    email: email.trim(),
    pincode: pincode.trim(),
  });

  const finish = () => {
    if (!authenticatedUser) return;

    if (onAuthenticated) {
      onAuthenticated(authenticatedUser);
      return;
    }

    const destination = ROLE_HOME[authenticatedUser.role] || "/auth";

    const target =
      authenticatedUser.role === "customer" && authenticatedUser.pincode
        ? `${destination}?pincode=${encodeURIComponent(
            authenticatedUser.pincode,
          )}`
        : destination;

    navigate(target, { replace: true });
  };

  useEffect(() => {
    if (step !== "success" || !authenticatedUser) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      finish();
    }, 2200);

    return () => window.clearTimeout(timer);

    // finish uses the current authenticated user and navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, authenticatedUser]);

  const validate = () => {
    const next = {};

    if (mode === "signup") {
      if (name.trim().length < 2) {
        next.name = "Enter your full name.";
      } else if (name.trim().length > 60) {
        next.name = "Name must be 60 characters or fewer.";
      }

      if (!PINCODE_RE.test(pincode)) {
        next.pincode = "Enter a valid 6-digit Indian delivery pincode.";
      }

      if (email.trim() && !EMAIL_RE.test(email.trim())) {
        next.email = "Enter a valid email address or leave it blank.";
      }

      if (!accepted) {
        next.terms =
          "Accept the Terms and Privacy Policy to create an account.";
      }
    }

    if (!PHONE_RE.test(phone)) {
      next.phone = "Enter a valid 10-digit Indian mobile number.";
    }

    return next;
  };

  const sendOtp = async (isResend = false) => {
    setStatus("sending");
    setFormError("");

    try {
      const payload = {
        phone: phone.trim(),
        intent: mode,
        ...(mode === "signup" ? { profile: getSignupProfile() } : {}),
      };

      const response = await requestOtp(payload);

      setOtpDigits(Array(OTP_LENGTH).fill(""));
      setOtpError("");

      const resendSeconds = Number(response?.resendAfterSeconds ?? 0);

      setResendIn(
        Number.isFinite(resendSeconds) ? Math.max(0, resendSeconds) : 0,
      );

      setDevOtp(typeof response?.devOtp === "string" ? response.devOtp : null);

      if (!isResend) {
        setStep("otp");
      }
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setStatus("idle");
    }
  };

  const handleDetailsSubmit = (event) => {
    event.preventDefault();

    if (busy) return;

    const found = validate();

    setErrors(found);

    if (Object.keys(found).length) {
      if (found.name) {
        nameRef.current?.focus();
      } else if (found.phone) {
        phoneRef.current?.focus();
      }

      return;
    }

    sendOtp();
  };

  const handleVerify = async (event) => {
    event.preventDefault();

    if (busy) return;

    if (otp.length !== OTP_LENGTH) {
      setOtpError(`Enter the ${OTP_LENGTH}-digit code.`);
      return;
    }

    setStatus("verifying");
    setOtpError("");
    setFormError("");

    try {
      const payload = {
        phone: phone.trim(),
        otp,
        intent: mode,

        // The current backend signup controller also needs
        // this profile when creating the customer account.
        ...(mode === "signup" ? { profile: getSignupProfile() } : {}),
      };

      await login(payload);

      // AuthContext now contains the backend-returned user.
      setStep("success");
    } catch (error) {
      setOtpError(
        error instanceof Error ? error.message : "Unable to verify this code.",
      );

      setOtpDigits(Array(OTP_LENGTH).fill(""));

      if (
        [
          "OTP_EXPIRED",
          "OTP_NOT_FOUND",
          "OTP_ATTEMPTS_EXCEEDED",
          "OTP_NO_LONGER_VALID",
          "OTP_ALREADY_USED",
        ].includes(error?.code)
      ) {
        setResendIn(0);
      }
    } finally {
      setStatus("idle");
    }
  };

  const changeNumber = () => {
    setStep("details");
    setOtpDigits(Array(OTP_LENGTH).fill(""));
    setOtpError("");
    setFormError("");
    setResendIn(0);
    setDevOtp(null);

    window.setTimeout(() => phoneRef.current?.focus(), 0);
  };

  const applyDemoAccount = (demoPhone, nextMode) => {
    setPhone(demoPhone);
    setErrors({});
    setFormError("");

    if (nextMode !== mode) {
      setMode(nextMode);
    }
  };

  const formattedPhone = useMemo(
    () => `+91 ${phone.slice(0, 5)} ${phone.slice(5)}`,
    [phone],
  );

  return (
    <div className="sl-root">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@500;600;700&display=swap');
        .sl-root{--ivory:#f8f5ee;--paper:#fffdf8;--ink:#25231f;--muted:#716d65;--rust:#ad572b;--rust-dark:#8f4522;--sage:#59664a;--line:#e8e1d5;min-height:100vh;background:var(--ivory);color:var(--ink);font-family:'DM Sans',Arial,sans-serif;-webkit-font-smoothing:antialiased}
        .sl-root *{box-sizing:border-box}.sl-root button,.sl-root input{font:inherit}.sl-root a{color:inherit;text-decoration:none}
        .sl-shell{min-height:100vh;display:grid;grid-template-columns:minmax(0,1.03fr) minmax(440px,.97fr)}
        .sl-visual{position:sticky;top:0;height:100vh;min-height:680px;overflow:hidden;background:#292820;color:var(--ivory)}
        .sl-visual:before{content:'';position:absolute;inset:0;background:linear-gradient(180deg,#17161122 5%,#17161118 35%,#171611dc 100%);z-index:1}
        .sl-visual img{width:100%;height:100%;object-fit:cover;filter:saturate(.82)}
        .sl-visual-content{position:absolute;z-index:2;left:clamp(34px,6vw,88px);right:clamp(34px,6vw,88px);bottom:clamp(42px,8vh,90px)}
        .sl-visual-logo{display:flex;align-items:center;gap:12px;color:#e0a078}
        .sl-visual-logo span{font:600 24px 'Playfair Display',Georgia,serif;color:#fffaf1}
        .sl-visual-content h2{max-width:600px;margin:28px 0 14px;font:500 clamp(42px,5vw,68px)/1.04 'Playfair Display',Georgia,serif;letter-spacing:-1.8px}
        .sl-visual-content p{max-width:430px;color:#ffffffbd;font-size:14px;line-height:1.8}
        .sl-visual-note{display:flex;align-items:center;gap:10px;margin-top:26px;color:#fff9;font-size:12px;letter-spacing:.4px}
        .sl-visual-note svg{color:#e0a078}
        .sl-panel{display:flex;justify-content:center;align-items:center;padding:54px clamp(28px,6vw,84px);min-height:100vh}
        .sl-content{width:100%;max-width:440px}
        .sl-mobile-brand{display:none}
        .sl-logo{display:inline-flex;align-items:center;gap:10px}
        .sl-mark{width:36px;height:36px;stroke:var(--rust);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;flex-shrink:0}
        .sl-logo strong{display:block;font:600 22px/1 'Playfair Display',Georgia,serif;letter-spacing:-.4px}
        .sl-logo small{display:block;margin-top:4px;color:var(--muted);font-size:11px}
        .sl-eyebrow{display:flex;align-items:center;gap:9px;margin-top:44px;color:var(--rust);font-size:10px;font-weight:700;letter-spacing:2px}
        .sl-eyebrow:before{content:'';width:22px;height:1px;background:currentColor}
        .sl-heading{margin:16px 0 10px;font:500 clamp(36px,4vw,49px)/1.08 'Playfair Display',Georgia,serif;letter-spacing:-1.2px}
        .sl-description{margin:0;color:var(--muted);font-size:14px;line-height:1.8}
        .sl-tabs{display:grid;grid-template-columns:1fr 1fr;gap:5px;padding:5px;margin-top:30px;border:1px solid var(--line);background:#f0ece3;border-radius:5px}
        .sl-tabs button{height:42px;border:0;border-radius:3px;background:transparent;color:var(--muted);font-size:13px;font-weight:600;cursor:pointer}
        .sl-tabs button[aria-pressed=true]{background:var(--ink);color:white;box-shadow:0 2px 7px #00000012}
        .sl-form{display:grid;gap:19px;margin-top:30px}
        .sl-field label{display:block;margin-bottom:8px;font-size:12px;font-weight:700}
        .sl-input,.sl-phone-input{width:100%;height:49px;border:1px solid #dcd5c9;border-radius:4px;background:white;color:var(--ink);outline:none;transition:border .18s,box-shadow .18s}
        .sl-input{padding:0 14px}.sl-input::placeholder,.sl-phone-input input::placeholder{color:#aaa49a}
        .sl-input:focus,.sl-phone-input:focus-within{border-color:var(--rust);box-shadow:0 0 0 3px #ad572b18}
        .sl-input[aria-invalid=true],.sl-phone-input.sl-invalid{border-color:#a52e25}
        .sl-phone-input{display:flex;align-items:center;overflow:hidden}
        .sl-phone-prefix{height:100%;display:flex;align-items:center;padding:0 14px;border-right:1px solid var(--line);color:var(--muted);font-size:14px}
        .sl-phone-input input{height:100%;min-width:0;flex:1;padding:0 14px;border:0;outline:0;background:transparent}
        .sl-field-hint,.sl-field-error{margin:7px 0 0;font-size:11px;line-height:1.5}.sl-field-hint{color:#898378}.sl-field-error{color:#a52e25}
        .sl-checkbox-row{display:flex;align-items:flex-start;gap:10px;color:#625e56;font-size:12px;line-height:1.7}
        .sl-checkbox-row input{width:15px;height:15px;margin:2px 0 0;accent-color:var(--rust);flex-shrink:0}
        .sl-inline-link{color:var(--rust-dark);font-weight:700;text-decoration:underline;text-underline-offset:3px}
        .sl-submit{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;min-height:49px;margin-top:2px;border:1px solid var(--rust);border-radius:4px;background:var(--rust);color:white;font-size:13px;font-weight:700;cursor:pointer;transition:background .2s,transform .2s}
        .sl-submit:hover:not(:disabled){background:var(--rust-dark);transform:translateY(-1px)}
        .sl-submit:disabled{opacity:.65;cursor:not-allowed}
        .sl-banner{display:flex;align-items:flex-start;gap:10px;padding:12px 13px;border:1px solid #a52e2530;border-radius:4px;background:#a52e2509;color:#9a3027;font-size:12px;line-height:1.6}
        .sl-banner svg{flex-shrink:0;margin-top:1px}
        .sl-banner-success{border-color:#59664a45;background:#59664a12;color:#4d5b3f}
        .sl-secondary{display:grid;gap:14px;margin-top:25px;padding-top:21px;border-top:1px solid var(--line);color:#706b62;font-size:12px}
        .sl-secondary p{margin:0}
        .sl-secondary button{padding:0;border:0;background:none;color:var(--rust-dark);font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .sl-secondary .sl-terms{color:#918b80;font-size:11px;line-height:1.7}
        .sl-otp{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:9px}
        .sl-otp input{width:100%;height:54px;min-width:0;border:1px solid var(--line);border-radius:4px;background:white;text-align:center;font-size:20px;font-weight:600;outline:none}
        .sl-otp input:focus{border-color:var(--rust);box-shadow:0 0 0 3px #ad572b18}
        .sl-otp input[aria-invalid=true]{border-color:#a52e25}
        .sl-otp-meta{display:flex;justify-content:space-between;align-items:center;gap:12px;color:var(--muted);font-size:11px}
        .sl-otp-meta button{padding:0;border:0;background:none;color:var(--rust-dark);font-size:11px;font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
        .sl-demo{margin-top:24px;border:1px dashed #d8cfc0;border-radius:4px;background:#f1ece3;padding:13px}
        .sl-demo summary{cursor:pointer;font-size:11px;font-weight:700;color:#635d53}
        .sl-demo p{color:#827b70;font-size:11px;line-height:1.6}
        .sl-demo-actions{display:flex;flex-wrap:wrap;gap:7px}
        .sl-demo-actions button{padding:7px 9px;border:1px solid #ddd4c6;border-radius:3px;background:white;font-size:10px;font-weight:600;cursor:pointer}
        .sl-success-icon{display:grid;place-items:center;width:54px;height:54px;margin-top:30px;border-radius:50%;background:#59664a;color:white}
        .sl-success-note{margin-top:20px;color:#8a8479;font-size:11px;line-height:1.6}
        .sl-back-link{display:inline-flex;align-items:center;gap:6px;margin-top:22px;border:0;background:none;color:#6e695f;font-size:12px;cursor:pointer}
        .sl-footer{display:flex;justify-content:space-between;gap:15px;margin-top:42px;padding-top:17px;border-top:1px solid var(--line);color:#999286;font-size:10px}
        .sl-footer-links{display:flex;gap:15px}
        .sl-footer a:hover{color:var(--rust)}
        @keyframes sl-spin{to{transform:rotate(360deg)}}.sl-spin{animation:sl-spin 1s linear infinite}
        .sl-root button:focus-visible,.sl-root a:focus-visible,.sl-root input:focus-visible,.sl-root summary:focus-visible{outline:2px solid var(--rust-dark);outline-offset:3px}
        @media(max-width:900px){.sl-shell{grid-template-columns:minmax(0, .8fr) minmax(400px,1fr)}.sl-panel{padding:42px 32px}.sl-visual-content{left:35px;right:35px}.sl-visual-content h2{font-size:48px}}
        @media(max-width:700px){.sl-shell{display:flex;flex-direction:column}.sl-visual{display:none}.sl-panel{min-height:100vh;align-items:flex-start;padding:27px 22px 34px}.sl-content{max-width:460px;margin:auto}.sl-mobile-brand{display:block;margin-bottom:37px}.sl-eyebrow{margin-top:0}.sl-heading{font-size:41px}.sl-tabs{margin-top:25px}.sl-form{margin-top:25px}.sl-footer{margin-top:32px}}
        @media(max-width:390px){.sl-panel{padding-left:17px;padding-right:17px}.sl-otp{gap:6px}.sl-otp input{height:49px;font-size:18px}.sl-heading{font-size:36px}}
        @media(prefers-reduced-motion:reduce){.sl-root *{scroll-behavior:auto!important;transition:none!important;animation:none!important}}
      `}</style>

      <div className="sl-shell">
        <aside className="sl-visual" aria-label="Dastarkhwan">
          <img
            src={HERO_IMAGE}
            alt="Traditional Hyderabadi biryani served in a handi"
          />

          <div className="sl-visual-content">
            <div className="sl-visual-logo">
              <BrandMark className="sl-mark" />
              <span>{BRAND.name}</span>
            </div>

            <h2>
              Cooked slowly.
              <br />
              Shared generously.
            </h2>

            <p>
              From our kitchen to your table, discover the warmth and character
              of authentic Hyderabadi food.
            </p>

            <div className="sl-visual-note">
              <ShieldCheck size={16} />A little tradition in every order
            </div>
          </div>
        </aside>

        <main className="sl-panel">
          <div className="sl-content">
            <div className="sl-mobile-brand">
              <Logo />
            </div>

            {step !== "success" && (
              <>
                {showTabs && (
                  <div
                    className="sl-tabs"
                    role="group"
                    aria-label="Account type"
                  >
                    <button
                      type="button"
                      onClick={() => setMode("login")}
                      aria-pressed={mode === "login"}
                    >
                      Log in
                    </button>

                    <button
                      type="button"
                      onClick={() => setMode("signup")}
                      aria-pressed={mode === "signup"}
                    >
                      Create account
                    </button>
                  </div>
                )}

                <div className="sl-eyebrow">
                  {step === "otp" ? "ONE LAST STEP" : copy.eyebrow}
                </div>

                <h1 className="sl-heading">
                  {step === "otp" ? "Verify your number." : copy.title}
                </h1>

                <p className="sl-description">
                  {step === "otp" ? (
                    <>
                      Enter the 6-digit code for{" "}
                      <strong>{formattedPhone}</strong>.{" "}
                      <button
                        className="sl-inline-link"
                        type="button"
                        onClick={changeNumber}
                        disabled={busy}
                      >
                        Change number
                      </button>
                    </>
                  ) : (
                    copy.description
                  )}
                </p>
              </>
            )}

            {step === "success" ? (
              <div>
                <div className="sl-success-icon">
                  <Check size={26} />
                </div>

                <div className="sl-eyebrow">ALL SET</div>

                <h1 className="sl-heading">
                  {mode === "signup"
                    ? "Welcome to the table."
                    : "You’re signed in."}
                </h1>

                <p className="sl-description">
                  {authenticatedUser?.name ? `${authenticatedUser.name}, ` : ""}
                  you’re signed in as{" "}
                  {ROLE_LABEL[authenticatedUser?.role] || "a customer"}.
                  {authenticatedUser?.pincode
                    ? ` Your delivery pincode is ${authenticatedUser.pincode}.`
                    : ""}{" "}
                  Taking you to the next page.
                </p>

                <button
                  type="button"
                  className="sl-submit"
                  style={{ marginTop: 28 }}
                  onClick={finish}
                >
                  Continue <ArrowRight size={16} />
                </button>

                <p className="sl-success-note">
                  Your session is verified by the backend and maintained through
                  a secure HTTP-only cookie.
                </p>
              </div>
            ) : (
              <>
                {step === "details" ? (
                  <form
                    className="sl-form"
                    onSubmit={handleDetailsSubmit}
                    noValidate
                  >
                    {formError && <Banner>{formError}</Banner>}

                    {mode === "signup" && (
                      <Field
                        id="signup-name"
                        label="Full name"
                        error={errors.name}
                      >
                        <input
                          ref={nameRef}
                          id="signup-name"
                          className="sl-input"
                          value={name}
                          onChange={(event) => setName(event.target.value)}
                          placeholder="Enter your full name"
                          autoComplete="name"
                          aria-invalid={Boolean(errors.name)}
                        />
                      </Field>
                    )}

                    <Field
                      id="auth-phone"
                      label="Mobile number"
                      error={errors.phone}
                      hint="We’ll send a one-time code to verify your number."
                    >
                      <div
                        className={`sl-phone-input ${
                          errors.phone ? "sl-invalid" : ""
                        }`}
                      >
                        <span className="sl-phone-prefix">+91</span>

                        <input
                          ref={phoneRef}
                          id="auth-phone"
                          type="tel"
                          inputMode="numeric"
                          autoComplete="tel-national"
                          maxLength={10}
                          value={phone}
                          onChange={(event) => {
                            setPhone(
                              event.target.value
                                .replace(/\D/g, "")
                                .slice(0, 10),
                            );

                            if (errors.phone) {
                              setErrors((previous) => ({
                                ...previous,
                                phone: undefined,
                              }));
                            }
                          }}
                          placeholder="10-digit mobile number"
                          aria-label="10-digit mobile number"
                          aria-invalid={Boolean(errors.phone)}
                        />
                      </div>
                    </Field>

                    {mode === "signup" && (
                      <>
                        <Field
                          id="signup-pincode"
                          label="Delivery pincode"
                          error={errors.pincode}
                          hint="We use this to identify the nearest outlet that can deliver to you."
                        >
                          <input
                            id="signup-pincode"
                            className="sl-input"
                            type="text"
                            inputMode="numeric"
                            autoComplete="postal-code"
                            maxLength={6}
                            pattern="[1-9][0-9]{5}"
                            required
                            value={pincode}
                            onChange={(event) => {
                              setPincode(
                                event.target.value
                                  .replace(/\D/g, "")
                                  .slice(0, 6),
                              );

                              if (errors.pincode) {
                                setErrors((previous) => ({
                                  ...previous,
                                  pincode: undefined,
                                }));
                              }
                            }}
                            placeholder="Enter 6-digit pincode"
                            aria-invalid={Boolean(errors.pincode)}
                            aria-describedby={
                              errors.pincode
                                ? "signup-pincode-error"
                                : "signup-pincode-hint"
                            }
                          />
                        </Field>

                        <Field
                          id="signup-email"
                          label="Email address (optional)"
                          error={errors.email}
                        >
                          <input
                            id="signup-email"
                            className="sl-input"
                            type="email"
                            autoComplete="email"
                            value={email}
                            onChange={(event) => setEmail(event.target.value)}
                            placeholder="you@example.com"
                            aria-invalid={Boolean(errors.email)}
                          />
                        </Field>

                        <div>
                          <label className="sl-checkbox-row">
                            <input
                              type="checkbox"
                              checked={accepted}
                              onChange={(event) => {
                                setAccepted(event.target.checked);

                                if (errors.terms) {
                                  setErrors((previous) => ({
                                    ...previous,
                                    terms: undefined,
                                  }));
                                }
                              }}
                            />

                            <span>
                              I agree to the{" "}
                              <Link
                                className="sl-inline-link"
                                to={ROUTES.terms}
                              >
                                Terms and Conditions
                              </Link>{" "}
                              and{" "}
                              <Link
                                className="sl-inline-link"
                                to={ROUTES.privacy}
                              >
                                Privacy Policy
                              </Link>
                              .
                            </span>
                          </label>

                          {errors.terms && (
                            <p className="sl-field-error" role="alert">
                              {errors.terms}
                            </p>
                          )}
                        </div>
                      </>
                    )}

                    <button className="sl-submit" type="submit" disabled={busy}>
                      {status === "sending" ? (
                        <>
                          <Loader2 size={17} className="sl-spin" />
                          Sending code…
                        </>
                      ) : (
                        <>
                          Continue <ArrowRight size={17} />
                        </>
                      )}
                    </button>
                  </form>
                ) : (
                  <form className="sl-form" onSubmit={handleVerify} noValidate>
                    {formError && <Banner>{formError}</Banner>}

                    <Field
                      label="One-time password"
                      error={otpError}
                      hint="Enter the 6-digit verification code."
                    >
                      <OtpInput
                        digits={otpDigits}
                        onChange={(next) => {
                          setOtpDigits(next);

                          if (otpError) {
                            setOtpError("");
                          }
                        }}
                        disabled={busy}
                        hasError={Boolean(otpError)}
                      />
                    </Field>

                    {devOtp && (
                      <Banner tone="success">
                        Development OTP returned by backend:{" "}
                        <strong>{devOtp}</strong>
                      </Banner>
                    )}

                    <button className="sl-submit" type="submit" disabled={busy}>
                      {status === "verifying" ? (
                        <>
                          <Loader2 size={17} className="sl-spin" />
                          Verifying…
                        </>
                      ) : (
                        <>
                          Verify and continue <ArrowRight size={17} />
                        </>
                      )}
                    </button>

                    <div className="sl-otp-meta">
                      {resendIn > 0 ? (
                        <span>
                          Resend available in 0:
                          {String(resendIn).padStart(2, "0")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => sendOtp(true)}
                          disabled={busy}
                        >
                          {status === "sending" ? "Sending…" : "Resend code"}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={changeNumber}
                        disabled={busy}
                      >
                        <ArrowLeft
                          size={13}
                          style={{
                            display: "inline",
                            verticalAlign: "middle",
                          }}
                        />{" "}
                        Change number
                      </button>
                    </div>
                  </form>
                )}

                {step === "details" && (
                  <div className="sl-secondary">
                    {mode === "login" && (
                      <p>
                        New to Dastarkhwan?{" "}
                        <button type="button" onClick={() => setMode("signup")}>
                          Create an account
                        </button>
                      </p>
                    )}

                    {mode === "signup" && (
                      <p>
                        Already have an account?{" "}
                        <button type="button" onClick={() => setMode("login")}>
                          Log in instead
                        </button>
                      </p>
                    )}

                    {mode === "staff" && (
                      <p>
                        <button type="button" onClick={() => setMode("login")}>
                          Back to customer sign in
                        </button>
                      </p>
                    )}

                    {mode !== "staff" && (
                      <p>
                        Restaurant staff?{" "}
                        <button type="button" onClick={() => setMode("staff")}>
                          Staff sign in
                        </button>
                      </p>
                    )}

                    {mode !== "signup" && (
                      <p className="sl-terms">
                        By continuing, you agree to our{" "}
                        <Link to={ROUTES.terms} className="sl-inline-link">
                          Terms
                        </Link>{" "}
                        and{" "}
                        <Link to={ROUTES.privacy} className="sl-inline-link">
                          Privacy Policy
                        </Link>
                        .
                      </p>
                    )}
                  </div>
                )}

                {DEMO_ENABLED && step === "details" && (
                  <details
                    className="sl-demo"
                    open={showDemo}
                    onToggle={(event) => setShowDemo(event.currentTarget.open)}
                  >
                    <summary>Development demo accounts</summary>

                    <p>
                      These buttons only prefill a test phone number. OTP
                      generation and verification still happen through the
                      backend.
                    </p>

                    <div className="sl-demo-actions">
                      <button
                        type="button"
                        onClick={() => applyDemoAccount("9000000101", "login")}
                      >
                        Customer
                      </button>

                      <button
                        type="button"
                        onClick={() => applyDemoAccount("9000000041", "staff")}
                      >
                        Rahul · Kondapur
                      </button>

                      <button
                        type="button"
                        onClick={() => applyDemoAccount("9000000042", "staff")}
                      >
                        Amit · Gachibowli
                      </button>

                      <button
                        type="button"
                        onClick={() => applyDemoAccount("9000000043", "staff")}
                      >
                        Priya · Kukatpally
                      </button>

                      <button
                        type="button"
                        onClick={() => applyDemoAccount("9000000001", "staff")}
                      >
                        Central Admin
                      </button>
                    </div>
                  </details>
                )}
              </>
            )}

            <footer className="sl-footer">
              <span>
                © {new Date().getFullYear()} {BRAND.name}
              </span>

              <span className="sl-footer-links">
                <Link to={ROUTES.privacy}>Privacy</Link>
                <Link to={ROUTES.terms}>Terms</Link>
                <Link to={ROUTES.home}>Home</Link>
              </span>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
