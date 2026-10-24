import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/useAuth';
import rajwadaImg from '../../assets/dkte-rajwada.jpg';
import dkteLogo from '../../assets/dkte-logo.png';
import {
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  Loader2,
  ShieldCheck,
  Building2,
  User,
  Sparkles,
} from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMessage('');

    const trimmedId = identifier.trim();
    if (!trimmedId) {
      setErrorMessage('Please enter your Email or PRN.');
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await login({
        email: trimmedId,
        password,
      });

      if (response?.user?.role === 'TPO') {
        navigate('/dashboard', { replace: true });
      } else {
        navigate('/portal/dossier', { replace: true });
      }
    } catch (err) {
      setErrorMessage(
        err.message || 'Invalid credentials. Please verify your Email/PRN and password.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillStudentDemo = () => {
    setIdentifier('2023CSE001');
    setPassword('2023CSE001');
    setErrorMessage('');
  };

  const fillTpoDemo = () => {
    setIdentifier('tpo@dkte.ac.in');
    setPassword('Admin@1234');
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen w-full flex flex-col lg:flex-row bg-[#F8FAFC]">
      {/* ========================================================= */}
      {/* LEFT COLUMN: DKTE Rajwada Campus Visual & Institutional Heritage */}
      {/* ========================================================= */}
      <div className="relative w-full lg:w-[58%] min-h-[340px] lg:min-h-screen overflow-hidden bg-gray-950 flex flex-col justify-between p-8 sm:p-12 lg:p-16">
        {/* Background Image with Crisp Object Fit */}
        <img
          src={rajwadaImg}
          alt="DKTE Society's Textile & Engineering Institute Rajwada Campus"
          className="absolute inset-0 w-full h-full object-cover object-center transform scale-105 filter brightness-90 contrast-105"
        />

        {/* Multi-Stop Cinematic Gradient Overlay */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-gray-950 via-gray-950/75 to-gray-950/40 lg:bg-gradient-to-r lg:from-gray-950/85 lg:via-gray-950/60 lg:to-gray-950/30"
          aria-hidden="true"
        />

        {/* Top Institutional Crest / Badges */}
        <div className="relative z-10 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/80 rounded px-2.5 py-1.5 flex items-center shadow-sm">
              <img
                src={dkteLogo}
                alt="DKTE Logo"
                className="h-6 w-auto object-contain"
              />
            </div>
            <span className="text-gray-300 text-xs font-medium tracking-wider uppercase border-l border-gray-600 pl-3">
              Autonomous Institute • Estd 1982
            </span>
          </div>

          <div className="hidden sm:inline-flex items-center space-x-1.5 px-2.5 py-1 rounded border border-gray-700 bg-gray-900/60 backdrop-blur-sm text-gray-300 text-xs font-medium">
            <ShieldCheck className="w-3.5 h-3.5 text-[#FECC00]" />
            <span>NAAC A+ Accredited</span>
          </div>
        </div>

        {/* Center / Bottom Institutional Heading */}
        <div className="relative z-10 max-w-xl my-auto lg:my-0 pt-10 pb-4">
          <div className="inline-flex items-center space-x-2 text-[#FECC00] text-xs sm:text-sm font-semibold tracking-wide uppercase mb-3">
            <Building2 className="w-4 h-4" />
            <span>Central Training &amp; Placement Cell</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-white tracking-tight leading-tight mb-3">
            D.K.T.E. Society&apos;s Textile &amp; Engineering Institute
          </h1>

          <p className="text-gray-300 text-sm leading-relaxed max-w-md font-normal">
            Official Placement Management Portal for campus recruitment drives, verified dossiers, and institutional analytics.
          </p>
        </div>

        {/* Footer Caption */}
        <div className="relative z-10 flex items-center justify-between text-gray-400 text-xs pt-4 border-t border-gray-800/60">
          <span>Rajwada Historic Campus, Ichalkaranji</span>
          <span className="font-medium text-gray-300">Placement Season 2025–26</span>
        </div>
      </div>

      {/* ========================================================= */}
      {/* RIGHT COLUMN: Institutional Sign-In Form Console */}
      {/* ========================================================= */}
      <div className="w-full lg:w-[42%] flex items-center justify-center p-6 sm:p-10 lg:p-14">
        <div className="w-full max-w-md bg-white border border-gray-200 rounded p-8 sm:p-10 shadow-hairline">
          {/* Header Accent Bar & Titles */}
          <div className="mb-7">
            <div className="flex items-center justify-between mb-4">
              <img
                src={dkteLogo}
                alt="DKTE Logo"
                className="h-10 w-auto object-contain"
              />
              <span className="text-[11px] font-semibold tracking-wider text-gray-500 uppercase px-2 py-0.5 rounded border border-gray-200 bg-gray-50">
                Placement Portal
              </span>
            </div>
            <div className="w-12 h-1 bg-[#FECC00] rounded mb-3" />
            <h2 className="text-2xl font-bold text-gray-900 tracking-tight mb-1">
              Institutional Sign-In
            </h2>
            <p className="text-xs sm:text-sm text-gray-600">
              Sign in with your DKTE credentials to access your portal.
            </p>
          </div>

          {/* Error Alert Banner */}
          {errorMessage && (
            <div
              role="alert"
              className="mb-6 p-3 rounded border border-red-200 bg-red-50 text-red-800 text-xs sm:text-sm flex items-start space-x-2.5 animate-fadeIn"
            >
              <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="leading-snug">{errorMessage}</div>
            </div>
          )}

          {/* Clean Unified Sign-In Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* PRN or Email Input */}
            <div>
              <label
                htmlFor="identifier"
                className="block text-xs font-semibold uppercase tracking-wider text-gray-700 mb-1.5"
              >
                Email or PRN <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <User className="w-4 h-4" />
                </div>
                <input
                  id="identifier"
                  name="identifier"
                  type="text"
                  required
                  autoComplete="username"
                  autoCapitalize="off"
                  autoCorrect="off"
                  spellCheck="false"
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="e.g. 2023CSE001 or tpo@dkte.ac.in"
                  className="w-full pl-9 pr-3.5 py-2.5 text-sm bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FECC00] focus:border-gray-900 transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-xs font-semibold uppercase tracking-wider text-gray-700"
                >
                  Password <span className="text-red-500">*</span>
                </label>
                <span className="text-[11px] text-gray-500 font-medium">
                  Students: Default password is your PRN
                </span>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-gray-400">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage('');
                  }}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-10 py-2.5 text-sm bg-white border border-gray-300 rounded text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-[#FECC00] focus:border-gray-900 transition-colors"
                />
                <button
                  type="button"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Primary Action Button: DKTE Gold (#FECC00) */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-2.5 px-4 bg-[#FECC00] text-[#111827] font-semibold text-sm rounded hover:bg-[#E5B800] active:bg-[#cca300] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FECC00] disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center space-x-2 transition-colors shadow-none"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin text-[#111827]" />
                    <span>Signing in...</span>
                  </>
                ) : (
                  <span>Sign In</span>
                )}
              </button>
            </div>
          </form>

          {/* Minimal Quick-Fill Testing Shortcuts */}
          <div className="mt-8 pt-5 border-t border-gray-100">
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-semibold tracking-wider text-gray-400 uppercase flex items-center space-x-1">
                <Sparkles className="w-3 h-3 text-[#FECC00]" />
                <span>Demo Accounts</span>
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={fillStudentDemo}
                className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-gray-800">Student</div>
                <div className="text-[10px] text-gray-500 font-mono">2023CSE001</div>
              </button>

              <button
                type="button"
                onClick={fillTpoDemo}
                className="px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded text-left transition-colors"
              >
                <div className="text-xs font-semibold text-gray-800">TPO Admin</div>
                <div className="text-[10px] text-gray-500 font-mono">tpo@dkte.ac.in</div>
              </button>
            </div>
          </div>

          {/* Subdued Security Disclaimer */}
          <div className="mt-6 text-center text-[11px] text-gray-400">
            Official institutional access. Authorized personnel and students only.
          </div>
        </div>
      </div>
    </div>
  );
}
