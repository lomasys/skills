#!/usr/bin/env node
// Mockup vs app: toma capturas y medidas de una pantalla en varios tamaños y temas, y compara dos pantallas.
// Sin dependencias. Node 18 o más nuevo. Usa el Chrome o Edge que ya tengas instalado (modo headless).
//
//   node capturas.mjs capturar --url URL --nombre registro --lado real   [opciones]
//   node capturas.mjs comparar <mockup.json> <real.json>                 [--salida archivo.json]
//   node capturas.mjs recortar --url URL --selector ".boton" --tamano celular [--tema oscuro] [--salida archivo.png]
//   node capturas.mjs colores  --imagen mockup.png --puntos "120,340;200,80" [--escala 2]
//
// Opciones de "capturar":
//   --url URL            http://localhost..., http://127.0.0.1... o file:///... (nada remoto, ver --permitir-remoto)
//   --nombre texto       nombre de la pantalla, para los archivos (por defecto "pantalla")
//   --lado texto         "mockup" o "real" (por defecto "real")
//   --tamanos lista      celular,tablet,escritorio (por defecto) o anchos: 390,768,1440
//   --temas lista        claro (por defecto) o claro,oscuro
//   --salida carpeta     por defecto mockup-vs-app/capturas
//   --esperar ms         espera extra después de cargar (por defecto 300)
//   --listo ".selector"  espera a que exista ese elemento (apps que cargan datos)
//   --oscuro-clase dark  además de prefers-color-scheme, pone esa clase en <html> en el tema oscuro
//   --oscuro-atributo data-theme=dark   igual, con un atributo
//   --cookie "n=v"       cookie para una pantalla con sesión (se puede repetir; solo local)
//   --navegador ruta     ruta de chrome.exe / msedge.exe / chromium si no lo encuentra solo
//   --permitir-remoto    solo si el usuario lo autorizó por escrito
//
// Archivos: <salida>/<nombre>__<lado>__<tamano>-<ancho>__<tema>.png  y  .json con las medidas.
import fs from 'node:fs';
import os from 'node:os';
import net from 'node:net';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, execFileSync } from 'node:child_process';

const TAMANOS = { celular: [390, 844], tablet: [768, 1024], escritorio: [1440, 900] };
const [, , accion, ...resto] = process.argv;

function opciones(args) {
  const o = { cookie: [], _: [] };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a.startsWith('--')) {
      const k = a.slice(2);
      const v = args[i + 1] !== undefined && !args[i + 1].startsWith('--') ? args[++i] : 'true';
      if (k === 'cookie') o.cookie.push(v); else o[k] = v;
    } else o._.push(a);
  }
  return o;
}
const espera = ms => new Promise(r => setTimeout(r, ms));
const guardar = (f, d) => { fs.mkdirSync(path.dirname(path.resolve(f)), { recursive: true }); fs.writeFileSync(f, typeof d === 'string' || Buffer.isBuffer(d) ? d : JSON.stringify(d, null, 2) + '\n'); };
const limpio = t => String(t).replace(/[^\w.-]+/g, '_');

// ---------- Solo local ----------
function revisarUrl(url, o) {
  const u = new URL(url);
  if (u.protocol === 'file:') return;
  const local = ['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(u.hostname) || u.hostname.endsWith('.localhost') || /^127\./.test(u.hostname);
  if (!local && o['permitir-remoto'] !== 'true') {
    throw new Error(`${u.hostname} no es local. Esta herramienta solo abre la app en tu máquina. Si el usuario lo autorizó por escrito, usa --permitir-remoto.`);
  }
}

function tamanos(lista = 'celular,tablet,escritorio') {
  return lista.split(',').map(s => s.trim()).filter(Boolean).map(t => {
    if (TAMANOS[t]) return { nombre: t, ancho: TAMANOS[t][0], alto: TAMANOS[t][1] };
    const n = Number(t);
    if (!n) throw new Error(`tamaño desconocido: ${t} (usa celular, tablet, escritorio o un ancho en px)`);
    const nombre = n < 600 ? 'celular' : n < 1100 ? 'tablet' : 'escritorio';
    return { nombre, ancho: n, alto: n < 600 ? 844 : n < 1100 ? 1024 : 900 };
  });
}
const temas = (lista = 'claro') => lista.split(',').map(s => s.trim()).filter(Boolean).map(t => {
  if (!['claro', 'oscuro'].includes(t)) throw new Error(`tema desconocido: ${t} (usa claro u oscuro)`);
  return t;
});

// ---------- Navegador ----------
function buscarNavegador(o) {
  const candidatos = [o.navegador, process.env.CHROME_PATH].filter(Boolean);
  if (process.platform === 'win32') {
    for (const base of [process.env['PROGRAMFILES'], process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA].filter(Boolean)) {
      candidatos.push(path.join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'), path.join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'));
    }
  } else if (process.platform === 'darwin') {
    candidatos.push('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge', '/Applications/Chromium.app/Contents/MacOS/Chromium');
  } else {
    for (const n of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser', 'microsoft-edge']) {
      try { candidatos.push(execFileSync('which', [n], { encoding: 'utf8' }).trim()); } catch {}
    }
  }
  const ruta = candidatos.find(c => c && fs.existsSync(c));
  if (!ruta) throw new Error('No encontré Chrome, Edge ni Chromium. Pasa la ruta con --navegador (no instalo nada).');
  return ruta;
}

