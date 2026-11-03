import type { Issue, IssueLevel } from '../../src/content/types';

export class Issues {
  readonly list: Issue[] = [];
  add(level: IssueLevel, file: string, message: string, line?: number): void {
    this.list.push({ level, file, message, line });
  }
  error(file: string, message: string, line?: number): void {
    this.add('error', file, message, line);
  }
  warn(file: string, message: string, line?: number): void {
    this.add('warning', file, message, line);
  }
  get errors(): Issue[] {
    return this.list.filter((i) => i.level === 'error');
  }
  get warnings(): Issue[] {
    return this.list.filter((i) => i.level === 'warning');
  }
}

/** Prints file · line · level · message as an aligned table. */
export function printTable(issues: Issue[]): void {
  if (issues.length === 0) return;
  const rows = issues.map((i) => [i.file, i.line ? String(i.line) : '', i.level, i.message]);
  const widths = [0, 0, 0].map((_, c) => Math.max(...rows.map((r) => r[c]!.length), 4));
  for (const r of rows) {
    const cells = r.slice(0, 3).map((cell, c) => cell.padEnd(widths[c]!));
    console.log(`${cells.join('  ')}  ${r[3]}`);
  }
}

/** Markdown table for a PR comment (--github). */
export function markdownTable(issues: Issue[]): string {
  const head = '| file | line | level | message |\n|---|---|---|---|\n';
  const body = issues
    .map((i) => `| \`${i.file}\` | ${i.line ?? ''} | ${i.level === 'error' ? '❌ error' : '⚠️ warning'} | ${i.message.replace(/\|/g, '\\|')} |`)
    .join('\n');
  return head + body;
}
