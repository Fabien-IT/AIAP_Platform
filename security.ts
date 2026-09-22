import crypto from 'node:crypto';
export function hashForAudit(value:string){return crypto.createHash('sha256').update(value).digest('hex')}