// WebSocket mínimo (cliente) para hablar con el navegador; así funciona desde Node 18 sin paquetes.
function conectarWs(url) {
  const u = new URL(url);
  return new Promise((resolve, reject) => {
    const sock = net.connect(Number(u.port), u.hostname);
    const llave = crypto.randomBytes(16).toString('base64');
    let buf = Buffer.alloc(0), abierto = false, partes = [];
    const ws = {
      onmessage: null,
      send(texto) {
        const datos = Buffer.from(texto), mascara = crypto.randomBytes(4);
        const n = datos.length;
        const cab = n < 126 ? Buffer.from([0x81, 0x80 | n]) : n < 65536 ? Buffer.from([0x81, 0x80 | 126, n >> 8, n & 255]) : Buffer.concat([Buffer.from([0x81, 0x80 | 127]), (() => { const b = Buffer.alloc(8); b.writeBigUInt64BE(BigInt(n)); return b; })()]);
        for (let i = 0; i < n; i++) datos[i] ^= mascara[i & 3];
        sock.write(Buffer.concat([cab, mascara, datos]));
      },
      close() { sock.destroy(); },
    };
    sock.on('connect', () => sock.write(`GET ${u.pathname}${u.search} HTTP/1.1\r\nHost: ${u.host}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${llave}\r\nSec-WebSocket-Version: 13\r\n\r\n`));
    sock.on('error', reject);
    sock.on('data', d => {
      buf = buf.length ? Buffer.concat([buf, d]) : d;
      if (!abierto) {
        const i = buf.indexOf('\r\n\r\n');
        if (i < 0) return;
        if (!/^HTTP\/1\.1 101/.test(buf.subarray(0, i).toString())) return reject(new Error('el navegador rechazó la conexión'));
        abierto = true; buf = buf.subarray(i + 4); resolve(ws);
      }
      while (buf.length >= 2) {
        const fin = buf[0] & 0x80, op = buf[0] & 0x0f;
        let n = buf[1] & 0x7f, p = 2;
        if (n === 126) { if (buf.length < 4) return; n = buf.readUInt16BE(2); p = 4; }
        else if (n === 127) { if (buf.length < 10) return; n = Number(buf.readBigUInt64BE(2)); p = 10; }
        if (buf.length < p + n) return;
        const carga = buf.subarray(p, p + n);
        buf = buf.subarray(p + n);
        if (op === 8) { sock.destroy(); return; }
        if (op === 9) continue;
        partes.push(Buffer.from(carga));
        if (fin) { const texto = Buffer.concat(partes).toString(); partes = []; ws.onmessage?.(texto); }
      }
    });
  });
}

