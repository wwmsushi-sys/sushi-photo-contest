import { envGet, json } from './_utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const data = await request.json().catch(() => ({}));
    const requiredCode = envGet(env, 'JUDGE_CODE', '');

    if (!requiredCode) return json({ error: 'Missing environment variable: JUDGE_CODE' }, 500);
    if (!data.judgeCode || String(data.judgeCode) !== String(requiredCode)) {
      return json({ error: 'Invalid judge code.' }, 401);
    }

    return json({ success: true });
  } catch (err) {
    return json({ error: 'Invalid request.' }, 400);
  }
}
