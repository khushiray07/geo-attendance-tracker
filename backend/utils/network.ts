import { Request } from 'express';

function ipToNumber(ip: string) {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
    return null;
  }
  return parts.reduce((acc, part) => (acc << 8) + part, 0) >>> 0;
}

function normalizeIp(ip: string) {
  return ip.replace(/^::ffff:/, '').trim();
}

function matchesCidr(ip: string, cidr: string) {
  const [rangeIp, bitsText] = cidr.split('/');
  const bits = Number(bitsText);
  const ipNum = ipToNumber(ip);
  const rangeNum = ipToNumber(rangeIp);
  if (ipNum === null || rangeNum === null || !Number.isInteger(bits) || bits < 0 || bits > 32) {
    return false;
  }
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (ipNum & mask) === (rangeNum & mask);
}

function matchesDashRange(ip: string, range: string) {
  const [start, end] = range.split('-').map((value) => value.trim());
  const ipNum = ipToNumber(ip);
  const startNum = ipToNumber(start);
  const endNum = ipToNumber(end);
  if (ipNum === null || startNum === null || endNum === null) return false;
  return ipNum >= startNum && ipNum <= endNum;
}

export function requestIp(req: Request) {
  const forwarded = String(req.headers['x-forwarded-for'] || '').split(',')[0];
  return normalizeIp(forwarded || req.socket.remoteAddress || req.ip || '');
}

export function matchesAllowedIpRanges(ip: string, rangesText?: string | null) {
  const cleanIp = normalizeIp(ip);
  if (!rangesText?.trim()) return { configured: false, matched: true };

  const ranges = rangesText.split(',').map((range) => range.trim()).filter(Boolean);
  const matched = ranges.some((range) => {
    if (range.includes('/')) return matchesCidr(cleanIp, range);
    if (range.includes('-')) return matchesDashRange(cleanIp, range);
    return normalizeIp(range) === cleanIp;
  });

  return { configured: true, matched };
}
