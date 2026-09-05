import 'server-only';
import { randomBytes, createHash } from 'crypto';

// El token crudo solo existe en memoria/URL una vez; en record_shares
// únicamente se guarda su hash (token_hash), nunca el token en claro.
export function generateShareToken() {
  const token = randomBytes(32).toString('base64url');
  const tokenHash = createHash('sha256').update(token).digest('hex');
  return { token, tokenHash };
}

export function hashShareToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
