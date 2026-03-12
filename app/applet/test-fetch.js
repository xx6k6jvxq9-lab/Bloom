import http from 'http';
http.get('http://localhost:3000/api/netease/playlist?id=3778678', (res) => {
  let data = '';
  res.on('data', (chunk) => data += chunk);
  res.on('end', () => console.log(data.substring(0, 200)));
});
