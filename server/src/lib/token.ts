import jwt from 'jsonwebtoken';
import { config } from '../config';

export interface TokenPayload {
  sub: number; // user id
  role_id: number;
}

export function signToken(payload: TokenPayload): string {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: config.jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): TokenPayload {
  return jwt.verify(token, config.jwtSecret) as unknown as TokenPayload;
}
