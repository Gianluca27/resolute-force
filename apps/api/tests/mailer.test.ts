import { describe, it, expect } from 'vitest';
import { sendMail } from '../src/lib/mailer.js';

describe('sendMail', () => {
  it('no-ops (resolves) when SMTP is not configured', async () => {
    await expect(sendMail({ to: 'x@y.com', subject: 'hi', html: '<p>hi</p>' })).resolves.toBeUndefined();
  });
});
