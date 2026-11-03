import path from 'node:path';

export interface BuildArgs {
  root: string;
  coursePath: string;
  levelsDir: string;
  outDir: string;
  github: boolean;
}

/** --course <file> --levels <dir> --out <dir> --github */
export function parseArgs(argv: string[]): BuildArgs {
  const root = process.cwd();
  const get = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  return {
    root,
    coursePath: path.resolve(root, get('--course') ?? 'course.yml'),
    levelsDir: path.resolve(root, get('--levels') ?? 'levels'),
    outDir: path.resolve(root, get('--out') ?? 'src/generated'),
    github: argv.includes('--github'),
  };
}
