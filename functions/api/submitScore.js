import { envGet, createRecord, json } from './_utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const data = await request.json().catch(() => ({}));
    const requiredCode = envGet(env, 'JUDGE_CODE', '');
    if (requiredCode && data.judgeCode !== requiredCode) return json({ error: 'Invalid judge code.' }, 401);

    const required = ['entryId', 'judgeName', 'creativity', 'composition', 'character', 'story', 'impact', 'total'];
    for (const key of required) {
      if (data[key] === undefined || data[key] === null || data[key] === '') return json({ error: `Missing field: ${key}` }, 400);
    }

    const table = envGet(env, 'AIRTABLE_SCORES_TABLE', 'Scores');
    const commentsField = envGet(env, 'AIRTABLE_COMMENTS_FIELD', 'Comments');
    const fields = {
      'Entry ID': String(data.entryId),
      'Judge Name': String(data.judgeName),
      'Creativity': Number(data.creativity),
      'Composition': Number(data.composition),
      'Character Presentation': Number(data.character),
      'Story / Summary': Number(data.story),
      'Overall Impact': Number(data.impact),
      'Total Score': Number(data.total),
      [commentsField]: String(data.comments || '')
    };

    const record = await createRecord(env, table, fields);
    return json({ success: true, id: record.id });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
