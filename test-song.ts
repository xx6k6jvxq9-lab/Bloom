async function test() {
  const url = 'https://m7.music.126.net/20260302194928/c6312d7299d2a9e313f0fc9f76d4879b/ymusic/0fd6/4f65/43ed/a8772889f38dfcb91c04da915b301617.mp3?vuutv=KIEroRadjKOU1vnL1LtUPkG9wEwddllrQn+kvGDIUhz0uFM77ExYlEhG6X36VvXZ8FMEPPNWjAoXYzmWnd6T+3T4o+SXbXvljouZQE6y3wU=';
  const res = await fetch(url);
  console.log(res.status, res.statusText);
  console.log(res.headers.get('content-type'));
  console.log(res.headers.get('content-length'));
}

test();
