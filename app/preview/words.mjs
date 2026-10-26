// The frontend's TestNoMacOnlyWordsElsewhere (internal/host/words_test.go):
// every string, template, and JSX text in web/src, and the text of
// web/dist/index.html, says a Mac word only in a Mac branch (isMac,
// os === 'mac', a host that starts with 'macOS'), or in text that names
// each system, listed in allowed with why. Run by make frontend-check.
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ts = createRequire(import.meta.url)('typescript');
const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

// The same list as internal/host/words_test.go's macWords.
const macWords = ['menu bar', 'Finder', 'this Mac', 'This Mac', 'OrbStack', 'Dock icon', '⌘'];

const allowed = [
  { file: 'web/src/settings/Appearance.tsx', text: 'the system tray on Windows and Linux', why: 'names each system' },
  { file: 'web/src/app.ts', text: 'This Mac', exact: true, why: ".env.example's section, which the app renames for each system (thisMachine)" },
];

// A condition that holds only on a Mac (and not its opposite, !isMac).
const macTest = /\bisMac\b|=== 'mac'|startsWith\('macOS'\)|'MacIntel'/;
const onMac = (e) => macTest.test(e.getText()) && !ts.isPrefixUnaryExpression(e);

function inMacBranch(node) {
  for (let child = node, p = node.parent; p; child = p, p = p.parent) {
    if (ts.isConditionalExpression(p) && child === p.whenTrue && onMac(p.condition)) return true;
    if (ts.isIfStatement(p) && child === p.thenStatement && onMac(p.expression)) return true;
    if (ts.isBinaryExpression(p) && p.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken && child === p.right && onMac(p.left)) return true;
  }
  return false;
}

const problems = [];
function say(rel, line, text, w) {
  if (allowed.some((a) => a.file === rel && (a.exact ? text === a.text : text.includes(a.text)))) return;
  const at = text.indexOf(w);
  problems.push(`${rel}:${line}: …${text.slice(Math.max(0, at - 40), at + w.length + 40)}… says "${w}" outside Mac-only code; use the system's own word, or add it to allowed in app/preview/words.mjs with why`);
}

const files = readdirSync(join(root, 'web', 'src'), { recursive: true }).filter((f) => /\.tsx?$/.test(f)).map((f) => join(root, 'web', 'src', f));
for (const path of files) {
  const rel = relative(root, path).split('\\').join('/');
  const src = ts.createSourceFile(path, readFileSync(path, 'utf8'), ts.ScriptTarget.Latest, true, path.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const visit = (node) => {
    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node) || ts.isJsxText(node)) {
      for (const w of macWords) {
        if (node.text.includes(w) && !inMacBranch(node)) say(rel, src.getLineAndCharacterOfPosition(node.getStart()).line + 1, node.text, w);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(src);
}

// The page itself: its text and attributes, without comments and scripts.
const html = readFileSync(join(root, 'web', 'dist', 'index.html'), 'utf8').replace(/<!--[\s\S]*?-->/g, '').replace(/<(script|style)[\s\S]*?<\/\1>/g, '');
html.split('\n').forEach((line, i) => {
  for (const w of macWords) if (line.includes(w)) say('web/dist/index.html', i + 1, line.trim(), w);
});

if (problems.length) {
  console.error(problems.join('\n'));
  process.exit(1);
}
console.log(`frontend words ok: ${files.length} files and index.html say Mac words only on a Mac`);