async function abrirNavegador(o) {
  const ruta = buscarNavegador(o);
  // Limpia perfiles temporales de corridas anteriores de esta herramienta (solo los suyos, con más de una hora).
  for (const d of fs.readdirSync(os.tmpdir())) {
    if (!/^mockup-vs-app-\w{6}$/.test(d)) continue;
    const p = path.join(os.tmpdir(), d);
    try { if (Date.now() - fs.statSync(p).mtimeMs > 3600000) fs.rmSync(p, { recursive: true, force: true }); } catch {}
  }
  const perfil = fs.mkdtempSync(path.join(os.tmpdir(), 'mockup-vs-app-'));
  const proc = spawn(ruta, ['--headless=new', '--remote-debugging-port=0', '--remote-debugging-address=127.0.0.1', `--user-data-dir=${perfil}`,
    '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--hide-scrollbars', '--force-color-profile=srgb',
    '--font-render-hinting=none', '--disable-gpu', '--disable-background-networking', '--disable-component-update', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', 'about:blank'], { stdio: 'ignore' });
  let lineas;
  for (const fin = Date.now() + 20000; Date.now() < fin && !lineas; await espera(150)) {
    try { const t = fs.readFileSync(path.join(perfil, 'DevToolsActivePort'), 'utf8').trim().split(/\r?\n/); if (t.length >= 2) lineas = t; } catch {}
  }
  if (!lineas) { cerrarProceso(proc); throw new Error(`el navegador no arrancó (${ruta})`); }
  const ws = await conectarWs(`ws://127.0.0.1:${lineas[0]}${lineas[1]}`);
  let id = 0; const pendientes = new Map(), oyentes = [];
  ws.onmessage = texto => {
    const m = JSON.parse(texto);
    if (m.id && pendientes.has(m.id)) { const { ok, mal } = pendientes.get(m.id); pendientes.delete(m.id); m.error ? mal(new Error(m.error.message)) : ok(m.result); }
    else if (m.method) for (const f of [...oyentes]) f(m);
  };
  const enviar = (method, params = {}, sessionId) => new Promise((ok, mal) => {
    const n = ++id;
    const t = setTimeout(() => { pendientes.delete(n); mal(new Error(`el navegador no respondió a ${method}`)); }, 60000);
    pendientes.set(n, { ok: v => { clearTimeout(t); ok(v); }, mal: e => { clearTimeout(t); mal(e); } });
    ws.send(JSON.stringify({ id: n, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const evento = (method, sessionId, ms = 30000) => new Promise((ok, mal) => {
    const t = setTimeout(() => { oyentes.splice(oyentes.indexOf(f), 1); mal(new Error(`la página no terminó de cargar (${method})`)); }, ms);
    const f = m => { if (m.method === method && m.sessionId === sessionId) { clearTimeout(t); oyentes.splice(oyentes.indexOf(f), 1); ok(m.params); } };
    oyentes.push(f);
  });
  const { targetId } = await enviar('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await enviar('Target.attachToTarget', { targetId, flatten: true });
  const s = (m, p) => enviar(m, p, sessionId);
  await s('Page.enable'); await s('Runtime.enable'); await s('Network.enable');
  return {
    navegador: path.basename(ruta), pid: proc.pid, s, sessionId, evento,
    async cerrar() {
      try { await enviar('Browser.close'); } catch {}
      ws.close();
      for (let i = 0; i < 20 && proc.exitCode === null && proc.signalCode === null; i++) await espera(150);
      cerrarProceso(proc);
      // Borra solo la carpeta temporal que este mismo programa creó.
      // En Windows, los procesos hijos del navegador sueltan sus archivos unos segundos después de cerrar.
      for (let i = 0; i < 20 && fs.existsSync(perfil); i++) { try { fs.rmSync(perfil, { recursive: true, force: true }); } catch {} if (fs.existsSync(perfil)) await espera(500); }
      if (fs.existsSync(perfil)) console.error(`Aviso: Windows aún no suelta la carpeta temporal ${perfil}; la borra la siguiente corrida.`);
    },
  };
}

function cerrarProceso(proc) {
  if (proc.exitCode !== null || proc.signalCode !== null) return;
  // Solo el PID que este programa prendió (y sus hijos). Nunca por nombre.
  if (process.platform === 'win32') { try { execFileSync('taskkill', ['/PID', String(proc.pid), '/T', '/F'], { stdio: 'ignore' }); } catch {} }
  else { try { proc.kill('SIGTERM'); } catch {} }
}

// ---------- Medir dentro de la página ----------
const MEDIR = `(() => {
  const props = ['color','backgroundColor','fontFamily','fontSize','fontWeight','lineHeight','letterSpacing','textTransform','textAlign',
    'paddingTop','paddingRight','paddingBottom','paddingLeft','marginTop','marginRight','marginBottom','marginLeft','gap',
    'borderTopWidth','borderTopColor','borderTopLeftRadius','boxShadow','opacity'];
  const parte = el => {
    if (el.id) return '#' + CSS.escape(el.id);
    const clases = [...el.classList].filter(c => !/^(css|sc|jsx|svelte|emotion)-|^[a-z]+-[a-z0-9]{5,}$/i.test(c)).slice(0, 2);
    return el.tagName.toLowerCase() + clases.map(c => '.' + CSS.escape(c)).join('');
  };
  const ruta = (el, completa) => {
    const p = [];
    for (let e = el; e && e.nodeType === 1 && e !== document.documentElement; e = e.parentElement) {
      const x = completa ? e.tagName.toLowerCase() + (e.id ? '#' + e.id : '') + [...e.classList].slice(0, 2).map(c => '.' + c).join('') : parte(e);
      p.unshift(x);
      if (!completa && x.startsWith('#')) break;
    }
    return p.join(' > ');
  };
  const textoPropio = el => [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join(' ').replace(/\\s+/g, ' ').trim();
  const out = [], vistos = new Map();
  for (const el of document.body.querySelectorAll('*')) {
    if (['SCRIPT','STYLE','NOSCRIPT','TEMPLATE','META','LINK','BR'].includes(el.tagName)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const texto = textoPropio(el) || (['BUTTON','A','LABEL','LI','H1','H2','H3','H4','P','SPAN'].includes(el.tagName) ? el.innerText.replace(/\\s+/g, ' ').trim() : '');
    const control = ['INPUT','TEXTAREA','SELECT','BUTTON','IMG','SVG','VIDEO','CANVAS'].includes(el.tagName.toUpperCase());
    const pinta = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || parseFloat(cs.borderTopWidth) > 0 || cs.boxShadow !== 'none' || cs.backgroundImage !== 'none';
    if (!texto && !control && !pinta) continue;
    let sel = ruta(el);
    const n = (vistos.get(sel) || 0) + 1; vistos.set(sel, n);
    if (n > 1) sel += ':nth(' + n + ')';
    const visible = r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden' && parseFloat(cs.opacity) > 0;
    const e = { sel, ruta: ruta(el, true) + (n > 1 ? ':nth(' + n + ')' : ''), tag: el.tagName.toLowerCase(), texto: texto.slice(0, 120), visible,
      x: Math.round(r.x + scrollX), y: Math.round(r.y + scrollY), w: Math.round(r.width * 10) / 10, h: Math.round(r.height * 10) / 10 };
    if (el.placeholder) e.placeholder = el.placeholder;
    if (el.alt) e.alt = el.alt;
    for (const p of props) e[p] = cs[p];
    out.push(e);
    if (out.length >= 600) break;
  }
  // Variables CSS (tokens) que se declaran en :root o html: así el arreglo puede ser "cambia --color-primario".
  const tokens = {}, raiz = getComputedStyle(document.documentElement);
  const juntar = reglas => { for (const r of reglas) {
    if (r.cssRules && !r.selectorText) { try { juntar(r.cssRules); } catch {} continue; }
    if (r.style && /(^|,)\\s*(:root|html)\\b/.test(r.selectorText || '')) for (const p of r.style) if (p.startsWith('--')) tokens[p] = raiz.getPropertyValue(p).trim();
  } };
  for (const h of document.styleSheets) { try { juntar(h.cssRules); } catch {} }
  return { url: location.href, titulo: document.title, ancho: innerWidth, alto: document.documentElement.scrollHeight,
    desborde: document.documentElement.scrollWidth > innerWidth, oscuro: matchMedia('(prefers-color-scheme: dark)').matches, tokens, elementos: out };
})()`;

async function cargar(nav, o, url, t, tema) {
  const { s, sessionId, evento } = nav;
  await s('Emulation.setDeviceMetricsOverride', { width: t.ancho, height: t.alto, deviceScaleFactor: 1, mobile: t.ancho < 600 });
  await s('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-color-scheme', value: tema === 'oscuro' ? 'dark' : 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  for (const c of o.cookie) {
    const i = c.indexOf('=');
    if (!url.startsWith('file:')) await s('Network.setCookie', { name: c.slice(0, i), value: c.slice(i + 1), url });
  }
  const listo = evento('Page.loadEventFired', sessionId);
  const nav1 = await s('Page.navigate', { url });
  if (nav1.errorText) throw new Error(`no pude abrir ${url}: ${nav1.errorText}. ¿La app está corriendo?`);
  await listo;
  const ev = (expression) => s('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (tema === 'oscuro' && o['oscuro-clase']) await ev(`document.documentElement.classList.add(${JSON.stringify(o['oscuro-clase'])})`);
  if (tema === 'oscuro' && o['oscuro-atributo']) { const [k, v = ''] = o['oscuro-atributo'].split('='); await ev(`document.documentElement.setAttribute(${JSON.stringify(k)}, ${JSON.stringify(v)})`); }
  if (o.listo) {
    const { result } = await ev(`new Promise(ok => { const fin = Date.now() + 15000; (function v() { if (document.querySelector(${JSON.stringify(o.listo)})) ok(true); else if (Date.now() > fin) ok(false); else setTimeout(v, 100); })(); })`);
    if (!result.value) throw new Error(`no apareció ${o.listo} en 15 segundos`);
  }
  await ev('document.fonts.ready.then(() => true)');
  await espera(Number(o.esperar ?? 300));
  return ev;
}

async function foto(nav, t, clip) {
  const alto = clip?.height;
  const r = await nav.s('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: clip || { x: 0, y: 0, width: t.ancho, height: alto || t.alto, scale: 1 } });
  return Buffer.from(r.data, 'base64');
}

async function capturar(o) {
  if (!o.url) throw new Error('falta --url');
  revisarUrl(o.url, o);
  const nombre = limpio(o.nombre || 'pantalla'), lado = limpio(o.lado || 'real'), salida = o.salida || 'mockup-vs-app/capturas';
  const lista = tamanos(o.tamanos), ts = temas(o.temas);
  const nav = await abrirNavegador(o);
  console.log(`Navegador: ${nav.navegador} (PID ${nav.pid}, perfil temporal propio)`);
  try {
    for (const t of lista) for (const tema of ts) {
      const ev = await cargar(nav, o, o.url, t, tema);
      const { result } = await ev(MEDIR);
      const m = result.value;
      const base = path.join(salida, `${nombre}__${lado}__${t.nombre}-${t.ancho}__${tema}`);
      guardar(base + '.png', await foto(nav, t, { x: 0, y: 0, width: t.ancho, height: Math.max(t.alto, m.alto), scale: 1 }));
      guardar(base + '.json', { lado, nombre, tamano: t.nombre, ancho: t.ancho, tema, fecha: new Date().toISOString(), ...m });
      const aviso = tema === 'oscuro' && !m.oscuro ? '  (la página no reconoce el modo oscuro)' : '';
      console.log(`  ${base}.png  ${m.elementos.length} elementos medidos${m.desborde ? '  ¡se sale a lo ancho!' : ''}${aviso}`);
    }
  } finally { await nav.cerrar(); }
}

async function recortar(o) {
  if (!o.url || !o.selector) throw new Error('faltan --url o --selector');
  revisarUrl(o.url, o);
  const [t] = tamanos(o.tamano || 'escritorio'), [tema] = temas(o.tema || 'claro');
  const nav = await abrirNavegador(o);
  try {
    const ev = await cargar(nav, o, o.url, t, tema);
    const { result } = await ev(`(() => { const e = document.querySelector(${JSON.stringify(o.selector)}); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.x + scrollX, y: r.y + scrollY, w: r.width, h: r.height, vis: r.width > 0 && r.height > 0 }; })()`);
    const r = result.value;
    if (!r) throw new Error(`no existe ${o.selector} en ${t.nombre} ${tema}`);
    if (!r.vis) throw new Error(`${o.selector} existe pero no se ve en ${t.nombre} ${tema} (oculto o sin tamaño). Recorta su contenedor para mostrar que falta.`);
    const m = Number(o.margen ?? 16);
    const clip = { x: Math.max(0, r.x - m), y: Math.max(0, r.y - m), width: Math.min(t.ancho, r.w + m * 2), height: r.h + m * 2, scale: 1 };
    const salida = o.salida || path.join('mockup-vs-app', 'capturas', 'recortes', `${o.lado ? limpio(o.lado) + '__' : ''}${limpio(o.selector).replace(/^[._]+/, '')}__${t.nombre}-${t.ancho}__${tema}.png`);
    guardar(salida, await foto(nav, t, clip));
    console.log(`Recorte: ${salida}  (${Math.round(r.w)}x${Math.round(r.h)} px)  · navegador PID ${nav.pid}, ya cerrado`);
  } finally { await nav.cerrar(); }
}

async function colores(o) {
  if (!o.imagen || !o.puntos) throw new Error('faltan --imagen o --puntos "x,y;x,y"');
  const ext = path.extname(o.imagen).toLowerCase();
  const tipo = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[ext];
  if (!tipo) throw new Error('la imagen debe ser PNG, JPG o WEBP');
  const escala = Number(o.escala || 1);
  const puntos = o.puntos.split(';').map(p => p.split(',').map(Number));
  const nav = await abrirNavegador(o);
  try {
    const datos = fs.readFileSync(o.imagen).toString('base64');
    const { result } = await nav.s('Runtime.evaluate', { awaitPromise: true, returnByValue: true, expression: `(async () => {
      const i = new Image(); i.src = 'data:${tipo};base64,${datos}'; await i.decode();
      const c = document.createElement('canvas'); c.width = i.naturalWidth; c.height = i.naturalHeight;
      const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      const hex = v => v.toString(16).padStart(2, '0');
      return { w: i.naturalWidth, h: i.naturalHeight, puntos: ${JSON.stringify(puntos)}.map(([px, py]) => {
        const X = Math.round(px * ${escala}), Y = Math.round(py * ${escala});
        if (X < 0 || Y < 0 || X >= c.width || Y >= c.height) return { px, py, fuera: true };
        const d = x.getImageData(X, Y, 1, 1).data; return { px, py, color: '#' + hex(d[0]) + hex(d[1]) + hex(d[2]) };
      }) };
    })()` });
    const r = result.value;
    console.log(`Imagen ${r.w}x${r.h} px${escala !== 1 ? ` (escala ${escala}: ${Math.round(r.w / escala)}x${Math.round(r.h / escala)} en px de pantalla)` : ''}`);
    for (const p of r.puntos) console.log(`  (${p.px}, ${p.py})  ${p.fuera ? 'fuera de la imagen' : p.color}`);
  } finally { await nav.cerrar(); }
}

// ---------- Comparar ----------
const rgb = c => { const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?/.exec(c || ''); return m ? [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]] : null; };
const hex = c => { const v = rgb(c); if (!v) return c; const h = '#' + v.slice(0, 3).map(n => Math.round(n).toString(16).padStart(2, '0')).join(''); return v[3] < 1 ? `${h} (${Math.round(v[3] * 100)}%)` : h; };
const distancia = (a, b) => { const x = rgb(a), y = rgb(b); if (!x || !y) return a === b ? 0 : 100; return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2], (x[3] - y[3]) * 255); };
const px = v => parseFloat(v) || 0;
const normal = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const primera = f => String(f || '').split(',')[0].replace(/["']/g, '').trim();

function emparejar(A, B) {
  const pares = [], usadosB = new Set();
  const porSel = new Map(B.map(e => [e.sel, e]));
  for (const a of A) { const b = porSel.get(a.sel); if (b && !usadosB.has(b)) { pares.push([a, b, 'selector']); usadosB.add(b); } }
  const sueltosA = A.filter(a => !pares.some(p => p[0] === a));
  for (const a of sueltosA) {
    if (!a.texto) continue;
    const b = B.find(e => !usadosB.has(e) && e.texto && normal(e.texto) === normal(a.texto));
    if (b) { pares.push([a, b, 'texto']); usadosB.add(b); }
  }
  return { pares, soloA: A.filter(a => !pares.some(p => p[0] === a)), soloB: B.filter(b => !usadosB.has(b)) };
}

function comparar(o) {
  const [fa, fb] = o._;
  if (!fa || !fb) throw new Error('uso: comparar <mockup.json> <real.json>');
  const M = JSON.parse(fs.readFileSync(fa, 'utf8')), R = JSON.parse(fs.readFileSync(fb, 'utf8'));
  if (M.ancho !== R.ancho || M.tema !== R.tema) console.log(`Aviso: comparas ${M.ancho}px/${M.tema} contra ${R.ancho}px/${R.tema}.`);
  const { pares, soloA, soloB } = emparejar(M.elementos, R.elementos);
  const difs = [];
  const area = e => Math.max(1, e.w * e.h);
  const peso = e => 1 + Math.min(1, Math.log10(area(e)) / 5);
  const add = (e, real, tipo, que, mockup, realV, puntos) => difs.push({ donde: real?.sel || e.sel, ruta: (real || e).ruta || (real || e).sel, texto: (real || e).texto, tipo, que, mockup, real: realV, puntos: Math.round(puntos * peso(real || e)) });

  for (const [a, b] of pares) {
    if (a.visible && !b.visible) { add(a, b, 'falta', 'no se ve', 'visible', 'oculto o sin tamaño', 100); continue; }
    if (!a.visible && b.visible) { add(a, b, 'sobra', 'se ve y no debería', 'oculto', 'visible', 60); continue; }
    if (!a.visible) continue;
    if (normal(a.texto) !== normal(b.texto)) add(a, b, 'texto', 'texto', a.texto, b.texto, 90);
    if ((a.placeholder || '') !== (b.placeholder || '')) add(a, b, 'texto', 'placeholder', a.placeholder || '(ninguno)', b.placeholder || '(ninguno)', 50);
    for (const [p, nombre] of [['backgroundColor', 'fondo'], ['color', 'color de texto'], ['borderTopColor', 'color de borde']]) {
      const d = distancia(a[p], b[p]);
      if (p === 'borderTopColor' && px(a.borderTopWidth) === 0 && px(b.borderTopWidth) === 0) continue;
      if (d > 6) add(a, b, 'color', nombre, hex(a[p]), hex(b[p]), Math.min(80, 20 + d / 3));
    }
    if (px(a.fontSize) !== px(b.fontSize)) add(a, b, 'letra', 'tamaño de letra', a.fontSize, b.fontSize, Math.min(85, 30 + Math.abs(px(a.fontSize) - px(b.fontSize)) / px(a.fontSize) * 200));
    if (a.fontWeight !== b.fontWeight) add(a, b, 'letra', 'grosor de letra', a.fontWeight, b.fontWeight, 40);
    if (primera(a.fontFamily) !== primera(b.fontFamily)) add(a, b, 'letra', 'fuente', primera(a.fontFamily), primera(b.fontFamily), 45);
    const proporcion = e => px(e.lineHeight) / Math.max(px(e.fontSize), 1);
    if (a.lineHeight !== b.lineHeight && Math.abs(proporcion(a) - proporcion(b)) > 0.02) add(a, b, 'letra', 'alto de línea', a.lineHeight, b.lineHeight, 15);
    if (a.letterSpacing !== b.letterSpacing) add(a, b, 'letra', 'espacio entre letras', a.letterSpacing, b.letterSpacing, 10);
    if (a.textTransform !== b.textTransform) add(a, b, 'letra', 'mayúsculas', a.textTransform, b.textTransform, 35);
    for (const grupo of [['padding', 'relleno (padding)'], ['margin', 'margen'], ['gap', 'separación (gap)']]) {
      const lados = grupo[0] === 'gap' ? ['gap'] : ['Top', 'Right', 'Bottom', 'Left'].map(l => grupo[0] + l);
      const va = lados.map(l => px(a[l])), vb = lados.map(l => px(b[l]));
      const d = Math.max(...va.map((v, i) => Math.abs(v - vb[i])));
      if (d >= 1) add(a, b, 'espacio', grupo[1], va.join(' ') + 'px', vb.join(' ') + 'px', Math.min(60, 12 + d * 2.5));
    }
    if (Math.abs(px(a.borderTopLeftRadius) - px(b.borderTopLeftRadius)) >= 1) add(a, b, 'forma', 'esquinas (border-radius)', a.borderTopLeftRadius, b.borderTopLeftRadius, 15);
    if (Math.abs(px(a.borderTopWidth) - px(b.borderTopWidth)) >= 1) add(a, b, 'forma', 'grosor de borde', a.borderTopWidth, b.borderTopWidth, 25);
    if ((a.boxShadow === 'none') !== (b.boxShadow === 'none')) add(a, b, 'forma', 'sombra', a.boxShadow, b.boxShadow, 25);
    if (Math.abs(+a.opacity - +b.opacity) > 0.05) add(a, b, 'color', 'opacidad', a.opacity, b.opacity, 30);
    // Tamaño: solo si no lo explica otra diferencia dentro del mismo elemento.
    for (const [k, nombre] of [['h', 'alto'], ['w', 'ancho']]) {
      const d = Math.abs(a[k] - b[k]);
      if (d >= 2 && d / Math.max(a[k], 1) > 0.03) add(a, b, 'tamano', nombre, a[k] + 'px', b[k] + 'px', Math.min(70, 15 + d / Math.max(a[k], 1) * 150));
    }
  }
  for (const a of soloA) if (a.visible) add(a, null, 'falta', 'no existe en la pantalla real', a.texto || a.tag, '—', a.texto ? 95 : 70);
  for (const b of soloB) if (b.visible) add(b, null, 'sobra', 'no está en el mockup', '—', b.texto || b.tag, b.texto ? 75 : 45);

  // Quita lo que solo es consecuencia de otra diferencia:
  //  - un tamaño que se explica por letra, espacio o borde del mismo elemento, por un hijo que cambió o por el relleno de un padre;
  //  - un hijo que "falta" cuando su padre ya falta.
  const esDe = (hijo, padre) => hijo.startsWith(padre.replace(/:nth\(\d+\)$/, '') + ' > ');
  const propias = new Set(difs.filter(d => ['letra', 'espacio', 'forma'].includes(d.tipo)).map(d => d.ruta));
  const cualquiera = difs.filter(d => d.tipo !== 'tamano').map(d => d.ruta);
  const padresQueCambianAncho = difs.filter(d => d.tipo === 'espacio' || (d.tipo === 'tamano' && d.que === 'ancho')).map(d => d.ruta);
  const faltan = difs.filter(d => d.tipo === 'falta').map(d => d.ruta);
  let filtradas = difs.filter(d => {
    if (d.tipo === 'tamano') {
      if (propias.has(d.ruta) || cualquiera.some(c => esDe(c, d.ruta))) return false;
      // El ancho de un hijo cambia solo porque el padre tiene otro relleno o ancho.
      if (d.que === 'ancho' && padresQueCambianAncho.some(c => esDe(d.ruta, c))) return false;
      return true;
    }
    if (d.tipo === 'falta') return !faltan.some(c => esDe(d.ruta, c));
    return true;
  });
  // Junta la misma diferencia repetida en varios elementos (casi siempre es un solo token o una sola clase).
  const grupos = new Map();
  for (const d of filtradas) {
    // Un mismo par de colores es casi siempre una sola variable, aunque se use en fondo, texto o borde.
    const k = d.tipo === 'color' ? `color|${d.mockup}|${d.real}` : ['letra', 'espacio', 'forma'].includes(d.tipo) ? `${d.tipo}|${d.que}|${d.mockup}|${d.real}` : `${d.donde}|${d.tipo}|${d.que}`;
    const g = grupos.get(k);
    if (g) { g.tambien.push(d.donde); g.puntos = Math.max(g.puntos, d.puntos) + 3; } else grupos.set(k, { ...d, tambien: [] });
  }
  filtradas = [...grupos.values()].sort((x, y) => y.puntos - x.puntos);
  const tokens = Object.keys({ ...M.tokens, ...R.tokens }).filter(k => (M.tokens || {})[k] !== (R.tokens || {})[k])
    .map(k => ({ token: k, mockup: (M.tokens || {})[k] ?? '(no existe)', real: (R.tokens || {})[k] ?? '(no existe)' }));
  const nivel = p => (p >= 60 ? 'se nota mucho' : p >= 30 ? 'se nota' : 'detalle');
  const res = { mockup: fa, real: fb, ancho: R.ancho, tema: R.tema, emparejados: pares.length, solo_mockup: soloA.filter(a => a.visible).length, solo_real: soloB.filter(b => b.visible).length,
    desborde_real: R.desborde, tokens_distintos: tokens, diferencias: filtradas.map((d, i) => ({ n: i + 1, nivel: nivel(d.puntos), ...d })) };
  const salida = o.salida || fb.replace(/\.json$/, '__diferencias.json');
  guardar(salida, res);
  console.log(`${R.tamano || ''} ${R.ancho}px · ${R.tema}: ${filtradas.length} diferencias (${pares.length} elementos emparejados)${R.desborde ? ' · la pantalla real se sale a lo ancho' : ''}`);
  for (const d of res.diferencias) console.log(`  ${String(d.n).padStart(2)}. [${d.nivel}] ${d.donde}${d.texto ? ` "${d.texto.slice(0, 40)}"` : ''}: ${d.que}: mockup ${d.mockup} → real ${d.real}${d.tambien.length ? `  (+${d.tambien.length} elementos más)` : ''}`);
  if (tokens.length) { console.log('Variables CSS distintas:'); for (const t of tokens) console.log(`  ${t.token}: mockup ${t.mockup} → real ${t.real}`); }
  console.log(`Guardado en ${salida}`);
}

try {
  const o = opciones(resto);
  if (accion === 'capturar') await capturar(o);
  else if (accion === 'comparar') comparar(o);
  else if (accion === 'recortar') await recortar(o);
  else if (accion === 'colores') await colores(o);
  else {
    // Ayuda: imprime el encabezado de este archivo, que trae todas las acciones y opciones.
    const yo = fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n');
    console.log(yo.slice(1, yo.findIndex(l => l.startsWith('import'))).map(l => l.replace(/^\/\/ ?/, '')).join('\n'));
    console.log('recortar: --url --selector --tamano celular|tablet|escritorio|<ancho> [--tema oscuro] [--lado real|mockup] [--margen 16] [--salida archivo.png]');
    console.log('          por defecto guarda en mockup-vs-app/capturas/recortes/<lado>__<selector>__<tamano>__<tema>.png');
    console.log('Las rutas de salida son relativas a la carpeta desde donde corres el comando: córrelo en la raíz del proyecto.');
  }
} catch (e) {
  console.error('Error: ' + e.message);
  process.exitCode = 2;
}
