import { NextFunction, Request, Response } from 'express';
import { sendError } from '../utils/apiError';

const normalizeIp = (raw: string | undefined): string | null => {
  if (!raw) return null;
  const first = raw.split(',')[0]?.trim();
  if (!first) return null;
  if (first.startsWith('::ffff:')) return first.slice(7);
  return first;
};

const isPrivateIpv4 = (ip: string) => {
  const parts = ip.split('.').map((value) => Number.parseInt(value, 10));
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part) || part < 0 || part > 255)) {
    return false;
  }

  if (parts[0] === 10) return true;
  if (parts[0] === 192 && parts[1] === 168) return true;
  if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
  if (parts[0] === 127) return true;
  return false;
};

const isPrivateIpv6 = (ip: string) => ip === '::1' || ip.toLowerCase().startsWith('fc') || ip.toLowerCase().startsWith('fd');

const isAllowedByNetwork = (ip: string) => {
  const explicit = (process.env.OPS_ALLOWED_IPS ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
  if (explicit.includes(ip)) return true;

  if ((process.env.OPS_ALLOW_PRIVATE_NETWORK ?? 'true').toLowerCase() === 'true') {
    return isPrivateIpv4(ip) || isPrivateIpv6(ip);
  }

  return false;
};

export const requireOpsNetwork = (req: Request, res: Response, next: NextFunction) => {
  const ip = normalizeIp(req.headers['x-forwarded-for'] as string | undefined)
    ?? normalizeIp(req.ip)
    ?? normalizeIp(req.socket.remoteAddress);

  if (!ip || !isAllowedByNetwork(ip)) {
    return sendError(res, 403, 'Forbidden');
  }

  next();
};
