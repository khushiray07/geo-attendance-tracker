import React, { useEffect, useState } from 'react';
import api from '../../api/axios';
import DashboardLayout from '../../components/DashboardLayout';
import { Save, MapPin, Navigation } from 'lucide-react';

export default function OfficeSettings() {
  const [settings, setSettings] = useState({
    office_name: 'Main Office',
    latitude: 0,
    longitude: 0,
    radius_meters: 100,
    late_threshold_minutes: 15,
    default_shift_start_time: '09:00',
    office_network_name_label: '',
    allowed_ip_ranges: '',
    enable_auto_checkin: false,
    enable_auto_checkout: false,
    auto_checkout_grace_minutes: 5
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data } = await api.get('/settings/office');
      setSettings({ ...settings, ...data });
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage({ type: '', text: '' });

    try {
      await api.put('/settings/office', settings);
      setMessage({ type: 'success', text: 'Settings updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: (err as any).response?.data?.message || 'Failed to update settings' });
    } finally {
      setSaving(false);
    }
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setSettings({
          ...settings,
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude
        });
      });
    }
  };

  if (loading) return <DashboardLayout title="Settings"><div className="p-8">Loading...</div></DashboardLayout>;

  return (
    <DashboardLayout title="Settings">
      <div className="mb-6 sm:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 sm:text-3xl">Office Settings</h1>
        <p className="text-gray-500">Configure geofencing and attendance thresholds.</p>
      </div>

      {message.text && (
        <div className={`p-4 mb-6 rounded-xl font-medium border max-w-2xl ${message.type === 'error' ? 'bg-danger-bg text-danger-text border-red-200' : 'bg-success-bg text-success-text border-green-200'}`}>
          {message.text}
        </div>
      )}

      <div className="max-w-2xl rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-8">
        <form onSubmit={handleSave} className="space-y-6">
          <div className="border-b border-gray-100 pb-6 mb-6">
            <h2 className="text-xl font-bold text-gray-900 mb-1 flex items-center gap-2"><MapPin className="text-brand" size={20} /> Location Coordinates</h2>
            <p className="text-gray-500 text-sm mb-6">Set the center point for your office geofence. Employees must be within the specified radius to clock in.</p>
            
            <div className="mb-4">
              <label className="block text-sm font-bold text-gray-700 mb-2">Office Name</label>
              <input
                value={settings.office_name}
                onChange={(e) => setSettings({...settings, office_name: e.target.value})}
                className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Latitude</label>
                <input
                  type="number"
                  step="any"
                  value={settings.latitude}
                  onChange={(e) => setSettings({...settings, latitude: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Longitude</label>
                <input
                  type="number"
                  step="any"
                  value={settings.longitude}
                  onChange={(e) => setSettings({...settings, longitude: parseFloat(e.target.value)})}
                  className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                  required
                />
              </div>
            </div>
            
            <button
              type="button"
              onClick={getCurrentLocation}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-50 px-4 text-sm font-bold text-brand transition-colors hover:text-blue-800 sm:w-auto sm:bg-transparent sm:px-0"
            >
              <Navigation size={16} /> Use my current location
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Allowed Radius (Meters)</label>
              <p className="text-xs text-gray-500 mb-3">The maximum distance from the coordinates an employee can be to check in.</p>
              <input
                type="number"
                value={settings.radius_meters}
                onChange={(e) => setSettings({...settings, radius_meters: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Default Shift Start Time</label>
              <p className="text-xs text-gray-500 mb-3">Used for late arrival calculations and new employee defaults.</p>
              <input
                type="time"
                value={settings.default_shift_start_time}
                onChange={(e) => setSettings({...settings, default_shift_start_time: e.target.value})}
                className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Late Threshold (Minutes)</label>
              <p className="text-xs text-gray-500 mb-3">Minutes after shift start time before an employee is marked as late.</p>
              <input
                type="number"
                value={settings.late_threshold_minutes}
                onChange={(e) => setSettings({...settings, late_threshold_minutes: parseInt(e.target.value)})}
                className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                required
              />
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h2 className="text-xl font-bold text-gray-900 mb-1">Office Network & Auto Attendance</h2>
              <p className="text-gray-500 text-sm mb-6">Browsers cannot read WiFi SSID. These settings use backend request IP as optional support while geofence remains the primary check.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Network Label</label>
                  <input
                    value={settings.office_network_name_label}
                    onChange={(e) => setSettings({...settings, office_network_name_label: e.target.value})}
                    placeholder="Main Office WiFi"
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Allowed IP Ranges</label>
                  <input
                    value={settings.allowed_ip_ranges}
                    onChange={(e) => setSettings({...settings, allowed_ip_ranges: e.target.value})}
                    placeholder="192.168.1.0/24, 10.0.0.5"
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                  />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="flex items-center gap-3 rounded-xl bg-[#F4F7FE] p-4 font-bold text-gray-700">
                  <input type="checkbox" checked={settings.enable_auto_checkin} onChange={(e) => setSettings({...settings, enable_auto_checkin: e.target.checked})} className="h-5 w-5" />
                  Enable auto check-in
                </label>
                <label className="flex items-center gap-3 rounded-xl bg-[#F4F7FE] p-4 font-bold text-gray-700">
                  <input type="checkbox" checked={settings.enable_auto_checkout} onChange={(e) => setSettings({...settings, enable_auto_checkout: e.target.checked})} className="h-5 w-5" />
                  Enable auto checkout
                </label>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Checkout Grace Minutes</label>
                  <input
                    type="number"
                    value={settings.auto_checkout_grace_minutes}
                    onChange={(e) => setSettings({...settings, auto_checkout_grace_minutes: parseInt(e.target.value)})}
                    className="w-full px-4 py-3 bg-[#F4F7FE] border-transparent rounded-xl outline-none focus:ring-2 focus:ring-brand-light focus:bg-white focus:border-brand font-medium text-gray-900 transition"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand px-8 py-3.5 font-bold text-white shadow-lg shadow-blue-200 transition hover:bg-blue-700 disabled:opacity-50 sm:w-auto"
            >
              <Save size={20} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}
