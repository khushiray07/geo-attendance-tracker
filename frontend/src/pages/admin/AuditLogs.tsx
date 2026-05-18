import { useEffect, useState } from 'react';
import api from '../../api/axios';
import DashboardLayout from '../../components/DashboardLayout';
import { AlertCircle, CheckCircle, RefreshCcw } from 'lucide-react';

export default function AuditLogs() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/audit-logs');
      setLogs(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout title="Logs">
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Audit Logs</h1>
          <p className="text-gray-500">Organization audit trail for accepted and rejected geofence attempts.</p>
        </div>
        <button 
          onClick={fetchLogs} 
          className="flex items-center gap-2 bg-white border border-gray-200 text-gray-700 px-4 py-2.5 rounded-xl font-bold hover:bg-gray-50 transition shadow-sm"
        >
          <RefreshCcw size={18} /> Refresh Logs
        </button>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[#F4F7FE] border-b border-gray-100">
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tl-2xl">Timestamp</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Employee</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Event</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider">Distance</th>
                <th className="px-6 py-4 text-xs font-bold text-gray-500 uppercase tracking-wider rounded-tr-2xl">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">Loading logs...</td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-10 text-center text-gray-500">No logs found.</td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="font-bold text-gray-900">{log.name}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 capitalize font-medium">
                      {log.event_type.replace('-', ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {log.accepted ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-bg text-success-text">
                          <CheckCircle size={14} /> Accepted
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger-bg text-danger-text">
                          <AlertCircle size={14} /> Rejected
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {log.distance_from_office ? `${Math.round(log.distance_from_office)}m` : '--'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                      {log.reason || '--'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="divide-y divide-gray-100 md:hidden">
          {loading ? (
            <div className="p-6 text-center text-gray-500">Loading logs...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-gray-500">No logs found.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-4">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <div className="font-black text-gray-900">{log.name}</div>
                    <div className="mt-1 text-xs font-bold uppercase tracking-wider text-gray-500">{log.event_type.replace('-', ' ')}</div>
                  </div>
                  {log.accepted ? (
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success-bg text-success-text">
                      <CheckCircle size={14} /> Accepted
                    </span>
                  ) : (
                    <span className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-danger-bg text-danger-text">
                      <AlertCircle size={14} /> Rejected
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-xs font-bold uppercase text-gray-400">Time</div>
                    <div className="font-medium text-gray-800">{new Date(log.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                  </div>
                  <div>
                    <div className="text-xs font-bold uppercase text-gray-400">Distance</div>
                    <div className="font-medium text-gray-800">{log.distance_from_office ? `${Math.round(log.distance_from_office)}m` : '--'}</div>
                  </div>
                </div>
                <div className="mt-3 rounded-lg bg-[#F4F7FE] p-3 text-sm text-gray-600">{log.reason || 'No reason recorded'}</div>
              </div>
            ))
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
