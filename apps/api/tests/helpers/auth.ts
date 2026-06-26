import { signAdmin } from '../../src/lib/jwt.js';
export const adminToken = () => signAdmin({ sub: 'admin-test', email: 'admin@test.com' });
export const authHeader = () => ({ Authorization: `Bearer ${adminToken()}` });
