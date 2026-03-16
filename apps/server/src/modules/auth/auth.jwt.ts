import jwt, { JwtPayload, SignOptions } from 'jsonwebtoken';
import { AuthRole } from '../../types/express';

type AuthTokenPayload = JwtPayload & {
  userId: string;
  email: string;
  role: AuthRole;
};

const JWT_ISSUER = 'cryptosparrow';
const JWT_AUDIENCE = 'cryptosparrow-app';

const getJwtSecrets = () => {
  const primarySecret = process.env.JWT_SECRET?.trim();
  const previousSecrets = (process.env.JWT_SECRET_PREVIOUS ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (!primarySecret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return [primarySecret, ...previousSecrets];
};

export const signAuthToken = (
  payload: Pick<AuthTokenPayload, 'userId' | 'email' | 'role'>,
  expiresIn: NonNullable<SignOptions['expiresIn']>
) =>
  jwt.sign(payload, getJwtSecrets()[0], {
    expiresIn,
    algorithm: 'HS256',
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

export const verifyAuthToken = (token: string): AuthTokenPayload => {
  const secrets = getJwtSecrets();

  for (const secret of secrets) {
    try {
      return jwt.verify(token, secret, {
        algorithms: ['HS256'],
        issuer: JWT_ISSUER,
        audience: JWT_AUDIENCE,
      }) as AuthTokenPayload;
    } catch {
      // Try next configured key to support in-flight secret rotation.
    }
  }

  throw new Error('Invalid token');
};

