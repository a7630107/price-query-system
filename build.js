// 由 Actions 自动执行：读 data + template -> 生成 index.html
const fs = require('fs');
const products = JSON.parse(fs.readFileSync('data/products.json', 'utf8'));
const users = JSON.parse(fs.readFileSync('data/users.json', 'utf8'));
let tpl = fs.readFileSync('template.html', 'utf8');
let html = tpl
  .replace('__PRODUCTS__', JSON.stringify(products))
  .replace('__USERS__', JSON.stringify(users));
if (/__PRODUCTS__|__USERS__/.test(html)) throw new Error('占位符未替换完毕');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Built index.html: products=' + products.length + ', users=' + users.length);
