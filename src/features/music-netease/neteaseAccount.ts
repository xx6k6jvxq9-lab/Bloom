export type NeteaseAccountBinding = {
  uid: string;
  profileUrl: string;
  linkedAt: number;
};

function extractDigits(value: string): string {
  const match = value.match(/(\d{5,})/);
  return match?.[1] || '';
}

export function parseNeteaseAccountInput(input: string): NeteaseAccountBinding | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const uid = extractDigits(trimmed);
  if (!uid) return null;

  return {
    uid,
    profileUrl: `https://music.163.com/#/user/home?id=${uid}`,
    linkedAt: Date.now(),
  };
}

export function getNeteaseLoginUrl(): string {
  return 'https://music.163.com/#/login';
}
