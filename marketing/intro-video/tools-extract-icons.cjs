// One-off: pull the lucide icon node definitions the app uses into icons.js
const fs = require('fs');
const path = require('path');
const dir = path.join(__dirname, '../../production-version/node_modules/lucide-react-native/dist/esm/icons');
const want = ['calendar','dollar-sign','timer','monitor','wrench','clock','bell','plus','house','user','search',
  'circle-check-big','circle-check','zap','chevron-right','chevron-left','chevron-down','building-2','camera','paperclip',
  'arrow-right','user-check','languages','globe','file-text','file-spreadsheet','mail','image','receipt','check',
  'sparkles','database','server','refresh-cw','wifi','star','x','shield-check','plug-zap','link','file','inbox','moon','sun','briefcase','arrow-left-right','message-square'];
const out = {};
for (const name of want) {
  const f = path.join(dir, name + '.js');
  if (!fs.existsSync(f)) { console.error('missing', name); continue; }
  const src = fs.readFileSync(f, 'utf8');
  const m = src.match(/createLucideIcon\("[^"]+",\s*(\[[\s\S]*?\])\);/);
  const nodes = Function('return ' + m[1])();
  out[name] = nodes.map(([tag, attrs]) => {
    const a = Object.entries(attrs).filter(([k]) => k !== 'key').map(([k, v]) => `${k}="${v}"`).join(' ');
    return `<${tag} ${a}/>`;
  }).join('');
}
fs.writeFileSync(path.join(__dirname, 'icons.js'),
  '// Lucide icons (ISC license) extracted from lucide-react-native v0.553.0 — same set the app uses.\nwindow.ICONS = ' + JSON.stringify(out, null, 1) + ';\n');
console.log(Object.keys(out).length, 'icons');
