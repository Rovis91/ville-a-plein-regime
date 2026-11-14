// Banc rapide : la même mesure que outils/banc.js (outils/perf.js, ?perf&seule), carte par carte, mais dans UN Chrome gardé ouvert entre deux appels
// (lancé au premier appel hors de l'écran, son coupé mais calculé, mêmes drapeaux que banc.js ; chaque mesure ouvre un onglet puis le ferme).
//   node outils/banc-rapide.js            → toutes les cartes          node outils/banc-rapide.js paris canal → ces cartes
// Pour comparer deux versions : les mesurer l'une après l'autre (les millisecondes varient avec l'état de la machine). Le Chrome reste ouvert : le fermer à la main à la fin.
// Code de sortie 0 = tout passe. Variables : CHROME, PORT (8851), DBG (9400, port de débogage du Chrome gardé).
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), http = require('http'), os = require('os');
const RACINE = path.join(__dirname, '..'), PORT = +process.env.PORT || 8851, DBG = +process.env.DBG || 9400;
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(f => fs.existsSync(f));
const req = (u, m = 'GET') => new Promise((r, j) => { const q = http.request(u, { method: m }, res => { let d = ''; res.on('data', c => d += c); res.on('end', () => r(d)); }); q.on('error', j); q.end(); });
const dort = ms => new Promise(r => setTimeout(r, ms)), repond = async u => { try { await req(u); return true; } catch { return false; } };
const attends = async (u, n) => { for (let i = 0; i < n; i++) { if (await repond(u)) return true; await dort(250); } return false; };
const ids = fs.readFileSync(path.join(RACINE, 'cartes.js'), 'utf8').match(/\{ id: '(\w+)'/g).map(s => s.slice(7, -1)), cartes = process.argv.slice(2).length ? process.argv.slice(2) : ids;
(async () => {
  if (!(await repond('http://127.0.0.1:' + PORT + '/index.html'))) { spawn('python', [path.join('outils', 'capture.py'), String(PORT)], { cwd: RACINE, stdio: 'ignore', detached: true }).unref(); await attends('http://127.0.0.1:' + PORT + '/index.html', 40); }
  if (!(await repond('http://127.0.0.1:' + DBG + '/json/version'))) {
    spawn(CHROME, ['--no-first-run', '--remote-debugging-port=' + DBG, '--user-data-dir=' + path.join(os.tmpdir(), 'vpr-banc-rapide'), '--window-position=-2600,0', '--window-size=1280,720', '--ignore-gpu-blocklist',
      '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion',
      '--autoplay-policy=no-user-gesture-required', '--mute-audio', 'about:blank'], { stdio: 'ignore', detached: true }).unref();
    if (!(await attends('http://127.0.0.1:' + DBG + '/json/version', 40))) { console.log('ÉCHEC : Chrome ne répond pas'); process.exit(2); }
  }
  const t = JSON.parse(await req('http://127.0.0.1:' + DBG + '/json/new?about:blank', 'PUT')), ws = new WebSocket(t.webSocketDebuggerUrl); let id = 0; const att = new Map();
  ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && att.has(m.id)) { att.get(m.id)(m.result); att.delete(m.id); } else if (m.method === 'Runtime.exceptionThrown') console.log('  erreur :', ((m.params.exceptionDetails.exception || {}).description || '').split('\n')[0]); };
  await new Promise(r => ws.onopen = r); const cmd = (method, params = {}) => new Promise(r => { const i = ++id; att.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await cmd('Runtime.enable'); await cmd('Page.bringToFront');
  const sortie = path.join(RACINE, 'captures', 'perf.json'); let ok = 0;
  for (const c of cartes) {
    let r = null, B = null;
    for (let essai = 0; essai < 2 && !r; essai++) { // un script parfois perdu par le petit serveur local : la carte ne se charge pas, on recharge une fois
      fs.rmSync(sortie, { force: true }); await cmd('Page.navigate', { url: 'http://127.0.0.1:' + PORT + '/index.html?perf&auto&joueurs=1&seule&carte=' + c });
      for (let i = 0; i < 240 && !fs.existsSync(sortie); i++) await dort(500);
      if (fs.existsSync(sortie)) { await dort(200); ({ budget: B, resultats: [r] } = JSON.parse(fs.readFileSync(sortie, 'utf8'))); }
    }
    if (!r) { console.log(c.padEnd(8), 'PAS DE RÉSULTAT'); continue; }
    const bon = r.ms <= B.ms && r.cpuMax <= B.cpuMax; ok += bon;
    console.log(c.padEnd(8), (r.ms.toFixed(2) + ' ms' + (r.ms > B.ms ? ' ✗' : '')).padEnd(11), ('pire ' + r.cpuMax.toFixed(1) + (r.cpuMax > B.cpuMax ? ' ✗' : '')).padEnd(12), (bon ? 'SUCCÈS' : 'ÉCHEC').padEnd(8), r.piresCpu.slice(0, 2).join(' | '));
  }
  console.log('\n' + ok + '/' + cartes.length + ' cartes dans la référence'); ws.close(); await req('http://127.0.0.1:' + DBG + '/json/close/' + t.id).catch(() => { }); process.exit(ok === cartes.length ? 0 : 1);
})();
