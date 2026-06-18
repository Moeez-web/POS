import bcrypt from 'bcryptjs';
import { config } from '../config';

export function hashPassword(plain: string): string {
  return bcrypt.hashSync(plain, config.bcryptRounds);
}

export function verifyPassword(plain: string, hash: string): boolean {
  return bcrypt.compareSync(plain, hash);
}
