import fs from "fs";
import path from "path";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const neteaseApi = require("@neteasecloudmusicapienhanced/api");

const SESSION_FILE = path.resolve(process.cwd(), ".netease-auth.json");

type StoredNeteaseSession = {
  cookie: string;
  updatedAt: number;
  source: "qr";
};

type NeteaseLoginProfile = {
  userId: string;
  nickname: string;
  avatarUrl?: string;
};

export type NeteaseAuthStatus = {
  loggedIn: boolean;
  source: "none" | "env" | "qr";
  profile: NeteaseLoginProfile | null;
  vipType: number;
  isVip: boolean;
  hasCookie: boolean;
};

type AuthenticatedSongUrlResult = {
  url: string | null;
  freeTrialInfo: unknown;
  level?: string;
  type?: string;
};

function readSessionFile(): StoredNeteaseSession | null {
  try {
    if (!fs.existsSync(SESSION_FILE)) {
      return null;
    }
    const raw = fs.readFileSync(SESSION_FILE, "utf-8");
    if (!raw.trim()) return null;
    const parsed = JSON.parse(raw) as StoredNeteaseSession;
    return parsed?.cookie ? parsed : null;
  } catch (error) {
    console.warn("[neteaseAuth] Failed to read local auth session", error);
    return null;
  }
}

function writeSessionFile(session: StoredNeteaseSession): void {
  fs.writeFileSync(SESSION_FILE, JSON.stringify(session, null, 2), "utf-8");
}

function normalizeCookieString(cookie: string | null | undefined): string {
  if (!cookie) return "";
  const trimmed = cookie.trim();
  if (!trimmed) return "";
  return trimmed.includes("os=") ? trimmed : `${trimmed}; os=pc`;
}

function resolveEffectiveCookie(): { cookie: string; source: "env" | "qr" } | null {
  const envCookie = normalizeCookieString(process.env.NETEASE_COOKIE);
  if (envCookie) {
    return { cookie: envCookie, source: "env" };
  }

  const session = readSessionFile();
  if (session?.cookie) {
    return {
      cookie: normalizeCookieString(session.cookie),
      source: session.source,
    };
  }

  return null;
}

function normalizeAuthStatusBody(source: "none" | "env" | "qr", body?: any): NeteaseAuthStatus {
  const account = body?.data?.account || body?.account || {};
  const profile = body?.data?.profile || body?.profile || {};
  const userId = String(account.id || profile.userId || profile.userIdStr || "").trim();
  const vipType = Number(account.vipType || profile.vipType || 0) || 0;
  const isVip = vipType > 0 || Number(profile.redVipLevel || 0) > 0;

  return {
    loggedIn: Boolean(userId),
    source: userId ? source : "none",
    profile: userId
      ? {
          userId,
          nickname: String(profile.nickname || profile.userName || "网易云用户"),
          avatarUrl: typeof profile.avatarUrl === "string" ? profile.avatarUrl : undefined,
        }
      : null,
    vipType,
    isVip,
    hasCookie: source !== "none",
  };
}

async function fetchLoginStatusWithCookie(cookie: string, source: "env" | "qr"): Promise<NeteaseAuthStatus> {
  const response = await neteaseApi.login_status({
    cookie,
    timestamp: Date.now(),
  });
  return normalizeAuthStatusBody(source, response?.body);
}

export async function getNeteaseAuthStatus(): Promise<NeteaseAuthStatus> {
  const effective = resolveEffectiveCookie();
  if (!effective) {
    return {
      loggedIn: false,
      source: "none",
      profile: null,
      vipType: 0,
      isVip: false,
      hasCookie: false,
    };
  }

  try {
    const status = await fetchLoginStatusWithCookie(effective.cookie, effective.source);
    if (!status.loggedIn && effective.source === "qr") {
      clearNeteaseAuthSession();
    }
    return status;
  } catch (error) {
    console.warn("[neteaseAuth] Failed to fetch login status", error);
    if (effective.source === "qr") {
      clearNeteaseAuthSession();
    }
    return {
      loggedIn: false,
      source: "none",
      profile: null,
      vipType: 0,
      isVip: false,
      hasCookie: false,
    };
  }
}

