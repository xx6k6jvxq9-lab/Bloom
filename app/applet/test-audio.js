import https from 'https';

https.get('https://music.163.com/song/media/outer/url?id=1973665667.mp3', (res) => {
  console.log('Status Code:', res.statusCode);
  console.log('Headers:', res.headers);
}).on('error', (e) => {
  console.error(e);
});
