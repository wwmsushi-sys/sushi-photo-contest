import {
  envGet,
  listRecords,
  json,
  attachmentToPhoto,
  getField
} from './_utils.js';

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') return json({ ok: true });

  try {
    const entriesTable = envGet(env, 'AIRTABLE_ENTRIES_TABLE', 'Entries');
    const entriesView = envGet(env, 'AIRTABLE_ENTRIES_VIEW', 'Gallery');

    const scoresTable = envGet(env, 'AIRTABLE_SCORES_TABLE', 'Scores');
    const commentsField = envGet(env, 'AIRTABLE_COMMENTS_FIELD', 'Comments');

    // Load gallery entries and judge scores at the same time.
    const [records, scores] = await Promise.all([
      listRecords(
        env,
        entriesTable,
        entriesView ? { view: entriesView } : {}
      ),
      listRecords(env, scoresTable)
    ]);

    // Group the judge comments by submission Entry ID.
    const commentsByEntry = new Map();

    scores.forEach(scoreRecord => {
      const scoreFields = scoreRecord.fields || {};

      const entryId = String(scoreFields['Entry ID'] || '').trim();
      const comment = String(scoreFields[commentsField] || '').trim();

      // Skip blank comments.
      if (!entryId || !comment) return;

      if (!commentsByEntry.has(entryId)) {
        commentsByEntry.set(entryId, []);
      }

      commentsByEntry.get(entryId).push(comment);
    });

    const entries = records.map(record => {
      const f = record.fields || {};

      const photoFields = [
        envGet(env, 'AIRTABLE_PHOTO1_FIELD', 'Photo 1'),
        envGet(env, 'AIRTABLE_PHOTO2_FIELD', 'Photo 2'),
        envGet(env, 'AIRTABLE_PHOTO3_FIELD', 'Photo 3'),
        envGet(env, 'AIRTABLE_PHOTOS_FIELD', 'Photos')
      ];

      const photos = [];

      photoFields.forEach(fieldName => {
        const val = f[fieldName];

        if (Array.isArray(val)) {
          val.forEach(att => photos.push(attachmentToPhoto(att)));
        }
      });

      return {
        id: record.id,
        ign: getField(f, [
          'IGN',
          'In-Game Name',
          'In Game Name',
          'in_game_name'
        ]),
        discord: getField(f, [
          'Discord',
          'Discord Name',
          'discord_name'
        ]),
        title: getField(f, [
          'Title',
          'Photo Title',
          'photo_title'
        ], 'Untitled'),
        summary: getField(f, [
          'Summary',
          'Short Story',
          'Story',
          'summary'
        ]),
        photos,

        // Each gallery entry will now include its judge comments.
        comments: commentsByEntry.get(record.id) || [],

        createdTime: record.createdTime
      };
    }).filter(entry => entry.photos.length > 0);

    return json({ entries });
  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
