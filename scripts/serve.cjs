const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
http.createServer((req, res) => {
  const pathname = new URL(req.url, 'http://localhost').pathname;
  if (pathname !== '/' && pathname !== '/index.html') {
    res.writeHead(404); return res.end('Not found');
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  fs.createReadStream(path.join(root, 'index.html')).pipe(res);
}).listen(4187, '127.0.0.1', () => console.log('Modisto preview: http://127.0.0.1:4187'));
