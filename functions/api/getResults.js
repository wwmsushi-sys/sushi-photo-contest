import { envGet, listRecords, json, getField } from './_utils.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return json({ ok: true });
  }

  // Allow both GET and POST temporarily.
  // This keeps the public results page working even if an older cached
  // version of app.js is still sending a POST request.
  if (!['GET', 'POST'].includes(request.method)) {
    return json({ error: 'Method not allowed' }, 405);
  }

  try {
    const entriesTable = envGet(env, 'AIRTABLE_ENTRIES_TABLE', 'Entries');
    const entriesView = envGet(env, 'AIRTABLE_ENTRIES_VIEW', 'Gallery');
    const scoresTable = envGet(env, 'AIRTABLE_SCORES_TABLE', 'Scores');

    const entries = await listRecords(
      env,
      entriesTable,
      entriesView ? { view: entriesView } : {}
    );

    const scores = await listRecords(env, scoresTable);

    const entryMap = new Map(
      entries.map(record => [
        record.id,
        {
          id: record.id,
          title: getField(
            record.fields || {},
            ['Title', 'Photo Title', 'photo_title'],
            'Untitled'
          ),
          ign: getField(
            record.fields || {},
            ['IGN', 'In-Game Name', 'In Game Name', 'in_game_name'],
            'Unknown'
          )
        }
      ])
    );

    const grouped = new Map();

    scores.forEach(record => {
      const fields = record.fields || {};

      // Supports either a plain Entry ID field or a linked Airtable field.
      const rawEntryId = fields['Entry ID'];
      const entryId = Array.isArray(rawEntryId) ? rawEntryId[0] : rawEntryId;

      const total = Number(fields['Total Score'] || 0);

      if (!entryId || !entryMap.has(entryId)) return;

      if (!grouped.has(entryId)) {
        grouped.set(entryId, {
          ...entryMap.get(entryId),
          total: 0,
          judgeCount: 0,
          average: 0
        });
      }

      const item = grouped.get(entryId);
      item.total += total;
      item.judgeCount += 1;
      item.average = item.total / item.judgeCount;
    });

    const results = Array.from(grouped.values()).sort(
      (a, b) => b.average - a.average || b.total - a.total
    );

    return json({
      version: 'public-results-v2',
      results
    });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
