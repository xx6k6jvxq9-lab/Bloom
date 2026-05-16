import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildCustomPageEpisodeSrcDoc,
  normalizePageEpisodeHtmlDocument,
} from './pageEpisodeHtml';

test('normalizePageEpisodeHtmlDocument strips html fences and decodes escaped markup', () => {
  const normalized = normalizePageEpisodeHtmlDocument('```html\n&lt;div class=&quot;card&quot;&gt;你好&lt;/div&gt;\n```');

  assert.equal(normalized, '<div class="card">你好</div>');
});

test('buildCustomPageEpisodeSrcDoc wraps html fragments in a full document shell', () => {
  const result = buildCustomPageEpisodeSrcDoc({
    pageType: 'micro_app',
    title: '绘制页',
    subtitle: '点一下开始。',
    htmlDocument: '<main><button type="button">开始</button></main>',
  });

  assert.match(result, /<!doctype html>/i);
  assert.match(result, /<meta name="viewport"/i);
  assert.match(result, /<title>绘制页<\/title>/);
  assert.match(result, /<main><button type="button">开始<\/button><\/main>/);
  assert.match(result, /page-episode-html-runtime/);
});

test('buildCustomPageEpisodeSrcDoc preserves head and body content from a full html document', () => {
  const result = buildCustomPageEpisodeSrcDoc({
    pageType: 'custom_html',
    title: '夜页',
    htmlDocument: '<!doctype html><html><head><style>body{background:#101827;}</style></head><body class="scene-shell" data-mode="night"><section>内容</section></body></html>',
  });

  assert.match(result, /<style>body\{background:#101827;\}<\/style>/);
  assert.match(result, /<body class="scene-shell" data-mode="night">/);
  assert.match(result, /<section>内容<\/section>/);
});

test('buildCustomPageEpisodeSrcDoc seeds a fallback shell when html content is missing or plain text only', () => {
  const result = buildCustomPageEpisodeSrcDoc({
    pageType: 'micro_app',
    title: '绘图番外',
    caption: '点击开始按钮后出现绘制动画。',
    htmlDocument: '先画一颗心，再慢慢把线条补齐。',
  });

  assert.match(result, /data-codex-html-fallback="true"/);
  assert.match(result, /触发互动/);
  assert.match(result, /点击开始按钮后出现绘制动画。|先画一颗心/);
});
