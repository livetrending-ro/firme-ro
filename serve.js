const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname);
const MIME = { html:'text/html', css:'text/css', js:'application/javascript', json:'application/json', png:'image/png', ico:'image/x-icon' };

http.createServer((req, res) => {
  let url = req.url.split('?')[0];
  if (url === '/') url = '/index.html';
  const filePath = path.join(ROOT, url);
  const ext = url.split('.').pop();
  try {
    const data = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'text/plain', 'Access-Control-Allow-Origin': '*' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
}).listen(8080, () => console.log('✅ FirmeRO HTTP server pe http://localhost:8080'));
