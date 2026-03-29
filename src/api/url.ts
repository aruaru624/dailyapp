const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || '';

export function apiUrl(path: string): string {
  return `${apiBaseUrl}${path}`;
}
