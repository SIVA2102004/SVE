import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { Settings as SettingsIcon, Save, Building, ShieldCheck, KeyRound, Copy, Check } from 'lucide-react';

const Settings: React.FC = () => {
  const [shopName, setShopName] = useState('SVE Store');
  const [tagline, setTagline] = useState('Automotive Spare Parts & Retail Finance');
  const [phone, setPhone] = useState('9876543210');
  const [email, setEmail] = useState('contact@sve.in');
  const [address, setAddress] = useState('Shop #1, Main Market');
  const [gstin, setGstin] = useState('29ABCDE1234F1Z5');
  const [accessCode, setAccessCode] = useState('SVE-2026');
  const [upiId, setUpiId] = useState('');
  const [currency, setCurrency] = useState('INR (₹)');
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);

  // Registered Users management
  const [users, setUsers] = useState<any[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setUsersLoading(true);
      const res = await api.get('/users');
      setUsers(res.data?.users || []);
    } catch (err) {
      console.error('Failed to load users', err);
    } finally {
      setUsersLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!window.confirm(`Are you sure you want to delete user account "${userName}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.delete(`/users/${userId}`);
      setUsers(users.filter((u) => u.id !== userId));
      alert(`User "${userName}" has been deleted.`);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to delete user');
    }
  };


  const fetchSettings = async () => {
    try {
      const res = await api.get('/settings');
      if (res.data?.settings) {
        const s = res.data.settings;
        setShopName(s.shopName || 'SVE Store');
        setTagline(s.tagline || '');
        setPhone(s.phone || '');
        setEmail(s.email || '');
        setAddress(s.address || '');
        setGstin(s.gstNumber || '');
        setAccessCode(s.accessCode || 'SVE-2026');
        setUpiId(s.upiId || '');
      }
    } catch (err) {
      console.error('Failed to load settings', err);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.put('/settings', {
        shopName,
        tagline,
        phone,
        email,
        address,
        gstNumber: gstin,
        upiId: upiId.trim(),
        accessCode: accessCode.trim().toUpperCase(),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(accessCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">SVE Company Settings & Profile</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Configure business identity, GST credentials, and staff Company Access Code
          </p>
        </div>
      </div>

      {/* Access Code Highlight Card */}
      <div className="bg-gradient-to-r from-brand-900 via-navy-900 to-slate-900 text-white p-6 rounded-3xl shadow-lg border border-brand-800/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-1">
            <KeyRound className="w-4 h-4" />
            <span>Company Access Code for Staff & Managers</span>
          </div>
          <p className="text-xs text-slate-300 max-w-md">
            Share this code with your managers and counter staff so they can register and join this company dashboard securely.
          </p>
        </div>
        <div className="flex items-center space-x-3 bg-white/10 px-4 py-3 rounded-2xl border border-white/15">
          <span className="font-mono text-xl font-black tracking-widest text-emerald-300">
            {accessCode || 'SVE-2026'}
          </span>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-colors text-white"
            title="Copy Access Code"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Business / Company Name
              </label>
              <input
                type="text"
                required
                value={shopName}
                onChange={(e) => setShopName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Company Access Code (Changeable by Owner)
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 absolute left-3.5 top-3 text-slate-400" />
                <input
                  type="text"
                  required
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono font-bold tracking-wider uppercase focus:ring-2 focus:ring-brand-500 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Official Contact Phone
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                Official Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Tagline / Subtitle
            </label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
              Shop Physical Address
            </label>
            <input
              type="text"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm focus:ring-2 focus:ring-brand-500 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1.5">
                GSTIN Number
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-brand-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-emerald-700 mb-1.5">
                Shop UPI ID / VPA (For Dynamic QR Codes)
              </label>
              <input
                type="text"
                placeholder="e.g. sveparts@upi or 9876543210@paytm"
                value={upiId}
                onChange={(e) => setUpiId(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-emerald-300 bg-emerald-50/40 text-sm font-semibold text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
              <p className="text-[11px] text-slate-400 mt-1">Used to automatically generate instant payment QR codes sent via WhatsApp</p>
            </div>
          </div>

          {saved && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-700 flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>SVE Configuration saved successfully!</span>
            </div>
          )}

          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              <span>{loading ? 'Saving...' : 'Save Configuration'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Registered Users & Team Management Card */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-2">
          <div>
            <h3 className="text-lg font-bold text-slate-800">Registered Accounts & Team Access</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Review and delete registered staff, managers, or company accounts
            </p>
          </div>
          <button
            type="button"
            onClick={fetchUsers}
            className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold w-fit"
          >
            Refresh List
          </button>
        </div>

        <div className="mt-4 overflow-x-auto">
          {usersLoading ? (
            <p className="text-xs text-slate-400 py-4 text-center">Loading accounts...</p>
          ) : users.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No other accounts registered yet.</p>
          ) : (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Username</th>
                  <th className="py-2.5 px-3">Email</th>
                  <th className="py-2.5 px-3">Role</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-slate-50/50">
                    <td className="py-2.5 px-3 font-semibold text-slate-800">{u.name}</td>
                    <td className="py-2.5 px-3 font-mono text-slate-600">{u.username}</td>
                    <td className="py-2.5 px-3 text-slate-500">{u.email}</td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                          u.role === 'OWNER'
                            ? 'bg-amber-100 text-amber-800'
                            : u.role === 'MANAGER'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {u.role}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteUser(u.id, u.name)}
                        className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold transition-colors"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
