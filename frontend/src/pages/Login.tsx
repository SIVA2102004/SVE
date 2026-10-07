import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import {
  Lock,
  User,
  Eye,
  EyeOff,
  ShieldCheck,
  AlertCircle,
  Building2,
  KeyRound,
  Mail,
  Phone,
  UserPlus,
  LogIn,
  CheckCircle2,
} from 'lucide-react';

const Login: React.FC = () => {
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');

  // Sign In States
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Register States
  const [regName, setRegName] = useState('');
  const [regUsername, setRegUsername] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regRole, setRegRole] = useState<'OWNER' | 'MANAGER' | 'STAFF'>('OWNER');
  const [regCompanyName, setRegCompanyName] = useState('SVE Store');
  const [regAccessCode, setRegAccessCode] = useState('SVE-2026');

  // Code verification status for staff/manager registration
  const [codeValidating, setCodeValidating] = useState(false);
  const [codeVerified, setCodeVerified] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { login } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { username, password });
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyAccessCode = async () => {
    if (!regAccessCode) {
      setError('Please enter the Company Access Code to verify');
      return;
    }
    setCodeValidating(true);
    setError('');
    try {
      const res = await api.post('/auth/validate-code', { accessCode: regAccessCode });
      if (res.data.valid) {
        setCodeVerified(true);
        setSuccessMsg(`Access Code Verified for ${res.data.shopName || 'Company'}!`);
      }
    } catch (err: any) {
      setCodeVerified(false);
      setError(err.response?.data?.message || 'Invalid Company Access Code. Please check with your Owner.');
    } finally {
      setCodeValidating(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const payload: any = {
        name: regName,
        username: regUsername,
        email: regEmail,
        password: regPassword,
        phone: regPhone,
        role: regRole,
        accessCode: regAccessCode,
      };

      if (regRole === 'OWNER') {
        payload.companyName = regCompanyName;
      }

      const res = await api.post('/auth/register', payload);
      login(res.data.token, res.data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-900 via-brand-900 to-brand-800 p-8 text-center text-white relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-emerald-400 mx-auto flex items-center justify-center shadow-lg mb-4 text-3xl font-black">
            ₹
          </div>
          <h1 className="text-3xl font-black tracking-wider">SVE</h1>
          <p className="text-xs text-brand-200 mt-1 uppercase tracking-wider font-semibold">
            Real-Time Shop Finance & Money Management
          </p>

          {/* Mode Switch Tabs */}
          <div className="mt-6 flex bg-navy-950/60 p-1 rounded-2xl border border-white/10 max-w-xs mx-auto">
            <button
              type="button"
              onClick={() => {
                setMode('LOGIN');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'LOGIN' ? 'bg-brand-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('REGISTER');
                setError('');
                setSuccessMsg('');
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all flex items-center justify-center space-x-1.5 ${
                mode === 'REGISTER' ? 'bg-emerald-600 text-white shadow-md' : 'text-slate-300 hover:text-white'
              }`}
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Register</span>
            </button>
          </div>
        </div>

        {/* Content Container */}
        <div className="p-8">
          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          {successMsg && (
            <div className="mb-4 p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5 text-xs text-emerald-700">
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {mode === 'LOGIN' ? (
            /* ================= SIGN IN FORM ================= */
            <div>
              <div className="mb-6 text-center">
                <h2 className="text-lg font-bold text-slate-800">Welcome Back</h2>
                <p className="text-xs text-slate-500 mt-0.5">Enter your credentials to access your SVE accounts</p>
              </div>

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Username or Email
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter username or email"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium text-slate-800"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password"
                      className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-500/25 transition-all transform active:scale-95 disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
                >
                  <LogIn className="w-4 h-4" />
                  <span>{loading ? 'Authenticating...' : 'Sign In to SVE Dashboard'}</span>
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  New Owner or Staff Member?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('REGISTER');
                      setError('');
                    }}
                    className="text-brand-600 font-bold hover:underline"
                  >
                    Register an Account
                  </button>
                </p>
              </div>
            </div>
          ) : (
            /* ================= REGISTRATION FORM ================= */
            <div>
              <div className="mb-6 text-center">
                <h2 className="text-lg font-bold text-slate-800">Register SVE Account</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {regRole === 'OWNER'
                    ? 'Register as Owner to manage company & set access code'
                    : 'Enter Company Access Code given by Owner to join'}
                </p>
              </div>

              <form onSubmit={handleRegister} className="space-y-4">
                {/* Role Selector */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Account Role
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setRegRole('OWNER')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        regRole === 'OWNER'
                          ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      👑 Owner
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('MANAGER')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        regRole === 'MANAGER'
                          ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      👔 Manager
                    </button>
                    <button
                      type="button"
                      onClick={() => setRegRole('STAFF')}
                      className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                        regRole === 'STAFF'
                          ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      👷 Staff
                    </button>
                  </div>
                </div>

                {/* Company Name (For Owner) */}
                {regRole === 'OWNER' && (
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Company / Business Name
                    </label>
                    <div className="relative">
                      <Building2 className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={regCompanyName}
                        onChange={(e) => setRegCompanyName(e.target.value)}
                        placeholder="e.g. SVE Store / SVE Motors"
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium text-slate-800"
                      />
                    </div>
                  </div>
                )}

                {/* Company Access Code Field */}
                <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {regRole === 'OWNER' ? 'Set Company Access Code' : 'Enter Company Access Code'}
                    </label>
                    {regRole !== 'OWNER' && (
                      <span className="text-[10px] text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-full">
                        Required
                      </span>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <div className="relative flex-1">
                      <KeyRound className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                      <input
                        type="text"
                        required
                        value={regAccessCode}
                        onChange={(e) => {
                          setRegAccessCode(e.target.value.toUpperCase());
                          setCodeVerified(false);
                        }}
                        placeholder="e.g. SVE-2026"
                        className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-mono font-bold tracking-wider uppercase text-slate-900"
                      />
                    </div>
                    {regRole !== 'OWNER' && (
                      <button
                        type="button"
                        onClick={handleVerifyAccessCode}
                        disabled={codeValidating}
                        className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all ${
                          codeVerified
                            ? 'bg-emerald-600 text-white'
                            : 'bg-slate-800 hover:bg-slate-900 text-white'
                        }`}
                      >
                        {codeValidating ? 'Checking...' : codeVerified ? 'Verified ✓' : 'Verify Code'}
                      </button>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1.5">
                    {regRole === 'OWNER'
                      ? 'Staff and managers must enter this code to join your company.'
                      : 'Ask your business owner for the Company Access Code to register.'}
                  </p>
                </div>

                {/* Full Name */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Your Full Name
                  </label>
                  <div className="relative">
                    <User className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type="text"
                      required
                      value={regName}
                      onChange={(e) => setRegName(e.target.value)}
                      placeholder="e.g. Rajesh Sharma"
                      className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium text-slate-800"
                    />
                  </div>
                </div>

                {/* Username */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Username
                  </label>
                  <input
                    type="text"
                    required
                    value={regUsername}
                    onChange={(e) => setRegUsername(e.target.value)}
                    placeholder="e.g. siva_owner"
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium text-slate-800"
                  />
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Email
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                      <input
                        type="email"
                        required
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        placeholder="you@sve.in"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs font-medium text-slate-800"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                      Mobile Phone
                    </label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute left-3 top-3.5 text-slate-400" />
                      <input
                        type="tel"
                        value={regPhone}
                        onChange={(e) => setRegPhone(e.target.value)}
                        placeholder="9876543210"
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-xs font-medium text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-5 h-5 absolute left-3.5 top-3 text-slate-400" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-11 pr-11 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-brand-500 text-sm font-medium text-slate-800"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600"
                    >
                      {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-lg shadow-emerald-500/25 transition-all transform active:scale-95 disabled:opacity-50 text-sm flex items-center justify-center space-x-2"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{loading ? 'Creating Account...' : `Register & Launch ${regRole}`}</span>
                </button>
              </form>

              <div className="mt-6 pt-4 border-t border-slate-100 text-center">
                <p className="text-xs text-slate-500">
                  Already registered?{' '}
                  <button
                    type="button"
                    onClick={() => {
                      setMode('LOGIN');
                      setError('');
                    }}
                    className="text-brand-600 font-bold hover:underline"
                  >
                    Sign In instead
                  </button>
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
