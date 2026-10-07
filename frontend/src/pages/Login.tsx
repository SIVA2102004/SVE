import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import api from '../api/client';
import { Lock, User, Eye, EyeOff, ShieldCheck, AlertCircle } from 'lucide-react';

const Login: React.FC = () => {
  const [username, setUsername] = useState('owner');
  const [password, setPassword] = useState('ShopFlow@123');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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
      setError(err.response?.data?.error || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setDemoCredentials = (role: 'owner' | 'manager' | 'staff') => {
    setUsername(role);
    setPassword('ShopFlow@123');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-navy-950 via-slate-900 to-navy-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl overflow-hidden border border-slate-100">
        {/* Header Banner */}
        <div className="bg-gradient-to-r from-navy-900 via-brand-900 to-brand-800 p-8 text-center text-white relative">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-brand-500 to-emerald-400 mx-auto flex items-center justify-center shadow-lg mb-4 text-3xl font-black">
            ₹
          </div>
          <h1 className="text-2xl font-black tracking-tight">ShopFlow</h1>
          <p className="text-xs text-brand-200 mt-1 uppercase tracking-wider font-semibold">
            Real-Time Shop Finance & Money Management
          </p>
        </div>

        {/* Form Container */}
        <div className="p-8">
          <div className="mb-6 text-center">
            <h2 className="text-lg font-bold text-slate-800">Secure Sign In</h2>
            <p className="text-xs text-slate-500 mt-0.5">Enter credentials to access your shop accounts</p>
          </div>

          {error && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-xs text-rose-700">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

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
                  placeholder="owner / manager / staff"
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
                  placeholder="••••••••••••"
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
              className="w-full mt-2 py-3 px-4 rounded-xl bg-brand-600 hover:bg-brand-700 text-white font-bold shadow-lg shadow-brand-500/25 transition-all transform active:scale-95 disabled:opacity-50 text-sm"
            >
              {loading ? 'Authenticating...' : 'Sign In to Dashboard'}
            </button>
          </form>

          {/* Quick Demo Autofill Buttons */}
          <div className="mt-8 pt-6 border-t border-slate-100">
            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 text-center mb-3">
              One-Click Demo Roles
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setDemoCredentials('owner')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                Owner
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('manager')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 hover:border-brand-300 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                Manager
              </button>
              <button
                type="button"
                onClick={() => setDemoCredentials('staff')}
                className="py-1.5 px-2 bg-slate-100 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-300 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 transition-colors"
              >
                Staff
              </button>
            </div>
            <p className="text-[11px] text-slate-400 text-center mt-3 flex items-center justify-center space-x-1">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Default password: <strong className="text-slate-600">ShopFlow@123</strong></span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
