import React, { useEffect, useState } from 'react';
import api from '../api/client';
import { formatDate, formatTime } from '../utils/formatters';
import { ShieldAlert, RefreshCw, User, Terminal } from 'lucide-react';

const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await api.get('/audit-logs');
      const list = Array.isArray(res.data) ? res.data : res.data?.logs || [];
      const normalized = list.map((l: any) => ({
        ...l,
        entity: l.entityType,
        user: {
          fullName: l.user?.name || l.userEmail || 'System Admin',
          role: l.user?.role || 'USER',
          email: l.user?.email || l.userEmail,
        },
      }));
      setLogs(normalized);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 tracking-tight">System Security & Audit Trail</h2>
          <p className="text-xs text-slate-500 font-medium mt-1">
            Immutable log of all user logins, financial transactions, and void actions
          </p>
        </div>
        <button
          onClick={fetchLogs}
          className="flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Refresh</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex flex-col items-center justify-center space-y-2">
            <RefreshCw className="w-8 h-8 animate-spin text-brand-600" />
            <span>Loading security audit logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="py-16 text-center text-slate-400 font-medium">No audit logs recorded yet.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Done By (User)</th>
                  <th className="py-3 px-4">Action Performed</th>
                  <th className="py-3 px-4">Module / Entity</th>
                  <th className="py-3 px-4">Details / Summary</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {logs.map((log) => {
                  let formattedDetails = '';
                  if (log.details) {
                    try {
                      const parsed = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
                      formattedDetails = Object.entries(parsed)
                        .filter(([k]) => k !== 'userAgent')
                        .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`)
                        .join(' | ');
                    } catch {
                      formattedDetails = String(log.details);
                    }
                  }

                  return (
                    <tr key={log.id} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4 text-slate-600 font-mono whitespace-nowrap">
                        {formatDate(log.createdAt)} {formatTime(log.createdAt)}
                      </td>
                      <td className="py-3 px-4 font-semibold text-slate-800">
                        <div className="flex flex-col">
                          <span className="text-slate-900 font-bold">{log.user?.fullName}</span>
                          <span className="text-[10px] text-slate-400 font-mono">{log.user?.email} ({log.user?.role})</span>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            log.action.includes('VOID') || log.action.includes('FAILED') || log.action.includes('DELETED')
                              ? 'bg-rose-100 text-rose-800 border border-rose-200'
                              : log.action.includes('CREATED') || log.action.includes('PAID')
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-bold text-slate-700">{log.entity}</td>
                      <td className="py-3 px-4 text-slate-600 font-mono text-[11px] max-w-sm truncate" title={formattedDetails || log.entityId}>
                        {formattedDetails || log.entityId}
                      </td>
                      <td className="py-3 px-4 text-slate-400 font-mono">{log.ipAddress || '127.0.0.1'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AuditLogs;
