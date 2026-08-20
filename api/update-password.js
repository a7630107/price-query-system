// api/update-password.js
// 用途：用户在站点修改密码后，把新口令同步到飞书"用户注册信息"表的"口令"字段
// 入参：POST { name, oldPassword, newPassword }
// 鉴权：旧口令在飞书表里核对（不依赖任何前端 token）
// 环境变量（Vercel dashboard 配置）：
//   FEISHU_APP_ID, FEISHU_APP_SECRET, FEISHU_APP_TOKEN, FEISHU_TABLE_USERS

module.exports = async (req, res) => {
  // CORS：只允许 GitHub Pages 域名调用
  res.setHeader('Access-Control-Allow-Origin', 'https://a7630107.github.io');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: '仅支持 POST' });
  }

  const { name, oldPassword, newPassword } = req.body || {};
  if (!name || !oldPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: '缺少必填字段' });
  }
  if (String(newPassword).length < 4) {
    return res.status(400).json({ ok: false, error: '新口令至少 4 位' });
  }

  const APP_ID     = process.env.FEISHU_APP_ID;
  const APP_SECRET = process.env.FEISHU_APP_SECRET;
  const APP_TOKEN  = process.env.FEISHU_APP_TOKEN;
  const T_USERS    = process.env.FEISHU_TABLE_USERS;
  if (!APP_ID || !APP_SECRET || !APP_TOKEN || !T_USERS) {
    return res.status(500).json({ ok: false, error: '服务器未配置飞书凭证' });
  }

  try {
    // 1. 取 tenant_access_token
    const tRes = await fetch('https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ app_id: APP_ID, app_secret: APP_SECRET })
    });
    const tJson = await tRes.json();
    if (tJson.code !== 0) {
      return res.status(500).json({ ok: false, error: '飞书鉴权失败: ' + tJson.msg });
    }
    const tk = tJson.tenant_access_token;

    // 2. 在"用户注册信息"表按"账号"搜索
    const sRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${T_USERS}/records/search?user_id_type=open_id`,
      {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search_rule: {
            conjunction: 'and',
            conditions: [{ field_name: '账号', operator: 'is', value: [name] }]
          }
        })
      }
    );
    const sJson = await sRes.json();
    if (sJson.code !== 0) {
      return res.status(500).json({ ok: false, error: '查找用户失败: ' + sJson.msg });
    }
    const items = sJson.data && sJson.data.items ? sJson.data.items : [];
    if (items.length === 0) {
      return res.status(404).json({ ok: false, error: '用户不存在' });
    }
    const rec = items[0];
    const cur = String((rec.fields && rec.fields['口令']) || '');

    // 3. 核对旧口令
    if (cur !== oldPassword) {
      return res.status(401).json({ ok: false, error: '当前口令错误' });
    }

    // 4. 更新"口令"字段
    const uRes = await fetch(
      `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${T_USERS}/records/${rec.record_id}?user_id_type=open_id`,
      {
        method: 'PUT',
        headers: { 'Authorization': `Bearer ${tk}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ fields: { '口令': String(newPassword) } })
      }
    );
    const uJson = await uRes.json();
    if (uJson.code !== 0) {
      return res.status(500).json({ ok: false, error: '更新失败: ' + uJson.msg });
    }

    return res.status(200).json({ ok: true });
  } catch (e) {
    return res.status(500).json({ ok: false, error: '服务器异常: ' + (e && e.message ? e.message : e) });
  }
};
