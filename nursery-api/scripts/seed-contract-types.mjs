import { neon } from '@neondatabase/serverless';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const env = readFileSync(new URL('../.env', import.meta.url), 'utf8');
const url = env.match(/DATABASE_URL="([^"]+)"/)[1];
const sql = neon(url);

// cuid-ish: Prisma uses cuid() default, but we're inserting raw — use UUIDs prefixed to distinguish.
// (Raw SQL can't call Prisma's cuid(), and the schema allows any String @id.)
const seeds = [
  {
    key: 'monthly_support',
    label: { en: 'Monthly Support', ar: 'دعم شهري' },
    description: {
      en: 'Ongoing monthly support: content updates, bug fixes, small changes.',
      ar: 'دعم شهري مستمر: تحديثات المحتوى وإصلاح الأخطاء والتعديلات الصغيرة.',
    },
    defaultPrice: 500,
    billingCycle: 'monthly',
    sortOrder: 1,
  },
  {
    key: 'yearly_contract',
    label: { en: 'Yearly Contract', ar: 'عقد سنوي' },
    description: {
      en: 'Full-year contract with priority support, hosting, and quarterly refreshes.',
      ar: 'عقد سنوي شامل مع دعم أولوية واستضافة وتحديثات ربع سنوية.',
    },
    defaultPrice: 5000,
    billingCycle: 'yearly',
    sortOrder: 2,
  },
  {
    key: 'one_time_handover',
    label: { en: 'One-Time Handover', ar: 'تسليم لمرة واحدة' },
    description: {
      en: 'Final code/asset handover — client takes full ownership, no ongoing support.',
      ar: 'تسليم نهائي للكود والأصول — يتملك العميل كامل الحقوق دون دعم مستمر.',
    },
    defaultPrice: null,
    billingCycle: 'one_time',
    sortOrder: 3,
  },
];

for (const s of seeds) {
  const id = randomUUID();
  await sql`
    INSERT INTO contract_types (id, key, label, description, default_price, billing_cycle, sort_order, is_active, is_system, created_at, updated_at)
    VALUES (${id}, ${s.key}, ${s.label}, ${s.description}, ${s.defaultPrice}, ${s.billingCycle}, ${s.sortOrder}, true, true, NOW(), NOW())
    ON CONFLICT (key) DO NOTHING
  `;
}

const rows = await sql`SELECT key, label, default_price, billing_cycle, is_system FROM contract_types ORDER BY sort_order`;
console.log('contract_types rows:', rows.length);
for (const r of rows) console.log(` - ${r.key} (${r.billing_cycle}) price=${r.default_price} system=${r.is_system}`);
