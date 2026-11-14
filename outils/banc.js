// Banc de performance en une commande : node outils/banc.js            → toutes les cartes
//                                       node outils/banc.js canal      → une carte
//                                       node outils/banc.js --joueurs=2 → écran partagé    --sans-ecran → Chrome sans fenêtre (chiffres plus lents sous Windows)
// Lance le serveur (outils/capture.py) s'il ne tourne pas, ouvre le jeu dans une fenêtre Chrome (?perf, voir outils/perf.js ; ne pas la masquer pendant la mesure), attend captures/perf.json,
// puis dit SUCCÈS ou ÉCHEC par carte sur deux chiffres : le temps moyen d'une image (ms, GPU compris) et la pire image (cpuMax), contre BUDGET de perf.js.
// Code de sortie 0 = tout passe, 1 = au moins une carte échoue, 2 = le banc n'a pas pu tourner. Variables : CHROME (chemin du navigateur), PORT (8851).
const { spawn } = require('child_process'), fs = require('fs'), path = require('path'), http = require('http');
const RACINE = path.join(__dirname, '..'), PORT = +process.env.PORT || 8851;
const CHROME = process.env.CHROME || ['C:/Program Files/Google/Chrome/Application/chrome.exe', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome'].find(f => fs.existsSync(f));
const args = process.argv.slice(2), carte = args.find(a => !a.startsWith('--')), deux = args.includes('--joueurs=2'), d = deux ? '2' : '';
const sortie = path.join(RACINE, 'captures', 'perf' + d + '.json'), fin = (code, msg) => { if (msg) console.log(msg); for (const p of enfants) p.kill(); process.exit(code); }, enfants = [];
const repond = () => new Promise(r => http.get('http://127.0.0.1:' + PORT + '/index.html', res => { res.resume(); r(res.statusCode === 200); }).on('error', () => r(false)));
const attends = async (test, s) => { for (let i = 0; i < s * 2; i++) { if (await test()) return true; await new Promise(r => setTimeout(r, 500)); } return false; };

(async () => {
  if (!CHROME) fin(2, 'ÉCHEC : Chrome introuvable (variable CHROME=chemin du navigateur)');
  if (carte) { const ids = fs.readFileSync(path.join(RACINE, 'cartes.js'), 'utf8').match(/\{ id: '(\w+)'/g).map(s => s.slice(7, -1)); if (!ids.includes(carte)) fin(2, 'ÉCHEC : carte inconnue « ' + carte + ' » (cartes : ' + ids.join(', ') + ')'); }
  if (!(await repond())) { enfants.push(spawn('python', [path.join('outils', 'capture.py'), String(PORT)], { cwd: RACINE, stdio: 'ignore' })); if (!(await attends(repond, 10))) fin(2, 'ÉCHEC : le serveur ne démarre pas sur le port ' + PORT); }
  fs.rmSync(sortie, { force: true });
  const url = 'http://127.0.0.1:' + PORT + '/index.html?perf&auto&joueurs=' + (deux ? 2 : 1) + (carte ? '&seule&carte=' + carte : '');
  // une vraie fenêtre, au premier plan : sans écran, Windows bride le processus et le banc mesurait 2 à 3 fois plus lent que le jeu (--sans-ecran pour s'en passer, sur un serveur)
  enfants.push(spawn(CHROME, ['--no-first-run', '--user-data-dir=' + path.join(require('os').tmpdir(), 'vpr-banc-' + Date.now()), '--window-size=1280,720', '--ignore-gpu-blocklist', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--disable-backgrounding-occluded-windows', '--disable-features=CalculateNativeWinOcclusion', '--autoplay-policy=no-user-gesture-required', // le son tourne toujours, comme pour un joueur : il pèse lourd (voir README)
    ...(args.includes('--sans-ecran') ? ['--headless=new', url] : ['--app=' + url])], { stdio: 'ignore' }));
  console.log('Banc en cours : ' + (carte || 'toutes les cartes') + (deux ? ', écran partagé' : '') + ' (une minute environ pour toutes les cartes)…');
  if (!(await attends(() => fs.existsSync(sortie), carte ? 180 : 1500))) fin(2, 'ÉCHEC : pas de résultat (captures/perf' + d + '.json) dans le temps imparti');
  await new Promise(r => setTimeout(r, 300)); // l'écriture du fichier se termine
  const { budget: B, gpu, resultats } = JSON.parse(fs.readFileSync(sortie, 'utf8'));
  console.log('Carte graphique : ' + gpu + (/swiftshader|llvmpipe|software/i.test(gpu) ? '  ⚠ rendu logiciel : chiffres sans valeur' : ''));
  console.log('Référence : moyenne ≤ ' + B.ms + ' ms par image, pire image ≤ ' + B.cpuMax + ' ms\n');
  let ok = true; const col = (s, n) => String(s).padEnd(n);
  console.log(col('carte', 10) + col('moyenne', 12) + col('pire image', 13) + 'verdict');
  for (const r of resultats) {
    const bon = r.ms <= B.ms && r.cpuMax <= B.cpuMax; ok = ok && bon;
    console.log(col(r.carte, 10) + col(r.ms.toFixed(2) + ' ms' + (r.ms > B.ms ? ' ✗' : ''), 12) + col(r.cpuMax.toFixed(1) + ' ms' + (r.cpuMax > B.cpuMax ? ' ✗' : ''), 13) + (bon ? 'SUCCÈS' : 'ÉCHEC'));
  }
  fin(ok ? 0 : 1, '\n' + (ok ? 'SUCCÈS' : 'ÉCHEC') + ' : ' + resultats.filter(r => r.ms <= B.ms && r.cpuMax <= B.cpuMax).length + '/' + resultats.length + ' cartes dans la référence (détail : captures/perf' + d + '.json)');
})();
