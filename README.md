# price-query-system

前途产品价格查询系统 - 单文件离线/在线版。

## 数据更新流程（管理员）

1. 本地更新 `data/products.json`（可用 `publish.js` 从 Excel 一键生成并推送）
2. 推送到 main 分支后，GitHub Actions 自动重建 `index.html` 并部署到 Pages
3. 所有用户访问 Pages 地址即可看到最新数据

## 本地构建

```bash
node build.js
```

`build.js` 读取 `data/*.json` + `template.html`，生成 `index.html`（双击即用）。
