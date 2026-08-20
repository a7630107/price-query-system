// 同步脚本：从飞书多维表读取 3 张表 -> 生成 data/products.json + data/users.json
// 由 GitHub Action 定时/手动触发，或直接本地运行。
// 需要环境变量：FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN,
//   FEISHU_TABLE_PRODUCTS, FEISHU_TABLE_PERMISSIONS, FEISHU_TABLE_USERS
// 输出：data/products.json, data/users.json（与 template.html 注入格式一致）
const fs = require('fs');
const path = require('path');
const { getToken, listRecords } = require('./feishu');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;
const T_PROD = process.env.FEISHU_TABLE_PRODUCTS;
const T_PERM = process.env.FEISHU_TABLE_PERMISSIONS;
const T_USER = process.env.FEISHU_TABLE_USERS;
const OUT_DIR = process.env.OUT_DIR || 'data';

(async () => {
  for (const [k, v] of [['FEISHU_APP_ID', APP_ID], ['FEISHU_APP_SECRET', APP_SECRET], ['FEISHU_APP_TOKEN', APP_TOKEN],
    ['FEISHU_TABLE_PRODUCTS', T_PROD], ['FEISHU_TABLE_PERMISSIONS', T_PERM], ['FEISHU_TABLE_USERS', T_USER]]) {
    if (!v) throw new Error('缺少环境变量 ' + k);
  }
  const token = await getToken(APP_ID, APP_SECRET);

  // 1) 产品
  const pRecs = await listRecords(token, APP_TOKEN, T_PROD);
  const products = pRecs.map(r => {
    const f = r.fields || {};
    const price = (f['单价(¥)'] === undefined || f['单价(¥)'] === null || f['单价(¥)'] === '') ? null : Number(f['单价(¥)']);
    return {
      customer: String(f['客户'] ?? '').trim(),
      materialGroup: String(f['物料组'] ?? '').trim(),
      productName: String(f['产品名称'] ?? '').trim(),
      spec: String(f['规格型号'] ?? '').trim(),
      unit: String(f['单位'] ?? '').trim(),
      price,
    };
  }).filter(p => p.customer);
  console.log('读取产品记录:', pRecs.length, '=> 有效', products.length);

  // 2) 权限 -> 按分管人员聚合往来单位
  const permRecs = await listRecords(token, APP_TOKEN, T_PERM);
  const managedByUser = {};
  for (const r of permRecs) {
    const f = r.fields || {};
    const name = String(f['分管人员'] ?? '').trim();
    const unit = String(f['往来单位名称'] ?? '').trim();
    if (name && unit) {
      (managedByUser[name] = managedByUser[name] || new Set()).add(unit);
    }
  }

  // 3) 用户 + 合并 managedUnits
  const userRecs = await listRecords(token, APP_TOKEN, T_USER);
  const users = userRecs.map(r => {
    const f = r.fields || {};
    const name = String(f['账号'] ?? '').trim();
    const role = String(f['角色'] ?? 'user').trim() || 'user';
    return {
      name,
      passcode: String(f['口令'] ?? '').trim(),
      role: (role === 'admin' || role === 'sales' || role === 'user') ? role : 'user',
      dept: String(f['分管部门'] ?? '').trim(),
      managedUnits: Array.from(managedByUser[name] || []),
    };
  }).filter(u => u.name);
  console.log('读取用户记录:', userRecs.length, '=> 有效', users.length);

  // 4) 写出
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, 'products.json'), JSON.stringify(products, null, 1), 'utf8');
  fs.writeFileSync(path.join(OUT_DIR, 'users.json'), JSON.stringify(users, null, 1), 'utf8');
  console.log('已写出', path.join(OUT_DIR, 'products.json'), '和', path.join(OUT_DIR, 'users.json'));
})().catch(e => { console.error('❌', e.message); process.exit(1); });
