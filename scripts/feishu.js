// 飞书多维表（Bitable）Open API 轻量封装，仅用 Node 内置 fetch，无第三方依赖。
// 域名：https://open.feishu.cn
const BASE = 'https://open.feishu.cn/open-apis';

async function getToken(appId, appSecret) {
  const r = await fetch(BASE + '/auth/v3/tenant_access_token/internal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
  });
  const j = await r.json();
  if (j.code !== 0) throw new Error('获取 tenant_access_token 失败: ' + JSON.stringify(j));
  return j.tenant_access_token;
}

async function api(token, method, path, body) {
  const opts = { method, headers: { Authorization: 'Bearer ' + token } };
  if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  const r = await fetch(BASE + path, opts);
  const txt = await r.text();
  let j;
  try { j = JSON.parse(txt); } catch (e) { throw new Error(`Feishu ${method} ${path} -> 非JSON响应 HTTP ${r.status}: ${txt.slice(0, 120)}`); }
  if (j.code !== 0) throw new Error(`Feishu ${method} ${path} -> code ${j.code}: ${j.msg}`);
  return j;
}

async function deleteTable(token, appToken, tableId) {
  await api(token, 'DELETE', `/bitable/v1/apps/${appToken}/tables/${tableId}`);
}

async function createApp(token, name) {
  const j = await api(token, 'POST', '/bitable/v1/apps', { name });
  return { appToken: j.data.app.app_token, defaultTableId: j.data.app.default_table_id, url: j.data.app.url };
}

async function listTables(token, appToken) {
  const j = await api(token, 'GET', `/bitable/v1/apps/${appToken}/tables`);
  return j.data.items;
}

async function createTable(token, appToken, name, fields) {
  // 首个字段作为主键（索引字段）
  const j = await api(token, 'POST', `/bitable/v1/apps/${appToken}/tables`, { table: { name, fields } });
  return j.data.table_id;
}

async function renameTable(token, appToken, tableId, name) {
  await api(token, 'PATCH', `/bitable/v1/apps/${appToken}/tables/${tableId}`, { name });
}

async function fieldList(token, appToken, tableId) {
  const j = await api(token, 'GET', `/bitable/v1/apps/${appToken}/tables/${tableId}/fields`);
  return j.data.items;
}

async function renameField(token, appToken, tableId, fieldId, name) {
  await api(token, 'PATCH', `/bitable/v1/apps/${appToken}/tables/${tableId}/fields/${fieldId}`, { field_name: name });
}

async function createField(token, appToken, tableId, name, type) {
  await api(token, 'POST', `/bitable/v1/apps/${appToken}/tables/${tableId}/fields`, { field_name: name, type });
}

async function listRecords(token, appToken, tableId) {
  let all = [], pageToken = '', hasMore = true;
  while (hasMore) {
    let path = `/bitable/v1/apps/${appToken}/tables/${tableId}/records?page_size=500`;
    if (pageToken) path += '&page_token=' + encodeURIComponent(pageToken);
    const j = await api(token, 'GET', path);
    all = all.concat(j.data.items || []);
    hasMore = j.data.has_more;
    pageToken = j.data.page_token || '';
  }
  return all;
}

async function batchCreateRecords(token, appToken, tableId, records) {
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    await api(token, 'POST', `/bitable/v1/apps/${appToken}/tables/${tableId}/records/batch_create`, { records: chunk });
    if (i + 500 < records.length) await new Promise(r => setTimeout(r, 300));
  }
}

module.exports = {
  BASE, getToken, api, createApp, listTables, createTable, deleteTable,
  renameTable, fieldList, renameField, createField, listRecords, batchCreateRecords,
};
