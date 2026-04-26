# Bloom WeChat + OpenClaw Cloudflare Deploy

This project can run without a traditional server by using:

- Cloudflare Pages for the web app and Functions APIs
- One Durable Object Worker for WeChat bridge state

## 1. Install dependencies

```bash
npm install
```

## 2. Deploy the Durable Object worker

This creates the always-on stateful backend used by the WeChat bridge.

```bash
npm run cf:deploy:do
```

After deploy, keep the worker name:

- `bloom-wechat-bridge-do`

## 3. Create or verify the Pages project

Project name expected by this repo:

- `bloom-pages`

Build output:

- `dist`

## 4. Bind the Durable Object to Pages

The repo already expects this binding in `wrangler.toml`:

- binding name: `WECHAT_BRIDGE_DO`
- class: `WechatBridgeDurableObject`
- script: `bloom-wechat-bridge-do`

If you configure Pages in the dashboard, add the same Durable Object binding there too.

## 5. Set Pages environment variables

Recommended variable:

- `OPENCLAW_WECHAT_CONNECT_URL`

Behavior:

- If set, Bloom role QR codes point to this OpenClaw connect URL
- Bloom appends `token`, `bloomUserId`, `characterId`, and `callbackUrl`
- If not set, Bloom falls back to its own `/wechat/bind` page

## 6. Deploy Pages

```bash
npm run cf:deploy:pages
```

## 7. Use these live callback URLs

Replace `<your-pages-domain>` with your deployed domain.

OpenClaw connect success callback:

```text
POST https://<your-pages-domain>/api/wechat/openclaw/connect-callback
```

Inbound ClawBot message callback:

```text
POST https://<your-pages-domain>/api/wechat/clawbot/callback
```

## 8. Minimal OpenClaw connect callback payload

Bloom accepts a flexible payload. The minimal shape is:

```json
{
  "token": "wxbind_xxx",
  "wechatIdentity": "wx_xxx",
  "channelPeerId": "peer_xxx",
  "channelAccountId": "acct_xxx",
  "openClawPairingId": "pair_xxx",
  "displayName": "User Name",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

Required:

- `token`
- at least one of:
  - `conversationId`
  - `wechatIdentity`
  - `channelPeerId`
  - `channelAccountId`

## 9. Smoke test

After deploy:

1. Open Bloom
2. Open a role
3. Tap WeChat connect
4. Confirm the QR is generated
5. Confirm callback URL in the QR flow points back to your Pages domain
6. Send a test POST to `/api/wechat/openclaw/connect-callback`
7. Confirm the role binding appears
8. Send a test POST to `/api/wechat/clawbot/callback`
9. Confirm the message is accepted and routed

## 10. Helpful local commands

Local app server:

```bash
npm run dev
```

Local Pages preview:

```bash
npm run cf:dev:pages
```
