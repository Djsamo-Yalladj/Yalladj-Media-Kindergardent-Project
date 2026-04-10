// B1-a smoke test: src/lib/password.ts — hashPassword / verifyPassword / policy.

const { hashPassword, verifyPassword, PasswordPolicyError } = await import('../src/lib/password.ts');

let failed = 0;
function check(label, cond) {
  const mark = cond ? '✅' : '❌';
  console.log(`${mark} ${label}`);
  if (!cond) failed++;
}

const plain = 'correct-horse-battery';
const hash = await hashPassword(plain);
check('hash has bcrypt prefix', /^\$2[aby]\$/.test(hash));
check('hash length ~60', hash.length >= 59 && hash.length <= 60);
check('verify(correct) → true', (await verifyPassword(plain, hash)) === true);
check('verify(wrong) → false', (await verifyPassword('nope-nope-nope', hash)) === false);
check('verify(empty hash) → false', (await verifyPassword(plain, '')) === false);
check('verify(malformed hash) → false', (await verifyPassword(plain, 'not-a-hash')) === false);

try {
  await hashPassword('short');
  check('policy rejects <8 chars', false);
} catch (e) {
  check('policy rejects <8 chars', e instanceof PasswordPolicyError);
}

try {
  await hashPassword('x'.repeat(200));
  check('policy rejects >128 chars', false);
} catch (e) {
  check('policy rejects >128 chars', e instanceof PasswordPolicyError);
}

// Different salt → different hash
const hash2 = await hashPassword(plain);
check('two hashes differ (random salt)', hash !== hash2);
check('both verify the same plaintext', (await verifyPassword(plain, hash2)) === true);

console.log(failed === 0 ? `\n✅ all password tests passed` : `\n❌ ${failed} tests failed`);
process.exit(failed === 0 ? 0 : 1);
