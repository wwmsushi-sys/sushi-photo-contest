const AIRTABLE_API_BASE = 'https://api.airtable.com/v0';

export function envGet(env, name, fallback = '') {
  return env && env[name] ? env[name] : fallback;
}

export function requireEnv(env, name) {
  const value = envGet(env, name, '');
  if (!value) throw new Error(`Missing environment variable: ${name}`);
  return value;
}

export function corsHeaders() {
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
  };
}

export function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders() });
}

function airtableHeaders(env) {
  return {
    Authorization: `Bearer ${requireEnv(env, 'AIRTABLE_TOKEN')}`,
    'Content-Type': 'application/json'
  };
}

function tableUrl(env, tableName, params = {}) {
  const baseId = requireEnv(env, 'AIRTABLE_BASE_ID');
  const url = new URL(`${AIRTABLE_API_BASE}/${baseId}/${encodeURIComponent(tableName)}`);
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, value);
  });
  return url.toString();
}

export async function listRecords(env, tableName, params = {}) {
  let records = [];
  let offset;
  do {
    const url = tableUrl(env, tableName, { ...params, offset });
    const res = await fetch(url, { headers: airtableHeaders(env) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || data.error || `Airtable request failed (${res.status})`);
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return records;
}

export async function createRecord(env, tableName, fields) {
  const res = await fetch(tableUrl(env, tableName), {
    method: 'POST',
    headers: airtableHeaders(env),
    body: JSON.stringify({ records: [{ fields }] })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error?.message || data.error || `Airtable create failed (${res.status})`);
  return data.records?.[0];
}

export function attachmentToPhoto(att) {
  return {
    url: att.url,
    thumb: att.thumbnails?.large?.url || att.thumbnails?.full?.url || att.thumbnails?.small?.url || att.url,
    filename: att.filename || ''
  };
}

export function getField(fields, names, fallback = '') {
  for (const name of names) {
    if (fields[name] !== undefined && fields[name] !== null && fields[name] !== '') return fields[name];
  }
  return fallback;
}
