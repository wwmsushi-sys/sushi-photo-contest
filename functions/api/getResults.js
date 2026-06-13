import { envGet, listRecords, json, getField } from './_utils.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method === 'OPTIONS') return json({ ok: true });
  if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);

try {
    const data = await request.json().catch(() => ({}));
    const requiredCode = envGet(env, 'JUDGE_CODE', '');
    if (requiredCode && data.judgeCode !== requiredCode) return json({ error: 'Invalid judge code.' }, 401);

    const entriesTable = envGet(env, 'AIRTABLE_ENTRIES_TABLE', 'Entries');
    const entriesView = envGet(env, 'AIRTABLE_ENTRIES_VIEW', 'Gallery');
    const scoresTable = envGet(env, 'AIRTABLE_SCORES_TABLE', 'Scores');

    const entries = await listRecords(env, entriesTable, entriesView ? { view: entriesView } : {});
    const scores = await listRecords(env, scoresTable);

    const entryMap = new Map(entries.map(r => [r.id, {
      id: r.id,
      title: getField(r.fields || {}, ['Title', 'Photo Title', 'photo_title'], 'Untitled'),
      ign: getField(r.fields || {}, ['IGN', 'In-Game Name', 'In Game Name', 'in_game_name'], 'Unknown')
    }]));

    const grouped = new Map();
    scores.forEach(record => {
      const f = record.fields || {};
      const id = f['Entry ID'];
      const total = Number(f['Total Score'] || 0);
      if (!id || !entryMap.has(id)) return;
      if (!grouped.has(id)) grouped.set(id, { ...entryMap.get(id), total: 0, judgeCount: 0, average: 0 });
      const item = grouped.get(id);
      item.total += total;
      item.judgeCount += 1;
      item.average = item.total / item.judgeCount;
    });

    const results = Array.from(grouped.values()).sort((a, b) => b.average - a.average || b.total - a.total);
    return json({ results });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
