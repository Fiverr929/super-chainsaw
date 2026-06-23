import path from 'path';

export function resolvePublicAssetPath(fileUrl: string, cwd = process.cwd()): string | null {
  if (fileUrl.startsWith('http://') || fileUrl.startsWith('https://') || fileUrl.startsWith('data:')) return null;

  const relativePath = fileUrl.replace(/^[/\\]+/, '');
  if (!relativePath || relativePath.split(/[\\/]+/).includes('..')) return null;

  return path.join(/*turbopackIgnore: true*/ cwd, 'public', relativePath);
}