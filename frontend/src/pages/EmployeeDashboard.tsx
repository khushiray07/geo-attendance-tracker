import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import DashboardLayout from '../components/DashboardLayout';
import WorkingHoursCard from '../components/WorkingHoursCard';
import { Calendar, Clock, Briefcase, AlertTriangle, Fingerprint, MapPin } from 'lucide-react';
import { MapContainer, TileLayer, Circle, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';

const LOCATION_HEARTBEAT_MS = 60000;

// Fix leaflet default icon
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function EmployeeDashboard() {
  const { user } = useAuth();
  const [todayRecord, setTodayRecord] = useState<any>(null);
  const [historyRecords, setHistoryRecords] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>({});
  const [officeSettings, setOfficeSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [currentPos, setCurrentPos] = useState<[number, number] | null>(null);
  const [autoStatus, setAutoStatus] = useState<any>(null);
  const [onsiteStatus, setOnsiteStatus] = useState<any>(null);
  const [outsideSince, setOutsideSince] = useState<number | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    fetchData();
    getCurrentLocation(true);
  }, []);

  useEffect(() => {
    if (!officeSettings?.enable_auto_checkout || !todayRecord?.check_in_time || todayRecord?.check_out_time) return;
    const timer = window.setInterval(() => getCurrentLocation(true), 60000);
    return () => window.clearInterval(timer);
  }, [officeSettings, todayRecord]);

  useEffect(() => {
    if (!todayRecord?.check_in_time || todayRecord?.check_out_time) return;
    sendLocationHeartbeat();
    const timer = window.setInterval(sendLocationHeartbeat, LOCATION_HEARTBEAT_MS);
    return () => window.clearInterval(timer);
  }, [todayRecord?.check_in_time, todayRecord?.check_out_time]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const fetchData = async () => {
    try {
      const todayRes = await api.get('/attendance/today');
      setTodayRecord(todayRes.data);
      
      const month = new Date().toISOString().substring(0, 7);
      const historyRes = await api.get(`/attendance/history?month=${month}`);
      setHistoryRecords(historyRes.data.slice(0, 3)); // Just latest 3
      const summaryRes = await api.get(`/attendance/summary?month=${month}`);
      setSummary(summaryRes.data);

      const officeRes = await api.get('/settings/office');
      setOfficeSettings(officeRes.data);
      const onsiteRes = await api.get('/attendance/onsite-status');
      setOnsiteStatus(onsiteRes.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const sendLocationHeartbeat = () => {
    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Location access is required to verify onsite status during checked-in session.' });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
        try {
          const { data } = await api.post('/attendance/location-heartbeat', { lat: pos.coords.latitude, lng: pos.coords.longitude });
          setOnsiteStatus(data);
        } catch (err: any) {
          console.error(err);
        }
      },
      async () => {
        setMessage({ type: 'error', text: 'Location access is required to verify onsite status during checked-in session.' });
        try {
          await api.post('/attendance/location-heartbeat', { permission_denied: true });
        } catch (err) {
          console.error(err);
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  const getCurrentLocation = (checkAuto = false) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCurrentPos([pos.coords.latitude, pos.coords.longitude]);
        if (checkAuto) fetchAutoStatus(pos.coords.latitude, pos.coords.longitude);
      });
    }
  };

  const fetchAutoStatus = async (lat: number, lng: number) => {
    try {
      const { data } = await api.get(`/attendance/auto-status?lat=${lat}&lng=${lng}`, { data: { lat, lng } });
      setAutoStatus(data);
      if (data.enable_auto_checkout && todayRecord?.check_in_time && !todayRecord?.check_out_time && !data.inside_geofence) {
        const firstOutside = outsideSince || Date.now();
        setOutsideSince(firstOutside);
        const graceMs = (data.auto_checkout_grace_minutes || 5) * 60 * 1000;
        if (Date.now() - firstOutside >= graceMs) {
          await api.post('/attendance/auto-check-out', { lat, lng });
          setMessage({ type: 'success', text: 'Auto checkout marked after leaving office radius' });
          fetchData();
        }
      } else {
        setOutsideSince(null);
      }
    } catch {
      setAutoStatus(null);
    }
  };

  const confirmAutoCheckIn = async () => {
    if (!currentPos) return;
    setPunching(true);
    try {
      const { data } = await api.post('/attendance/auto-check-in', { lat: currentPos[0], lng: currentPos[1] });
      setMessage({ type: 'success', text: punchSuccessMessage(data) });
      setTodayRecord(data.record);
      fetchData();
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.message || 'Auto check-in failed' });
    } finally {
      setPunching(false);
    }
  };

  const handlePunch = async (type: 'in' | 'out') => {
    setPunching(true);
    setMessage({ type: '', text: '' });

    if (!navigator.geolocation) {
      setMessage({ type: 'error', text: 'Geolocation is not supported by your browser' });
      setPunching(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const payload = { lat: position.coords.latitude, lng: position.coords.longitude };
          const endpoint = type === 'in' ? '/attendance/check-in' : '/attendance/check-out';
          const { data } = await api.post(endpoint, payload);
          const distanceText = data.distance !== undefined ? ` • ${data.distance}m from office` : '';
          const successText = type === 'in' ? punchSuccessMessage(data) : data.message;
          setMessage({ type: 'success', text: `${successText}${distanceText}` });
          setTodayRecord(data.record);
          fetchData(); // refresh history
        } catch (err: any) {
          setMessage({ 
            type: 'error', 
            text: `${err.response?.data?.message || 'Error communicating with server'}${err.response?.data?.distance !== undefined ? ` • ${err.response.data.distance}m from office` : ''}`
          });
        } finally {
          setPunching(false);
        }
      },
      () => {
        setPunching(false);
        setMessage({ type: 'error', text: 'Location permission denied or unavailable.' });
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  if (loading) return <DashboardLayout title="Dashboard"><div className="p-8">Loading dashboard...</div></DashboardLayout>;

  const isCheckedIn = !!todayRecord?.check_in_time;
  const isCheckedOut = !!todayRecord?.check_out_time;

  const dateOptions: Intl.DateTimeFormatOptions = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  const todayStr = new Date().toLocaleDateString('en-US', dateOptions);
  const todayWorkingMinutes = currentWorkingMinutes(todayRecord, now);

  return (
    <DashboardLayout title="Dashboard">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">Good morning, {user?.name}</h1>
        <p className="text-gray-500">{user?.organization?.name} • Today is {todayStr}</p>
      </div>

      {message.text && (
        <div className={`p-4 mb-6 rounded-xl font-medium border ${message.type === 'error' ? 'bg-danger-bg text-danger-text border-red-200' : 'bg-success-bg text-success-text border-green-200'}`}>
          {message.text}
        </div>
      )}

      <div className="mb-8 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,0.95fr)_minmax(320px,1.05fr)] xl:grid-cols-1">
          {/* Today's Status Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-6">
            <div>
              <div className="mb-6 flex flex-wrap items-center gap-3">
                <h2 className="text-xl font-bold text-gray-900">Today's Status</h2>
                <span className={`text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider ${todayRecord?.is_late ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'}`}>
                  {todayRecord?.is_late ? 'LATE' : 'ON-TIME'}
                </span>
                <span className="text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wider bg-brand-light text-brand">
                  {String(todayRecord?.attendance_type || 'on_site').replaceAll('_', ' ')}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 sm:mb-8">
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Check-in</div>
                  <div className="text-2xl font-bold text-brand">{todayRecord?.check_in_time ? todayRecord.check_in_time.substring(0, 5) : '--:--'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Check-out</div>
                  <div className="text-2xl font-bold text-gray-900">{todayRecord?.check_out_time ? todayRecord.check_out_time.substring(0, 5) : '--:--'}</div>
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-500 mb-1">Working Hours</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {todayRecord?.working_minutes ? `${Math.floor(todayRecord.working_minutes / 60)}h ${todayRecord.working_minutes % 60}m` : '--'}
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-2">
              {autoStatus?.eligible && !isCheckedIn && (
                <div className="mb-4 rounded-xl border border-blue-100 bg-blue-50 p-4">
                  <div className="flex items-start gap-3 text-blue-800">
                    <MapPin size={20} className="mt-0.5" />
                    <div>
                      <div className="font-black">Auto check-in available</div>
                      <p className="text-sm">You are inside the office radius{autoStatus.office_network_name_label ? ` near ${autoStatus.office_network_name_label}` : ''}. Confirm to mark on-site attendance.</p>
                      <button onClick={confirmAutoCheckIn} disabled={punching} className="mt-3 rounded-lg bg-brand px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">Confirm Auto Check-in</button>
                    </div>
                  </div>
                </div>
              )}
              {outsideSince && (
                <div className="mb-4 rounded-xl border border-amber-200 bg-warning-bg p-4 font-bold text-warning-text">
                  You appear to be outside the office radius. Auto checkout will be marked if this continues while the app is open.
                </div>
              )}
              {!isCheckedIn ? (
                <button 
                  onClick={() => handlePunch('in')}
                  disabled={punching}
                  className="w-full sm:w-auto min-h-12 justify-center bg-brand text-white px-8 py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <Fingerprint size={24} /> {punching ? 'Locating...' : 'Punch In'}
                </button>
              ) : !isCheckedOut ? (
                <button 
                  onClick={() => handlePunch('out')}
                  disabled={punching}
                  className="w-full sm:w-auto min-h-12 justify-center bg-brand text-white px-8 py-4 rounded-xl font-bold text-base sm:text-lg hover:bg-blue-700 transition shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center gap-2"
                >
                  <Fingerprint size={24} /> {punching ? 'Locating...' : 'Punch Out'}
                </button>
              ) : (
                <button disabled className="w-full sm:w-auto min-h-12 bg-gray-100 text-gray-400 px-8 py-4 rounded-xl font-bold text-base sm:text-lg cursor-not-allowed">
                  Shift Completed
                </button>
              )}
            </div>
          </div>

          {/* Map Card */}
          <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm sm:p-4">
            <div className="mb-3 flex items-center justify-between gap-3 px-1">
              <div>
                <h2 className="text-lg font-black text-gray-950">Office Geofence</h2>
                <p className="mt-1 text-sm font-medium text-gray-500">Live position against the approved attendance radius.</p>
              </div>
              <span className="hidden rounded-full bg-brand-light px-3 py-1 text-xs font-black text-brand sm:inline-flex">
                {officeSettings?.radius_meters || '--'}m radius
              </span>
            </div>
            <div className="relative h-[240px] overflow-hidden rounded-xl border border-gray-100 bg-gray-50 sm:h-[300px] lg:h-[360px] xl:h-[330px]">
              {officeSettings && (
                <MapContainer
                  center={[officeSettings.latitude, officeSettings.longitude]}
                  zoom={16}
                  scrollWheelZoom={false}
                  zoomControl={false}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                  />
                  <Circle
                    center={[officeSettings.latitude, officeSettings.longitude]}
                    radius={officeSettings.radius_meters}
                    pathOptions={{ color: '#0A58CA', fillColor: '#0A58CA', fillOpacity: 0.1, weight: 1 }}
                  />
                  {currentPos && (
                    <Marker position={currentPos}>
                      <Popup>Your current location</Popup>
                    </Marker>
                  )}
                </MapContainer>
              )}
            </div>
          </div>
        </div>

        <div className="min-w-0 space-y-4">
          <WorkingHoursCard
            minutes={todayWorkingMinutes}
            checkInTime={todayRecord?.check_in_time}
            checkOutTime={todayRecord?.check_out_time}
            attendanceType={todayRecord?.attendance_type}
          />
          <div className={`rounded-2xl border p-5 shadow-sm ${onsiteStatus?.activeBreach ? 'border-amber-200 bg-warning-bg' : 'border-green-100 bg-success-bg'}`}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className={`text-base font-black ${onsiteStatus?.activeBreach ? 'text-warning-text' : 'text-success-text'}`}>
                {onsiteStatus?.activeBreach ? 'Not Onsite' : 'Inside Office Geofence'}
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-black ${onsiteStatus?.activeBreach ? 'bg-white text-warning-text' : 'bg-white text-success-text'}`}>
                {onsiteStatus?.activeBreach ? 'Outside' : 'Inside'}
              </span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="font-semibold text-gray-700">Distance: {onsiteStatus?.distanceFromOffice !== null && onsiteStatus?.distanceFromOffice !== undefined ? `${onsiteStatus.distanceFromOffice}m from office` : '--'}</div>
              {onsiteStatus?.activeBreach ? (
                <p className="text-warning-text">You moved outside office geofence at {new Date(onsiteStatus.activeBreach.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}. This interval will be marked as Not Onsite until you return.</p>
              ) : onsiteStatus?.breachIntervals?.length ? (
                <p className="text-gray-600">Last Not Onsite interval: {formatInterval(onsiteStatus.breachIntervals[onsiteStatus.breachIntervals.length - 1])}</p>
              ) : (
                <p className="text-gray-600">Foreground location monitoring runs every 60 seconds while checked in.</p>
              )}
              <div className="font-black text-gray-900">Today total not-onsite time: {onsiteStatus?.todayBreachMinutes || 0} minutes</div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Metrics */}
      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-brand-light text-brand flex items-center justify-center">
              <Calendar size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Present Days</div>
              <div className="text-2xl font-bold text-gray-900">{summary.present_days || 0}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-warning-bg text-warning-text flex items-center justify-center">
              <Clock size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Late Days</div>
              <div className="text-2xl font-bold text-gray-900">{summary.late_days || 0}</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-success-bg text-success-text flex items-center justify-center">
              <Briefcase size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">Total Hours</div>
              <div className="text-2xl font-bold text-gray-900">{Math.round((summary.working_minutes || 0) / 60)}h</div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-danger-bg text-danger-text flex items-center justify-center">
              <AlertTriangle size={24} />
            </div>
            <div>
              <div className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-0.5">WFH Days</div>
              <div className="text-2xl font-bold text-gray-900">{summary.wfh_days || 0}</div>
            </div>
          </div>
      </div>

      {/* Recent History Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center bg-white">
          <h3 className="text-lg font-bold text-gray-900">Recent History</h3>
          <a href="/history" className="text-sm font-bold text-brand hover:text-blue-800">View All</a>
        </div>
        <div className="divide-y divide-gray-50">
          {historyRecords.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No recent history</div>
          ) : (
            historyRecords.map(record => {
              const dateObj = new Date(record.date);
              return (
                <div key={record.id} className="p-4 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-gray-50 transition-colors">
                  <div className="flex items-center gap-4 mb-4 sm:mb-0">
                    <div className="w-10 h-10 rounded-lg bg-[#F4F7FE] flex items-center justify-center text-gray-500">
                      <Calendar size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-gray-900">{dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</div>
                      <div className="text-sm text-gray-500 mt-0.5">{record.check_in_time ? 'Office HQ • Central Park' : 'No Location Data'}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between sm:w-1/2">
                    <div className="text-right sm:text-left">
                      <div className="font-medium text-gray-900">
                        {record.check_in_time ? record.check_in_time.substring(0,5) : '--:--'} AM - {record.check_out_time ? record.check_out_time.substring(0,5) : '--:--'} PM
                      </div>
                      <div className="text-sm text-gray-500 mt-0.5">
                        {record.working_minutes ? `${Math.floor(record.working_minutes / 60)}h ${record.working_minutes % 60}m Total` : '--'}
                      </div>
                    </div>
                    <div>
                      <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${record.is_late ? 'bg-warning-bg text-warning-text' : 'bg-success-bg text-success-text'}`}>
                        {record.is_late ? 'LATE' : 'ON-TIME'}
                      </span>
                    </div>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

function punchSuccessMessage(data: any) {
  if (!data?.record?.is_late) return data?.message || 'Checked in successfully';

  if (data.emailAlert?.sent) {
    return 'Checked in successfully • Marked Late • Email alert sent';
  }
  if (data.emailAlert?.skipped) {
    return 'Checked in successfully • Marked Late • Email alert skipped';
  }
  if (data.emailAlert?.attempted && !data.emailAlert?.sent) {
    return 'Checked in successfully • Marked Late • Email failed, attendance saved';
  }
  return 'Checked in successfully • Marked Late';
}

function formatInterval(interval: any) {
  const start = interval?.started_at ? new Date(interval.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--';
  const end = interval?.ended_at ? new Date(interval.ended_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now';
  const minutes = interval?.duration_minutes || 0;
  return `${start} - ${end} (${minutes}m)`;
}

function currentWorkingMinutes(record: any, now: Date) {
  if (!record?.check_in_time) return 0;
  if (Number(record.working_minutes) > 0 || record.check_out_time) {
    return Number(record.working_minutes || minutesBetweenTodayTimes(record.check_in_time, record.check_out_time));
  }

  return minutesBetweenTodayTimes(record.check_in_time, timeFromDate(now), now);
}

function minutesBetweenTodayTimes(startTime: string, endTime?: string | null, fallbackEnd = new Date()) {
  const start = dateFromTime(startTime, fallbackEnd);
  const end = endTime ? dateFromTime(endTime, fallbackEnd) : fallbackEnd;
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function dateFromTime(time: string, baseDate: Date) {
  const [hours = 0, minutes = 0, seconds = 0] = String(time).split(':').map(Number);
  const date = new Date(baseDate);
  date.setHours(hours, minutes, seconds, 0);
  return date;
}

function timeFromDate(date: Date) {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:00`;
}
