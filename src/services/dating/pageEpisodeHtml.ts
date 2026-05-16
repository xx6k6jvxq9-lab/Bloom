import type { DatingPageEpisode, DatingPageEpisodeType } from '../../types';

type HtmlPageEpisodeType = Extract<DatingPageEpisodeType, 'micro_app' | 'custom_html'>;

type BuildCustomPageEpisodeSrcDocOptions = Pick<DatingPageEpisode, 'title' | 'subtitle' | 'caption' | 'htmlDocument'> & {
  pageType: HtmlPageEpisodeType;
};

type HtmlFallbackCopy = {
  pageLabel: string;
  title: string;
  subtitle: string;
  caption: string;
  primaryLabel: string;
  secondaryLabel: string;
  phases: Array<{
    accent: string;
    status: string;
    detail: string;
  }>;
};

const HTML_CODE_FENCE_REGEX = /^```(?:html)?\s*([\s\S]*?)```$/i;
const HTML_ENTITY_TAG_REGEX = /&lt;(?:!doctype|html|head|body|main|section|article|div|style|script|canvas|svg|button|p|h1)\b/i;
const HTML_TAG_REGEX = /<\/?[a-z][^>]*>/i;
const TITLE_TAG_REGEX = /<title[\s>]/i;
const CHARSET_META_REGEX = /<meta[^>]+charset=/i;
const VIEWPORT_META_REGEX = /<meta[^>]+name=(['"])viewport\1/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function toScriptLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replace(/<\//g, '<\\/')
    .replace(/<!--/g, '<\\!--');
}

function stripHtmlCodeFence(value: string): string {
  const fencedMatch = value.match(HTML_CODE_FENCE_REGEX);
  return fencedMatch ? fencedMatch[1].trim() : value;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&');
}

function extractTagContent(source: string, tagName: string): string {
  const match = source.match(new RegExp(`<${tagName}\\b[^>]*>([\\s\\S]*?)</${tagName}>`, 'i'));
  return match?.[1]?.trim() || '';
}

function extractOpeningTagAttributes(source: string, tagName: string): string {
  const match = source.match(new RegExp(`<${tagName}\\b([^>]*)>`, 'i'));
  return match?.[1]?.trim() || '';
}

function removeTagBlock(source: string, tagName: string): string {
  return source.replace(new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?</${tagName}>`, 'i'), '').trim();
}

function stripDocumentChrome(source: string): string {
  return source
    .replace(/<!doctype[^>]*>/i, '')
    .replace(/<\/?html\b[^>]*>/gi, '')
    .trim();
}

function formatOptionalAttributes(rawAttributes: string): string {
  return rawAttributes.trim() ? ` ${rawAttributes.trim()}` : '';
}

function formatHtmlAttributes(rawAttributes: string, fallbackLang: string): string {
  const normalized = rawAttributes.trim();
  if (!normalized) {
    return ` lang="${fallbackLang}"`;
  }

  if (!/\blang\s*=/i.test(normalized)) {
    return ` ${normalized} lang="${fallbackLang}"`;
  }

  return ` ${normalized}`;
}

function resolveFallbackCopy(options: BuildCustomPageEpisodeSrcDocOptions, fallbackHint?: string): HtmlFallbackCopy {
  const pageLabel = options.pageType === 'micro_app' ? '互动小模块' : '自定义页面';
  const title = options.title?.trim() || (options.pageType === 'micro_app' ? '这页的小互动先搭好了' : '这一页先把视觉骨架搭好了');
  const subtitle = options.subtitle?.trim() || (
    options.pageType === 'micro_app'
      ? '先让这一页有可点、可切换、可继续扩写的舞台。'
      : '先把首屏层次和可继续润色的视觉骨架立起来。'
  );
  const caption = fallbackHint?.trim() || options.caption?.trim() || (
    options.pageType === 'micro_app'
      ? '点一下下面的按钮，让这一页先从静态壳变成有反馈的模块。'
      : '先把标题、说明和视觉重心摆出来，再继续往里补细节。'
  );
  const primaryLabel = options.pageType === 'micro_app' ? '触发互动' : '展开页面';
  const secondaryLabel = options.pageType === 'micro_app' ? '切换气氛' : '切换版式';

  return {
    pageLabel,
    title,
    subtitle,
    caption,
    primaryLabel,
    secondaryLabel,
    phases: options.pageType === 'micro_app'
      ? [
          {
            accent: '#e86a33',
            status: '页面已经有了起手势。',
            detail: subtitle,
          },
          {
            accent: '#0f766e',
            status: '互动被点亮了一格。',
            detail: caption,
          },
          {
            accent: '#2563eb',
            status: '这一页已经能继续往里长。',
            detail: `${title} 现在至少有了首屏、反馈和继续扩写的支点。`,
          },
        ]
      : [
          {
            accent: '#c2410c',
            status: '页面骨架已经立住。',
            detail: subtitle,
          },
          {
            accent: '#0f766e',
            status: '版式开始呼吸了。',
            detail: caption,
          },
          {
            accent: '#2563eb',
            status: '这一页已经有了继续润色的重心。',
            detail: `${title} 现在至少有了标题、层次和能继续往下加内容的落点。`,
          },
        ],
  };
}

function buildFallbackMarkup(options: BuildCustomPageEpisodeSrcDocOptions, fallbackHint?: string): string {
  const copy = resolveFallbackCopy(options, fallbackHint);
  const initialPhase = copy.phases[0];

  return `
<main class="page-episode-html-fallback" data-codex-html-fallback="true" data-phase-index="0">
  <section class="page-episode-html-fallback__card">
    <div class="page-episode-html-fallback__eyebrow">${escapeHtml(copy.pageLabel)}</div>
    <h1 class="page-episode-html-fallback__title">${escapeHtml(copy.title)}</h1>
    <p class="page-episode-html-fallback__subtitle">${escapeHtml(copy.subtitle)}</p>
    <div class="page-episode-html-fallback__pulse-row" aria-hidden="true">
      <span class="page-episode-html-fallback__pulse" data-codex-html-fallback-pulse="0" data-active="true"></span>
      <span class="page-episode-html-fallback__pulse" data-codex-html-fallback-pulse="1" data-active="false"></span>
      <span class="page-episode-html-fallback__pulse" data-codex-html-fallback-pulse="2" data-active="false"></span>
    </div>
    <div class="page-episode-html-fallback__status" data-codex-html-fallback-status>${escapeHtml(initialPhase.status)}</div>
    <p class="page-episode-html-fallback__detail" data-codex-html-fallback-detail>${escapeHtml(initialPhase.detail)}</p>
    <div class="page-episode-html-fallback__actions">
      <button type="button" class="page-episode-html-fallback__button page-episode-html-fallback__button--primary" data-codex-html-action="primary">${escapeHtml(copy.primaryLabel)}</button>
      <button type="button" class="page-episode-html-fallback__button page-episode-html-fallback__button--secondary" data-codex-html-action="secondary">${escapeHtml(copy.secondaryLabel)}</button>
    </div>
  </section>
</main>
  `.trim();
}

function buildBaseStyle(): string {
  return `
:root {
  color-scheme: light;
  --page-episode-accent: #e86a33;
}
html, body {
  min-height: 100%;
}
body {
  margin: 0;
  color: #0f172a;
}
*, *::before, *::after {
  box-sizing: border-box;
}
img, svg, canvas, video {
  display: block;
  max-width: 100%;
}
button, input, textarea, select {
  font: inherit;
}
.page-episode-html-status {
  position: fixed;
  top: 14px;
  left: 50%;
  z-index: 2147483647;
  max-width: min(90vw, 360px);
  padding: 10px 14px;
  border-radius: 999px;
  background: rgba(15, 23, 42, 0.84);
  color: #f8fafc;
  font-size: 12px;
  line-height: 1.45;
  transform: translateX(-50%) translateY(-8px);
  opacity: 0;
  box-shadow: 0 12px 24px rgba(15, 23, 42, 0.22);
  transition: opacity 160ms ease, transform 160ms ease;
  pointer-events: none;
}
.page-episode-html-status[data-visible="true"] {
  opacity: 1;
  transform: translateX(-50%) translateY(0);
}
.page-episode-html-fallback {
  min-height: 100vh;
  padding: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background:
    radial-gradient(circle at top left, rgba(232, 106, 51, 0.16), transparent 38%),
    radial-gradient(circle at top right, rgba(15, 118, 110, 0.12), transparent 34%),
    linear-gradient(180deg, #fff8ef 0%, #f3ede5 100%);
}
body[data-page-episode-kind="custom_html"] .page-episode-html-fallback {
  background:
    radial-gradient(circle at 12% 10%, rgba(194, 65, 12, 0.14), transparent 34%),
    linear-gradient(160deg, #f8f1e8 0%, #edf2ef 100%);
}
.page-episode-html-fallback__card {
  width: min(100%, 420px);
  padding: 24px;
  border-radius: 28px;
  background: rgba(255, 251, 247, 0.94);
  border: 1px solid rgba(255, 255, 255, 0.72);
  box-shadow: 0 28px 60px rgba(148, 163, 184, 0.18);
  backdrop-filter: blur(14px);
}
.page-episode-html-fallback__eyebrow {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--page-episode-accent);
}
.page-episode-html-fallback__title {
  margin: 14px 0 0;
  font-size: 28px;
  line-height: 1.08;
  color: #111827;
}
.page-episode-html-fallback__subtitle {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.7;
  color: #475569;
}
.page-episode-html-fallback__pulse-row {
  display: flex;
  gap: 8px;
  margin-top: 18px;
}
.page-episode-html-fallback__pulse {
  width: 34px;
  height: 10px;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.42);
  transform-origin: center;
  transform: scaleY(0.58);
  transition: transform 180ms ease, opacity 180ms ease, background 180ms ease;
}
.page-episode-html-fallback__pulse[data-active="true"] {
  background: var(--page-episode-accent);
  opacity: 1;
  transform: scaleY(1);
}
.page-episode-html-fallback__pulse[data-active="false"] {
  opacity: 0.46;
}
.page-episode-html-fallback__status {
  margin-top: 18px;
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}
.page-episode-html-fallback__detail {
  margin: 10px 0 0;
  font-size: 14px;
  line-height: 1.72;
  color: #334155;
  white-space: pre-wrap;
}
.page-episode-html-fallback__actions {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}
.page-episode-html-fallback__button {
  flex: 1;
  min-height: 44px;
  border: none;
  border-radius: 16px;
  cursor: pointer;
  transition: transform 160ms ease, box-shadow 160ms ease, background 160ms ease;
}
.page-episode-html-fallback__button:hover {
  transform: translateY(-1px);
}
.page-episode-html-fallback__button--primary {
  background: var(--page-episode-accent);
  color: #fff7ed;
  box-shadow: 0 16px 28px rgba(232, 106, 51, 0.24);
}
.page-episode-html-fallback__button--secondary {
  background: rgba(15, 23, 42, 0.06);
  color: #0f172a;
}
  `.trim();
}

function buildRuntimeScript(options: BuildCustomPageEpisodeSrcDocOptions, fallbackHint?: string): string {
  const copy = resolveFallbackCopy(options, fallbackHint);
  const payload = {
    pageType: options.pageType,
    fallbackMarkup: buildFallbackMarkup(options, fallbackHint),
    phases: copy.phases,
  };

  return `
(() => {
  const payload = ${toScriptLiteral(payload)};
  let noteTimer = 0;

  function showStatusNote(message) {
    if (!(document.body instanceof HTMLElement)) {
      return;
    }

    let note = document.querySelector('[data-codex-page-status="true"]');
    if (!(note instanceof HTMLElement)) {
      note = document.createElement('div');
      note.className = 'page-episode-html-status';
      note.dataset.codexPageStatus = 'true';
      document.body.appendChild(note);
    }

    note.textContent = message;
    note.setAttribute('data-visible', 'true');
    if (noteTimer) {
      window.clearTimeout(noteTimer);
    }
    noteTimer = window.setTimeout(() => {
      note.setAttribute('data-visible', 'false');
    }, 2200);
  }

  function getFallbackRoot() {
    const root = document.querySelector('[data-codex-html-fallback="true"]');
    return root instanceof HTMLElement ? root : null;
  }

  function hasMeaningfulContent() {
    if (!(document.body instanceof HTMLElement)) {
      return false;
    }

    const meaningfulChildren = Array.from(document.body.children).filter((node) => {
      if (!(node instanceof HTMLElement)) {
        return false;
      }
      if (node.hasAttribute('data-codex-page-status')) {
        return false;
      }
      if (node.hasAttribute('data-codex-html-fallback')) {
        return false;
      }
      const tagName = node.tagName.toLowerCase();
      return tagName !== 'script' && tagName !== 'style';
    });

    if (meaningfulChildren.length === 0) {
      return false;
    }

    const bodyText = meaningfulChildren
      .map((node) => node.textContent || '')
      .join(' ')
      .replace(/\\s+/g, '')
      .trim();

    if (bodyText.length >= 18) {
      return true;
    }

    const structuredSelector = 'canvas,svg,img,video,button,input,textarea,select,[role="button"],a[href],main,section,article,p,h1,h2,h3,h4,h5,h6';
    return meaningfulChildren.some((node) => node.matches(structuredSelector) || !!node.querySelector(structuredSelector));
  }

  function bindFallback(root) {
    if (!(root instanceof HTMLElement) || root.dataset.codexHtmlBound === 'true') {
      return;
    }

    root.dataset.codexHtmlBound = 'true';

    const pulses = Array.from(root.querySelectorAll('[data-codex-html-fallback-pulse]'));
    const statusNode = root.querySelector('[data-codex-html-fallback-status]');
    const detailNode = root.querySelector('[data-codex-html-fallback-detail]');
    const primaryButton = root.querySelector('[data-codex-html-action="primary"]');
    const secondaryButton = root.querySelector('[data-codex-html-action="secondary"]');

    let phaseIndex = Number.parseInt(root.dataset.phaseIndex || '0', 10);
    if (!Number.isFinite(phaseIndex)) {
      phaseIndex = 0;
    }
    let direction = 1;

    const render = () => {
      const safeIndex = ((phaseIndex % payload.phases.length) + payload.phases.length) % payload.phases.length;
      const phase = payload.phases[safeIndex];
      root.dataset.phaseIndex = String(safeIndex);
      root.style.setProperty('--page-episode-accent', phase.accent);
      if (statusNode instanceof HTMLElement) {
        statusNode.textContent = phase.status;
      }
      if (detailNode instanceof HTMLElement) {
        detailNode.textContent = phase.detail;
      }
      pulses.forEach((pulse, index) => {
        if (pulse instanceof HTMLElement) {
          pulse.setAttribute('data-active', index <= safeIndex ? 'true' : 'false');
        }
      });
    };

    if (primaryButton instanceof HTMLElement) {
      primaryButton.addEventListener('click', () => {
        phaseIndex += 1;
        render();
      });
    }

    if (secondaryButton instanceof HTMLElement) {
      secondaryButton.addEventListener('click', () => {
        phaseIndex += direction;
        if (phaseIndex >= payload.phases.length - 1 || phaseIndex <= 0) {
          direction *= -1;
        }
        render();
      });
    }

    render();
  }

  function ensureFallback() {
    if (!(document.body instanceof HTMLElement)) {
      return;
    }

    let root = getFallbackRoot();
    if (!root) {
      const host = document.createElement('div');
      host.innerHTML = payload.fallbackMarkup;
      root = host.firstElementChild instanceof HTMLElement ? host.firstElementChild : null;
      if (root) {
        document.body.appendChild(root);
      }
    }

    if (root) {
      bindFallback(root);
    }
  }

  function scheduleContentCheck(delayMs) {
    window.setTimeout(() => {
      if (hasMeaningfulContent()) {
        const existingFallback = getFallbackRoot();
        if (existingFallback) {
          bindFallback(existingFallback);
        }
        return;
      }

      ensureFallback();
    }, delayMs);
  }

  function boot() {
    if (!(document.body instanceof HTMLElement)) {
      return;
    }
    document.body.dataset.pageEpisodeKind = payload.pageType;
    const existingFallback = getFallbackRoot();
    if (existingFallback) {
      bindFallback(existingFallback);
    }
    scheduleContentCheck(120);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }

  window.addEventListener('load', () => scheduleContentCheck(40), { once: true });
  window.addEventListener('error', () => {
    showStatusNote('这页的脚本刚闪了一下，先保留已经出现的内容。');
    scheduleContentCheck(30);
  });
  window.addEventListener('unhandledrejection', () => {
    showStatusNote('这页的脚本没跑完，先把能看到的内容留住。');
    scheduleContentCheck(30);
  });
})();
  `.trim();
}

function buildHtmlDocument(
  options: BuildCustomPageEpisodeSrcDocOptions,
  params: {
    title: string;
    headContent: string;
    bodyContent: string;
    htmlAttributes?: string;
    bodyAttributes?: string;
    fallbackHint?: string;
  },
): string {
  const normalizedHeadContent = params.headContent.trim();
  const titleMarkup = TITLE_TAG_REGEX.test(normalizedHeadContent)
    ? ''
    : `    <title>${escapeHtml(params.title)}</title>`;
  const charsetMarkup = CHARSET_META_REGEX.test(normalizedHeadContent)
    ? ''
    : '    <meta charset="utf-8" />';
  const viewportMarkup = VIEWPORT_META_REGEX.test(normalizedHeadContent)
    ? ''
    : '    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />';

  return `
<!doctype html>
<html${formatHtmlAttributes(params.htmlAttributes || '', 'zh-CN')}>
  <head>
${charsetMarkup ? `${charsetMarkup}\n` : ''}${viewportMarkup ? `${viewportMarkup}\n` : ''}${titleMarkup ? `${titleMarkup}\n` : ''}    <style id="page-episode-html-base">
${buildBaseStyle()}
    </style>
    <script id="page-episode-html-runtime">
${buildRuntimeScript(options, params.fallbackHint)}
    </script>
${normalizedHeadContent ? `    ${normalizedHeadContent}\n` : ''}  </head>
  <body${formatOptionalAttributes(params.bodyAttributes || '')}>
${params.bodyContent ? `    ${params.bodyContent}\n` : ''}  </body>
</html>
  `.trim();
}

export function normalizePageEpisodeHtmlDocument(value: unknown): string {
  if (typeof value !== 'string') {
    return '';
  }

  let normalized = stripHtmlCodeFence(value.trim());
  if (!normalized) {
    return '';
  }

  if (HTML_ENTITY_TAG_REGEX.test(normalized) && !/<[a-z!/]/i.test(normalized)) {
    normalized = decodeHtmlEntities(normalized);
  }

  return normalized.trim();
}

export function buildCustomPageEpisodeSrcDoc(options: BuildCustomPageEpisodeSrcDocOptions): string {
  const normalizedHtml = normalizePageEpisodeHtmlDocument(options.htmlDocument);
  const fallbackHint = normalizedHtml && !HTML_TAG_REGEX.test(normalizedHtml) ? normalizedHtml : options.caption?.trim() || undefined;
  const resolvedTitle = options.title?.trim() || (options.pageType === 'micro_app' ? '互动小模块番外' : '自定义页面番外');

  if (!normalizedHtml || !HTML_TAG_REGEX.test(normalizedHtml)) {
    return buildHtmlDocument(options, {
      title: resolvedTitle,
      headContent: '',
      bodyContent: buildFallbackMarkup(options, fallbackHint),
      fallbackHint,
    });
  }

  const headContent = extractTagContent(normalizedHtml, 'head');
  const bodyAttributes = extractOpeningTagAttributes(normalizedHtml, 'body');
  const htmlAttributes = extractOpeningTagAttributes(normalizedHtml, 'html');

  let bodyContent = extractTagContent(normalizedHtml, 'body');
  if (!bodyContent) {
    const strippedDocument = stripDocumentChrome(normalizedHtml);
    bodyContent = removeTagBlock(strippedDocument, 'head').trim();
  }

  return buildHtmlDocument(options, {
    title: resolvedTitle,
    headContent,
    bodyContent: bodyContent || buildFallbackMarkup(options, fallbackHint),
    htmlAttributes,
    bodyAttributes,
    fallbackHint,
  });
}
