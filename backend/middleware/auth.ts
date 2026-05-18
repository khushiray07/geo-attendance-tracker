import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { one } from '../database';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
    organization_id: number;
  };
}

export const authenticate = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Authentication required' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    const user = await one(
      `SELECT id, name, email, role, organization_id, is_active
       FROM users
       WHERE id = $1`,
      [decoded.id]
    );

    if (!user || !user.is_active) {
      return res.status(401).json({ message: 'Account is inactive or unavailable' });
    }
    if (!user.organization_id) {
      return res.status(403).json({ message: 'User is not linked to an organization' });
    }

    req.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      organization_id: user.organization_id
    };
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token' });
  }
};

export const requireAdmin = (req: AuthRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ message: 'Admin access required' });
  }
  next();
};
