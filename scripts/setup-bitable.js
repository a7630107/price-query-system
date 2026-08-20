// 一次性脚本：用飞书自建应用凭证，新建多维表 + 3 张表 + 导入现有数据。
// 用法：FEISHU_APP_ID=xxx FEISHU_APP_SECRET=yyy node setup-bitable.js
// 运行后请把打印出的 APP_TOKEN / 三个 TABLE_ID 填入 GitHub Variables（或同步脚本顶部常量）。
const fs = require('fs');
const path = require('path');
const { getToken, createApp, listTables, createTable, deleteTable, batchCreateRecords } = require('./feishu');

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN_ENV = process.env.BITABLE_APP_TOKEN; // 可选：传入你建好的空多维表 app_token，则不再新建
const TEXT = 1, NUMBER = 2;

const seed = p => JSON.parse(fs.readFileSync(path.join(__dirname, p), 'utf8'));
const products = seed('seed-products.json');
const perms = seed('seed-permissions.json');
const users = seed('seed-users.json');

(async () => {
  if (!APP_ID || !APP_SECRET) throw new Error('缺少 FEISHU_APP_ID / FEISHU_APP_SECRET 环境变量');
  const token = await getToken(APP_ID, APP_SECRET);

  // 1) 多维表：传入 BITABLE_APP_TOKEN 则复用你建好的空表；否则新建
  let appToken, defaultTableId = null, url = '';
  if (APP_TOKEN_ENV) {
    appToken = APP_TOKEN_ENV;
    console.log('复用已有多维表 APP_TOKEN=' + appToken);
  } else {
    const created = await createApp(token, '前途查询系统数据源');
    appToken = created.appToken; defaultTableId = created.defaultTableId; url = created.url;
    console.log('APP_TOKEN=' + appToken);
    console.log('BASE_URL=' + url);
  }

  // 2) 产品表（首字段「客户」为主键）
  const tProd = await createTable(token, appToken, '产品询价清单', [
    { field_name: '客户', type: TEXT },
    { field_name: '物料组', type: TEXT },
    { field_name: '产品名称', type: TEXT },
    { field_name: '规格型号', type: TEXT },
    { field_name: '单位', type: TEXT },
    { field_name: '单价(¥)', type: NUMBER },
  ]);

  // 3) 权限表
  const tPerm = await createTable(token, appToken, '分管人员查询权限', [
    { field_name: '分管部门', type: TEXT },
    { field_name: '分管人员', type: TEXT },
    { field_name: '往来单位名称', type: TEXT },
  ]);

  // 4) 用户注册信息表
  const tUser = await createTable(token, appToken, '用户注册信息', [
    { field_name: '账号', type: TEXT },
    { field_name: '分管部门', type: TEXT },
    { field_name: '口令', type: TEXT },
    { field_name: '角色', type: TEXT },
  ]);

  // 5) 删除新建应用时自带的默认空表「数据表」（此时已非最后一张，可删）
  if (defaultTableId) {
    try { await deleteTable(token, appToken, defaultTableId); console.log('已删除默认空表'); }
    catch (e) { console.log('（默认空表未删除：' + e.message + '）'); }
  }

  // 6) 导入数据
  await batchCreateRecords(token, appToken, tProd, products.map(p => ({
    fields: {
      客户: p.customer, 物料组: p.materialGroup, 产品名称: p.productName,
      规格型号: p.spec, 单位: p.unit, ...(p.price != null ? { '单价(¥)': p.price } : {}),
    },
  })));
  await batchCreateRecords(token, appToken, tPerm, perms.map(p => ({
    fields: { 分管部门: p.dept, 分管人员: p.name, 往来单位名称: p.unit },
  })));
  await batchCreateRecords(token, appToken, tUser, users.map(u => ({
    fields: { 账号: u.name, 分管部门: u.dept, 口令: u.passcode, 角色: u.role },
  })));

  console.log('TABLE_PRODUCTS=' + tProd);
  console.log('TABLE_PERMISSIONS=' + tPerm);
  console.log('TABLE_USERS=' + tUser);
  console.log('导入完成：产品 ' + products.length + ' / 权限 ' + perms.length + ' / 用户 ' + users.length);
})().catch(e => { console.error('❌', e.message); process.exit(1); });