export function clearNeteaseAuthSession(): void {
  try {
    if (fs.existsSync(SESSION_FILE)) {
      fs.unlinkSync(SESSION_FILE);
    }
  } catch (error) {
    console.warn("[neteaseAuth] Failed to clear local auth session", error);
  }
}

export async function createNeteaseQrLoginKey() {
  const response = await neteaseApi.login_qr_key({
    timestamp: Date.now(),
  });
  const key = response?.body?.data?.unikey || response?.body?.data?.key;
  return {
    key: String(key || ""),
    raw: response?.body,
  };
}

export async function createNeteaseQrLoginImage(key: string) {
  const response = await neteaseApi.login_qr_create({
    key,
    qrimg: true,
    timestamp: Date.now(),
  });

  return {
    qrUrl: String(response?.body?.data?.qrurl || ""),
    qrImage: String(response?.body?.data?.qrimg || ""),
    raw: response?.body,
  };
}

export async function checkNeteaseQrLogin(key: string) {
  const response = await neteaseApi.login_qr_check({
    key,
    timestamp: Date.now(),
  });

  const code = Number(response?.body?.code || 0);
  const cookie = normalizeCookieString(response?.body?.cookie || "");

  if (code === 803 && cookie) {
    writeSessionFile({
      cookie,
      updatedAt: Date.now(),
      source: "qr",
    });
  }

  const authStatus = await getNeteaseAuthStatus();
  return {
    code,
    cookieStored: code === 803 && Boolean(cookie),
    authStatus,
    raw: response?.body,
  };
}

export async function resolveAuthenticatedSongUrl(id: string | number): Promise<AuthenticatedSongUrlResult | null> {
  const effective = resolveEffectiveCookie();
  if (!effective) return null;

  try {
    const response = await neteaseApi.song_url_v1({
      id: String(id),
      level: "exhigh",
      cookie: effective.cookie,
      timestamp: Date.now(),
    });

    const songData = Array.isArray(response?.body?.data) ? response.body.data[0] : null;
    if (!songData) {
      return null;
    }

    return {
      url: typeof songData.url === "string" ? songData.url : null,
      freeTrialInfo: songData.freeTrialInfo,
      level: typeof songData.level === "string" ? songData.level : undefined,
      type: typeof songData.type === "string" ? songData.type : undefined,
    };
  } catch (error) {
    console.warn("[neteaseAuth] Failed to resolve authenticated song url", error);
    return null;
  }
}

export async function getAuthenticatedUserPlaylists(uid: string, limit: number, offset: number) {
  const effective = resolveEffectiveCookie();
  if (!effective) return null;

  try {
    const response = await neteaseApi.user_playlist({
      uid,
      limit,
      offset,
      cookie: effective.cookie,
      timestamp: Date.now(),
    });
    return response?.body || null;
  } catch (error) {
    console.warn("[neteaseAuth] Failed to fetch authenticated user playlists", error);
    return null;
  }
}

export async function getAuthenticatedPlaylistDetail(id: string) {
  const effective = resolveEffectiveCookie();
  if (!effective) return null;

  try {
    const [detailResponse, tracksResponse] = await Promise.all([
      neteaseApi.playlist_detail({
        id,
        cookie: effective.cookie,
        timestamp: Date.now(),
      }),
      neteaseApi.playlist_track_all({
        id,
        limit: 1000,
        offset: 0,
        cookie: effective.cookie,
        timestamp: Date.now(),
      }),
    ]);

    const detailBody = detailResponse?.body || {};
    const playlist = detailBody.playlist || detailBody.result;
    if (!playlist) {
      return null;
    }

    const trackBody = tracksResponse?.body || {};
    const tracks = trackBody.songs || trackBody.songsData || trackBody.data || [];

    return {
      ...detailBody,
      playlist: detailBody.playlist
        ? {
            ...playlist,
            tracks,
          }
        : undefined,
      result: detailBody.result
        ? {
            ...playlist,
            tracks,
          }
        : undefined,
    };
  } catch (error) {
    console.warn("[neteaseAuth] Failed to fetch authenticated playlist detail", error);
    return null;
  }
}
