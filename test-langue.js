// node test-langue.js : chaque texte affiché par l'interface a sa traduction anglaise dans langue.js.
// Les textes de l'interface sont écrits en capitales : toute chaîne littérale en capitales de game.js (ou en morceaux, à l'intérieur d'une chaîne `…${…}…`) passe par traduit() ;
// ôtées les expressions de EN, chaque mot qui reste doit être de MEME (identique dans les deux langues, ou pas du texte d'interface). Plus les noms, sous-titres et titres des cartes (cartes.js) et les niveaux (sim.js).
// Les titres français passés à titreCarte() ne s'affichent qu'en français : on vérifie seulement que leur carte est dans TITRE_EN.
const assert = require('assert'), fs = require('fs');
require('./langue.js'); require('./sim.js');
const MEME = new Set(['XYZ', 'YXZ', 'YZX', // ordres de rotation de three.js
  'SPEED', 'CITY', 'NOODLE', 'BAR', 'KENJI', 'REI', 'JUN', // enseignes du décor, noms des rivaux
  'RADIO', 'SOLO', 'REC', 'SHIFT', 'GO', 'AUTO', 'MODE', 'NITRO', 'RECORD', 'MENU', 'PAUSE', 'SCORE', 'PTS', 'KM', 'TUNNEL', 'BRONZE', 'NORMAL', 'ENGLISH', 'FRANCAIS', 'JOY', 'CON', 'IA', 'FM', 'SPEEDWAY', 'PARIS', 'KARASU', 'TOGE', 'WAN', 'BAYSHORE', 'CANAL', 'SIX', 'PRIX', 'GRAND', 'SILENCE',
  'ER', // shortcut: ordinal en morceaux (n + 'ER' / 'E'), que traduit() lit en entier ; à revoir si un « ER » isolé devient du texte
]);
const sans = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '');
const restes = s => (sans(s).replace(/(\d+)ER?(?![A-Z])/g, '$1').replace(EN_RX, ' ').match(/[A-Z]{2,}/g) || []).filter(w => !MEME.has(w)); // même ordre que traduit() : ordinaux, puis expressions
// chaînes littérales d'un source JS (commentaires sautés), morceaux fixes des gabarits `…` compris
const litteraux = src => {
  const out = []; let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (c === '/' && src[i + 1] === '/') { i = src.indexOf('\n', i); if (i < 0) break; continue; }
    if (c === '/' && src[i + 1] === '*') { i = src.indexOf('*/', i) + 2; continue; }
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1, s = '';
      while (j < src.length && src[j] !== c) {
        if (src[j] === '\\') { s += src[j + 1]; j += 2; continue; }
        if (c === '`' && src[j] === '$' && src[j + 1] === '{') { out.push(s); s = ''; let d = 1; j += 2; while (d) { if (src[j] === '{') d++; else if (src[j] === '}') d--; j++; } continue; }
        s += src[j++];
      }
      out.push(s); i = j + 1; continue;
    }
    if (c === '/' && /[=(,:;!&|?{}]\s*$/.test(src.slice(Math.max(0, i - 4), i))) { let j = i + 1; while (src[j] !== '/' || src[j - 1] === '\\') { if (src[j] === '[') while (src[j] !== ']') j++; j++; } i = j + 1; continue; } // regex littérale
    i++;
  }
  return out;
};
const texte = s => !/[a-z]/.test(s) && /[A-ZÀ-Ý]{2}/.test(s); // en capitales, au moins deux lettres d'affilée
const manques = [];
const jeu = fs.readFileSync(__dirname + '/game.js', 'utf8'), titres = [...jeu.matchAll(/titreCarte\('(\w+)', \[[^\]]*\]/g)];
assert(titres.length && titres.every(([, id]) => TITRE_EN[id]), 'titreCarte : carte sans titre anglais');
for (const f of ['game.js']) for (const s of litteraux(jeu.replace(/titreCarte\('(\w+)', \[[^\]]*\]/g, ''))) if (texte(s)) { const r = restes(s); if (r.length) manques.push(f + ' : « ' + s + ' » -> « ' + traduit(s, 'en') + ' » (' + r.join(', ') + ')'); }
for (const m of CARTES) for (const s of [m.nom, m.th.hud.sur[1], ...(TITRE_EN[m.id] ? [] : m.th.hud.titre)]) { const r = restes(s); if (r.length) manques.push('cartes.js ' + m.id + ' : « ' + s + ' » (' + r.join(', ') + ')'); }
for (const d of DIFF) { const r = restes(d.nom); if (r.length) manques.push('sim.js DIFF : « ' + d.nom + ' »'); }
assert.deepStrictEqual(manques, [], 'textes sans traduction anglaise (ajouter leur ligne dans EN de langue.js, ou le mot dans MEME s\'il se dit pareil) :\n' + manques.join('\n'));
// une expression de EN ne se traduit jamais au milieu d'un mot, et la table ne se mord pas la queue
assert.strictEqual(traduit('REJOUER', 'en'), 'RETRY'); assert.strictEqual(traduit('CARTES', 'fr'), 'CARTES');
assert.deepStrictEqual(titreCarte('ville', ['VILLE A', 'PLEIN REGIME'], 'en'), ['FULL THROTTLE', 'CITY']); assert.deepStrictEqual(titreCarte('touge', ['KARASU', 'TOGE'], 'en'), ['KARASU', 'TOGE']);
console.log('OK  langue : tous les textes en capitales de game.js, les cartes et les niveaux ont leur anglais');
