import { Router } from 'express';
import { exec, one } from '../database';
import { authenticate, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

function isValidLatLng(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) &&
    latitude >= -90 && latitude <= 90 && longitude >= -180 && longitude <= 180;
}

router.get('/office', authenticate, async (req: AuthRequest, res) => {
  let settings = await one('SELECT * FROM office_settings WHERE organization_id = $1 LIMIT 1', [req.user!.organization_id]);
  if (!settings && req.user!.role === 'admin') {
    settings = await one(
      `INSERT INTO office_settings (organization_id, office_name, latitude, longitude, radius_meters, late_threshold_minutes, default_shift_start_time, shift_checkout_time)
       VALUES ($1, 'Main Office', 0, 0, 100, 15, '09:00', '23:59')
       RETURNING *`,
      [req.user!.organization_id]
    );
  }
  res.json(settings || {});
});

router.put('/office', authenticate, requireAdmin, async (req: AuthRequest, res) => {
  const latitude = Number(req.body.latitude);
  const longitude = Number(req.body.longitude);
  const radius = Number(req.body.radius_meters);
  const lateThreshold = Number(req.body.late_threshold_minutes);
  const defaultShift = String(req.body.default_shift_start_time || '09:00');
  const shiftCheckout = String(req.body.shift_checkout_time || '23:59').slice(0, 5);
  const officeName = String(req.body.office_name || 'Main Office').trim();
  const officeNetworkName = String(req.body.office_network_name_label || '').trim();
  const allowedIpRanges = String(req.body.allowed_ip_ranges || '').trim();
  const enableAutoCheckin = !!req.body.enable_auto_checkin;
  const enableAutoCheckout = !!req.body.enable_auto_checkout;
  const autoCheckoutGrace = Number(req.body.auto_checkout_grace_minutes ?? 5);

  if (!isValidLatLng(latitude, longitude)) return res.status(400).json({ message: 'Latitude and longitude must be valid coordinates' });
  if (!Number.isFinite(radius) || radius < 10 || radius > 5000) return res.status(400).json({ message: 'Radius must be between 10 and 5000 meters' });
  if (!Number.isFinite(lateThreshold) || lateThreshold < 0 || lateThreshold > 240) return res.status(400).json({ message: 'Late threshold must be between 0 and 240 minutes' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(defaultShift)) return res.status(400).json({ message: 'Default shift start time must use HH:MM format' });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(shiftCheckout)) return res.status(400).json({ message: 'Auto checkout time must use HH:MM format' });
  if (!Number.isFinite(autoCheckoutGrace) || autoCheckoutGrace < 0 || autoCheckoutGrace > 120) return res.status(400).json({ message: 'Auto checkout grace must be between 0 and 120 minutes' });

  const updated = await one(
    `INSERT INTO office_settings (
      organization_id, office_name, latitude, longitude, radius_meters, late_threshold_minutes,
      default_shift_start_time, shift_checkout_time, office_network_name_label, allowed_ip_ranges,
      auto_checkout_enabled, enable_auto_checkin, enable_auto_checkout, auto_checkout_grace_minutes
    )
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    ON CONFLICT (organization_id) DO UPDATE SET
      office_name = EXCLUDED.office_name,
      latitude = EXCLUDED.latitude,
      longitude = EXCLUDED.longitude,
      radius_meters = EXCLUDED.radius_meters,
      late_threshold_minutes = EXCLUDED.late_threshold_minutes,
      default_shift_start_time = EXCLUDED.default_shift_start_time,
      shift_checkout_time = EXCLUDED.shift_checkout_time,
      office_network_name_label = EXCLUDED.office_network_name_label,
      allowed_ip_ranges = EXCLUDED.allowed_ip_ranges,
      auto_checkout_enabled = EXCLUDED.auto_checkout_enabled,
      enable_auto_checkin = EXCLUDED.enable_auto_checkin,
      enable_auto_checkout = EXCLUDED.enable_auto_checkout,
      auto_checkout_grace_minutes = EXCLUDED.auto_checkout_grace_minutes,
      updated_at = NOW()
    RETURNING *`,
    [
      req.user!.organization_id,
      officeName,
      latitude,
      longitude,
      radius,
      lateThreshold,
      defaultShift,
      shiftCheckout,
      officeNetworkName,
      allowedIpRanges,
      enableAutoCheckout,
      enableAutoCheckin,
      enableAutoCheckout,
      autoCheckoutGrace
    ]
  );

  await exec(
    `UPDATE users SET shift_start_time = COALESCE(shift_start_time, $1), updated_at = NOW()
     WHERE organization_id = $2 AND role = 'employee'`,
    [defaultShift, req.user!.organization_id]
  );

  res.json(updated);
});

export default router;
