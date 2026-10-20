// 發布網頁：把 web/（原始檔）複製到 docs/（GitHub Pages 發布的資料夾）
//   node scripts/publish.mjs beta    → docs/beta/（只有開了「測試版」的手機會看到）
//   node scripts/publish.mjs stable  → docs/（兩個人都會看到；保留 docs/beta/）
// 複製完要 git commit + push 才會真的上線。
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dirname, '..');
const src = join(root, 'web');
const channel = process.argv[2];
if (!['beta', 'stable'].includes(channel)) {
  console.error('用法：node scripts/publish.mjs beta|stable');
  process.exit(1);
}

const dest = channel === 'beta' ? join(root, 'docs', 'beta') : join(root, 'docs');
mkdirSync(dest, { recursive: true });
// 先清掉舊檔（stable 時不能刪到 beta/）
for (const name of readdirSync(dest)) {
  if (channel === 'stable' && name === 'beta') continue;
  rmSync(join(dest, name), { recursive: true, force: true });
}
cpSync(src, dest, { recursive: true });
console.log(`已複製 web/ → ${channel === 'beta' ? 'docs/beta/' : 'docs/'}${existsSync(join(dest, 'index.html')) ? '' : '（找不到 index.html！）'}`);
