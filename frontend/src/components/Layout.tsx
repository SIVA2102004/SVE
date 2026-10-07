import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import {
  LayoutDashboard,
  ArrowLeftRight,
  Users,
  Building2,
  TrendingDown,
  UserCheck,
  CreditCard,
  FileText,
  Bell,
  BarChart3,
  ShieldAlert,
  Settings,
  LogOut,
  Menu,
  X,
  PlusCircle,
  Wifi,
  WifiOff,
} from 'lucide-react';
import QuickAddModal from './QuickAddModal';

const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const { isConnected } = useSocket();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const navigate = useNavigate();

  const navItems = [
    { name: 'Dashboard', path: '/', icon: LayoutDashboard, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    { name: 'Money Flow', path: '/money-flow', icon: ArrowLeftRight, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    { name: 'Customers (Get)', path: '/customers', icon: Users, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    { name: 'Dealers (Pay)', path: '/dealers', icon: Building2, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    { name: 'Expenses', path: '/expenses', icon: TrendingDown, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    { name: 'Staff & Salaries', path: '/staff', icon: UserCheck, roles: ['OWNER', 'MANAGER'] },
    { name: 'Loans & EMIs', path: '/loans', icon: CreditCard, roles: ['OWNER', 'MANAGER'] },
    { name: 'Receipts Vault', path: '/receipts', icon: FileText, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    { name: 'Reminders', path: '/reminders', icon: Bell, roles: ['OWNER', 'MANAGER', 'STAFF'] },
    { name: 'Reports & P&L', path: '/reports', icon: BarChart3, roles: ['OWNER', 'MANAGER'] },
    { name: 'Audit Logs', path: '/audit-logs', icon: ShieldAlert, roles: ['OWNER'] },
    { name: 'Settings', path: '/settings', icon: Settings, roles: ['OWNER'] },
  ];

  const allowedNavItems = navItems.filter(item => user && item.roles.includes(user.role));

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex flex-col w-64 bg-navy-950 text-white border-r border-navy-900 shadow-xl">
        <div className="p-5 border-b border-navy-800 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center font-bold text-white text-xl shadow-md">
              ₹
            </div>
            <div>
              <h1 className="font-bold text-lg text-white tracking-wider">SVE</h1>
              <p className="text-xs text-slate-400 font-medium">Business Finance</p>
            </div>
          </div>
          <div title={isConnected ? 'Real-Time Connected' : 'Connecting to Server...'}>
            {isConnected ? (
              <span className="flex h-2.5 w-2.5 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500 inline-block"></span>
            )}
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {allowedNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                end={item.path === '/'}
                className={({ isActive }) =>
                  `flex items-center px-3 py-2.5 rounded-xl font-medium text-sm transition-all duration-150 ${
                    isActive
                      ? 'bg-brand-600 text-white shadow-sm font-semibold'
                      : 'text-slate-300 hover:bg-navy-900 hover:text-white'
                  }`
                }
              >
                <Icon className="w-5 h-5 mr-3 shrink-0" />
                <span>{item.name}</span>
              </NavLink>
            );
          })}
        </nav>

        {/* Quick Add Button in Sidebar */}
        <div className="p-4 border-t border-navy-900">
          <button
            onClick={() => setQuickAddOpen(true)}
            className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-500 to-brand-600 hover:from-emerald-600 hover:to-brand-700 text-white font-semibold shadow-lg transition-all transform active:scale-95"
          >
            <PlusCircle className="w-5 h-5" />
            <span>Quick Action</span>
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 border-t border-navy-900 bg-navy-900/50 flex items-center justify-between">
          <div className="overflow-hidden mr-2">
            <p className="text-sm font-semibold text-white truncate">{user?.fullName}</p>
            <span className="inline-block px-2 py-0.5 mt-0.5 text-[10px] font-bold rounded uppercase tracking-wider bg-navy-800 text-emerald-400 border border-emerald-500/20">
              {user?.role}
            </span>
          </div>
          <button
            onClick={logout}
            title="Log Out"
            className="p-2 text-slate-400 hover:text-rose-400 hover:bg-navy-800 rounded-lg transition-colors"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-navy-950 text-white border-b border-navy-900 px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-brand-600 to-emerald-400 flex items-center justify-center font-bold text-white text-base">
              ₹
            </div>
            <span className="font-bold text-base tracking-wider text-white">SVE</span>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={() => setQuickAddOpen(true)}
              className="p-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-500"
              title="Quick Add"
            >
              <PlusCircle className="w-5 h-5" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-navy-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </header>

        {/* Mobile Slide-down Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden bg-navy-950 border-b border-navy-800 px-4 py-3 space-y-1 shadow-2xl z-50 animate-in slide-in-from-top duration-200">
            {allowedNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  end={item.path === '/'}
                  onClick={() => setMobileMenuOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center px-3 py-2 rounded-lg font-medium text-sm ${
                      isActive
                        ? 'bg-brand-600 text-white font-semibold'
                        : 'text-slate-300 hover:bg-navy-900'
                    }`
                  }
                >
                  <Icon className="w-5 h-5 mr-3" />
                  <span>{item.name}</span>
                </NavLink>
              );
            })}
            <div className="pt-3 border-t border-navy-800 flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-white">{user?.fullName}</p>
                <p className="text-xs text-slate-400">{user?.role}</p>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs text-rose-400 bg-rose-950/30 border border-rose-800/40 rounded-md font-semibold"
              >
                Log Out
              </button>
            </div>
          </div>
        )}

        {/* Dynamic Page Outlet */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8 bg-slate-50">
          <Outlet />
        </main>

        {/* Mobile Bottom Navigation Bar */}
        <div className="lg:hidden bg-white border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-lg">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center text-xs font-medium ${
                isActive ? 'text-brand-600 font-bold' : 'text-slate-500'
              }`
            }
          >
            <LayoutDashboard className="w-5 h-5 mb-0.5" />
            <span>Home</span>
          </NavLink>
          <NavLink
            to="/customers"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs font-medium ${
                isActive ? 'text-brand-600 font-bold' : 'text-slate-500'
              }`
            }
          >
            <Users className="w-5 h-5 mb-0.5" />
            <span>Receive</span>
          </NavLink>
          <button
            onClick={() => setQuickAddOpen(true)}
            className="flex flex-col items-center justify-center -mt-5 bg-brand-600 text-white rounded-full w-12 h-12 shadow-lg hover:bg-brand-700 transform active:scale-90 transition-transform"
          >
            <PlusCircle className="w-6 h-6" />
          </button>
          <NavLink
            to="/dealers"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs font-medium ${
                isActive ? 'text-brand-600 font-bold' : 'text-slate-500'
              }`
            }
          >
            <Building2 className="w-5 h-5 mb-0.5" />
            <span>Pay</span>
          </NavLink>
          <NavLink
            to="/money-flow"
            className={({ isActive }) =>
              `flex flex-col items-center text-xs font-medium ${
                isActive ? 'text-brand-600 font-bold' : 'text-slate-500'
              }`
            }
          >
            <ArrowLeftRight className="w-5 h-5 mb-0.5" />
            <span>Flow</span>
          </NavLink>
        </div>
      </div>

      {/* Floating Action Button on Desktop */}
      <button
        onClick={() => setQuickAddOpen(true)}
        className="hidden lg:flex fixed bottom-8 right-8 z-40 items-center space-x-2 bg-gradient-to-r from-emerald-500 to-brand-600 hover:from-emerald-600 hover:to-brand-700 text-white px-5 py-3 rounded-full shadow-2xl transition-all transform hover:scale-105 active:scale-95 border-2 border-white/20 font-semibold"
      >
        <PlusCircle className="w-5 h-5" />
        <span>Quick Add</span>
      </button>

      {/* Quick Add Modal */}
      {quickAddOpen && <QuickAddModal onClose={() => setQuickAddOpen(false)} />}
    </div>
  );
};

export default Layout;
