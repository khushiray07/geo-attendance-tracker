import { exec, query, transaction } from '../database';
import { closeOpenBreach } from './geofenceBreachService';

const AUTO_CHECKOUT_REASON = 'Employee forgot to punch out. System auto checked out at configured shift checkout time.';
const KOLKATA_TIME_ZONE = 'Asia/Kolkata';
let autoCheckoutColumnsEnsured = false;

function kolkataDateKey() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: KOLKATA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());
}

function kolkataTimeKey() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: KOLKATA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  }).format(new Date());
}

function parseConfiguredCheckoutTime(value?: string | null) {
  const time = String(value || '').slice(0, 5);
  return /^([01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : null;
}

async function ensureAutoCheckoutColumns() {
  if (autoCheckoutColumnsEnsured) return;
  await exec("ALTER TABLE office_settings ADD COLUMN IF NOT EXISTS shift_checkout_time TIME DEFAULT '23:59'");
  await exec("ALTER TABLE office_settings ADD COLUMN IF NOT EXISTS auto_checkout_enabled BOOLEAN DEFAULT FALSE");
  await exec("ALTER TABLE office_settings ADD COLUMN IF NOT EXISTS auto_checkout_grace_minutes INTEGER DEFAULT 0");
  await exec("ALTER TABLE office_settings ALTER COLUMN auto_checkout_grace_minutes SET DEFAULT 0");
  autoCheckoutColumnsEnsured = true;
}

export async function configuredCheckoutTime(organizationId: number) {
  await ensureAutoCheckoutColumns();
  const rows = await query(
    `SELECT shift_checkout_time::text AS shift_checkout_time
     FROM office_settings
     WHERE organization_id = $1
     LIMIT 1`,
    [organizationId]
  );
  return parseConfiguredCheckoutTime(rows[0]?.shift_checkout_time);
}

export async function autoCheckoutMissedPunches(organizationId?: number, actionBy?: number | null, checkoutTime?: string, checkoutDate = kolkataDateKey()) {
  const normalizedCheckoutTime = parseConfiguredCheckoutTime(checkoutTime || (organizationId ? await configuredCheckoutTime(organizationId) : '23:59'));
  if (!normalizedCheckoutTime) {
    console.log('Auto checkout skipped: shift checkout time not configured', {
      organizationId: organizationId || 'all',
      checkoutDate
    });
    return { closedCount: 0, checkoutTime: null, checkoutDate, records: [] };
  }
  return transaction(async (client) => {
    const params: any[] = [];
    let organizationClause = '';
    if (organizationId) {
      params.push(organizationId);
      organizationClause = ` AND organization_id = $${params.length}`;
    }

    const candidates = await client.query(
      `SELECT *
       FROM attendance
       WHERE check_in_time IS NOT NULL
         AND check_out_time IS NULL
         AND date = $${params.length + 1}
         AND attendance_type = 'on_site'
         AND COALESCE(status, 'present') NOT IN ('work_from_home', 'on_duty', 'leave')
         ${organizationClause}
       ORDER BY date ASC, user_id ASC`,
      [...params, checkoutDate]
    );
    console.log('Auto checkout open records found', {
      organizationId: organizationId || 'all',
      checkoutDate,
      configuredCheckoutTime: normalizedCheckoutTime,
      count: candidates.rowCount
    });

    const closed: any[] = [];
    for (const record of candidates.rows) {
      const updated = await client.query(
        `UPDATE attendance
         SET check_out_time = $1::time,
             working_minutes = GREATEST(0, FLOOR(EXTRACT(EPOCH FROM ($1::time - check_in_time)) / 60))::int,
             status = 'AUTO_CHECKOUT',
             updated_at = NOW()
         WHERE id = $2
           AND check_out_time IS NULL
           AND attendance_type = 'on_site'
         RETURNING *`,
        [normalizedCheckoutTime, record.id]
      );
      const closedRecord = updated.rows[0];
      if (!closedRecord) continue;

      await client.query(
        `INSERT INTO attendance_logs (organization_id, user_id, event_type, accepted, reason, action_by)
         VALUES ($1,$2,'AUTO_CHECKOUT',TRUE,$3,$4)`,
        [closedRecord.organization_id, closedRecord.user_id, AUTO_CHECKOUT_REASON, actionBy || null]
      );
      await closeOpenBreach(closedRecord.id, null, null, null, 'Open Not Onsite interval closed during configured shift checkout auto checkout');
      closed.push(closedRecord);
    }

    return { closedCount: closed.length, checkoutTime: normalizedCheckoutTime, checkoutDate, records: closed };
  });
}

export function scheduleDailyAutoCheckout() {
  const processedKeys = new Set<string>();
  console.log('Auto checkout scheduler started');

  const runSchedulerTick = async () => {
    const currentDate = kolkataDateKey();
    const currentTime = kolkataTimeKey();
    try {
      await ensureAutoCheckoutColumns();
      const settings = await query(
      `SELECT organization_id, shift_checkout_time::text AS shift_checkout_time
         FROM office_settings`
      );

      for (const setting of settings) {
        const configuredCheckoutTime = parseConfiguredCheckoutTime(setting.shift_checkout_time);
        if (!configuredCheckoutTime) {
          console.log('Auto checkout skipped: shift checkout time not configured', {
            organizationId: setting.organization_id,
            currentTime
          });
          continue;
        }
        const processKey = `${currentDate}-${setting.organization_id}-${configuredCheckoutTime}`;
        console.log('Auto checkout scheduler tick', {
          currentTime,
          configuredCheckoutTime,
          organizationId: setting.organization_id
        });

        if (currentTime >= configuredCheckoutTime && !processedKeys.has(processKey)) {
          const result = await autoCheckoutMissedPunches(Number(setting.organization_id), null, configuredCheckoutTime, currentDate);
          processedKeys.add(processKey);
          console.log('Auto checkout scheduler completed', {
            organizationId: setting.organization_id,
            configuredCheckoutTime,
            closedCount: result.closedCount
          });
        }
      }
    } catch (err: any) {
      console.error(`Auto checkout scheduler failed: ${err.message || 'Unknown error'}`);
    }
  };

  runSchedulerTick();
  setInterval(runSchedulerTick, 60000);
}

export async function autoCheckoutPreview(organizationId: number) {
  return query(
    `SELECT id, organization_id, user_id, date, check_in_time
     FROM attendance
     WHERE organization_id = $1
       AND check_in_time IS NOT NULL
       AND check_out_time IS NULL
       AND date = $2
       AND attendance_type = 'on_site'
       AND COALESCE(status, 'present') NOT IN ('work_from_home', 'on_duty', 'leave')
     ORDER BY date ASC, user_id ASC`,
    [organizationId, kolkataDateKey()]
  );
}
