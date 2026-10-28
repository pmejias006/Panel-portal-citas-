/**
 * Panel de postventa | Emprende con Ridery
 * Conexión segura con Google Sheets. El Sheet sigue privado: este script lo lee
 * con tu cuenta y solo responde a quien envía una contraseña válida.
 * Pasos de instalación en README.md.
 */

// Contraseñas iniciales. Después se pueden cambiar desde el panel (Configuración).
// Google Sheet de solicitudes (donde caen las respuestas del formulario).
// Este script va en un proyecto NUEVO de Apps Script, separado del que usa el formulario.
const SHEET_ID = '1rYcDAAwhdh7DfGe18uAwuiVXfVeQiKvdVDIOkvg-UUA';

const CLAVES = { admin: '27985695', consultor: 'Emprende.26' };

// Pestañas con solicitudes.
//   gid o nombre: la pestaña (el gid es el número después de "gid=" en la URL).
//   tipo: 'mant' (mantenimiento), 'falla' o 'auto' (se decide fila por fila).
//   prefijo: inicio del ID de cada solicitud. Ej.: GS2-603 es la fila 603.
//   archivo: opcional, ID de otro Google Sheet si la pestaña está en otro archivo.
const HOJAS = [
  { gid: 1089612557, tipo: 'auto', prefijo: 'GS' },
  { nombre: 'Citas manuales', tipo: 'auto', prefijo: 'CM', opcional: true } // la crea el panel al usar "Nueva cita"
  // { nombre: 'Respuestas Mantenimiento', tipo: 'mant', prefijo: 'GS2' },
  // { nombre: 'Respuestas Fallas', tipo: 'falla', prefijo: 'GS3' },
];

// Solo se leen solicitudes desde esta fecha (AAAA-MM-DD). Vacío = todas.
const DESDE = '';

// Gestor de Disponibilidad de Centros (Google Drive). El script lo lee con la cuenta que lo publicó.
const DISPONIBILIDAD = { id: '12sbYaSCeaI5ZG0E_8mCLoICaJMNVSwP8j-SjmS0O7ac', semana: 'INFORMACIÓN DE CENTROS ECR', especiales: 'CONDICIONES ESPECIALES' };

// Resumen con IA (opcional). Guarda tu clave en Propiedades del script como CLAUDE_API_KEY.
const MODELO_IA = 'claude-haiku-4-5-20251001';
const PROMPT_IA = 'Eres asistente de postventa de Emprende con Ridery. Con las respuestas del formulario, escribe una o dos oraciones cortas para pegar en una orden de servicio de taller. Si es mantenimiento, empieza con Mantenimiento preventivo y el kilometraje del servicio (por ejemplo: Mantenimiento preventivo de 95.000 km). Agrega siempre el síntoma o falla que reporta el conductor, con desde cuándo ocurre. No incluyas placa, vehículo, conductor, ciudad, teléfono ni kilometraje actual. No inventes datos.';


// Encabezado exacto de cada dato. Si lo dejas vacío, se busca por palabras clave.
const COLUMNAS = {
  codigo: '', fecha: '', nombre: '', cedula: '', telefono: '', correo: '', placa: '', vehiculo: '', ciudad: '', solicitud: '',
  km: '', ultimo: '', proximo: '', descripcion: '', inmediata: ''
};

// Columnas que el panel agrega al final de cada pestaña para guardar la gestión.
const GESTION = { estado: 'Estado de gestión', taller: 'Taller asignado', fecha: 'Fecha de la cita', hora: 'Hora de la cita', primera: 'Aceptó primera cita', kmIngreso: 'Km al ingreso', resumen: 'Resumen para la orden', trabajos: 'Trabajos a realizar', obs: 'Observación de la cita', hist: 'Historial de la cita', servicio: 'Servicio', dur: 'Duración (min)', bahia: 'Bahía', rec: 'Atiende', por: 'Agendado por', act: 'Actualizado' };
const GEST_NOMBRES = Object.keys(GESTION).map(k => GESTION[k]);

const BUSCAR = {
  codigo: [/c[óo]digo (de )?(la )?solicitud|^c[óo]digo$|^id solicitud$|^n[úu]mero de solicitud$/i],
  ultimo: [/(km|kilometraje).*[úu]ltimo|[úu]ltimo.*(km|kilometraje)/i, /[úu]ltimo (mantenimiento|servicio)/i],
  proximo: [/(km|kilometraje).*pr[óo]ximo|pr[óo]ximo.*(km|kilometraje)/i, /pr[óo]ximo (mantenimiento|servicio)/i],
  fecha: [/marca temporal|timestamp/i, /fecha/i],
  telefono: [/tel[ée]fono|celular|whatsapp/i],
  correo: [/correo|e-?mail/i],
  cedula: [/c[ée]dula|documento de identidad|\bc\.?\s?i\b/i, /^id conductor$/i],
  placa: [/placa/i],
  vehiculo: [/tipo (de )?(veh[íi]culo|unidad)/i, /veh[íi]culo|unidad/i],
  ciudad: [/ciudad/i, /sede|zona/i],
  km: [/od[óo]metro/i, /kilometraje actual|km actual/i, /kilometraje|\bkm\b/i],
  inmediata: [/inmediat|urgen/i],
  solicitud: [/tipo (de )?solicitud|motivo de (la )?solicitud|falla o mant|mantenimiento o falla/i],
  descripcion: [/descrip/i, /detalle|problema|s[íi]ntoma/i, /falla|aver[íi]a/i, /motivo|observaci/i],
  nombre: [/nombre/i, /conductor/i]
};
const ETIQUETAS = { fecha: 'Fecha de la solicitud', nombre: 'Nombre del conductor', placa: 'Placa', ciudad: 'Ciudad', km: 'Odómetro actual', ultimo: 'Km del último servicio' };
const ESTADO_TXT = { pendiente: 'Pendiente', procesado: 'Procesado', porcita: 'Pendiente de cita', agendada: 'Agendada', taller: 'En taller', anulada: 'Sin efecto' };

let LIBRO_ = null;
function libro() { return LIBRO_ || (LIBRO_ = SHEET_ID ? SpreadsheetApp.openById(SHEET_ID) : SpreadsheetApp.getActive()); }

function doGet() { return salida({ ok: true, servicio: 'Panel de postventa Emprende con Ridery' }); }

function doPost(e) {
  try {
    const q = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const rol = rolValido(q);
    if (!rol) return salida({ ok: false, error: 'clave' });
    if (q.accion === 'datos') return salida(Object.assign({ ok: true, rol: rol, ajustes: ajustesLeer(), disp: disponibilidad() }, leer()));
    if (rol !== 'admin') return salida({ ok: false, error: 'permiso' });
    if (q.accion === 'actualizar') return salida(actualizar(q));
    if (q.accion === 'resumen') return salida(resumenIA(q));
    if (q.accion === 'crear') return salida(crearCita(q));
    if (q.accion === 'ajustes') return salida(ajustesGuardar(q));
    if (q.accion === 'clave') return salida(cambiarClave(q));
    return salida({ ok: false, error: 'accion' });
  } catch (err) {
    return salida({ ok: false, error: String((err && err.message) || err) });
  }
}

function salida(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Valida rol y contraseña. Tras 50 intentos fallidos en 15 minutos, bloquea el acceso un rato.
function rolValido(q) {
  const cache = CacheService.getScriptCache(), fallos = Number(cache.get('fallos') || 0);
  if (fallos >= 50) throw new Error('bloqueo');
  const p = PropertiesService.getScriptProperties(), clave = String(q.clave || '');
  const ok = { admin: p.getProperty('CLAVE_ADMIN') || CLAVES.admin, consultor: p.getProperty('CLAVE_CONSULTOR') || CLAVES.consultor };
  if ((q.rol === 'admin' || q.rol === 'consultor') && clave && clave === ok[q.rol]) return q.rol;
  cache.put('fallos', String(fallos + 1), 900);
  Utilities.sleep(800);
  return null;
}

function cambiarClave(q) {
  const p = PropertiesService.getScriptProperties();
  if (q.admin) p.setProperty('CLAVE_ADMIN', String(q.admin));
  if (q.consultor) p.setProperty('CLAVE_CONSULTOR', String(q.consultor));
  return { ok: true };
}

function leer() {
  const filas = [], faltan = {}, cab = [], tz = libro().getSpreadsheetTimeZone();
  const desde = DESDE ? new Date(DESDE + 'T00:00:00').getTime() : 0;
  HOJAS.forEach(h => {
    const sh = hoja(h);
    if (!sh) { if (!h.opcional) faltan[h.nombre || 'gid ' + h.gid] = ['la pestaña no existe']; return; }
    const head = encabezados(sh), g = gestion(sh, head), col = mapa(head);
    head.forEach(n => { if (n && GEST_NOMBRES.indexOf(n) < 0 && cab.indexOf(n) < 0) cab.push(n); });
    const req = ['fecha', 'nombre', 'placa', 'ciudad'].concat(h.tipo !== 'falla' ? ['km'] : []);
    if (h.tipo === 'mant' && col.ultimo < 0 && col.proximo < 0) req.push('ultimo');
    const miss = req.filter(k => col[k] < 0);
    if (miss.length) faltan[sh.getName()] = miss.map(k => ETIQUETAS[k]);
    if (sh.getLastRow() < 2) return;
    const rg = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()), v = rg.getValues(), dv = rg.getDisplayValues();
    for (let i = 1; i < v.length; i++) {
      if (v[i].every(x => x === '' || x === null)) continue;
      const x = registro(h, i + 1, v[i], dv[i], col, g, tz, head);
      if (desde && x.t && x.t < desde) continue;
      filas.push(x);
    }
  });
  return { filas: filas, faltan: faltan, cabeceras: cab };
}

function actualizar(q) {
  const f = buscarFila(q.id);
  if (!f) return { ok: false, error: 'id' };
  const sh = f.sh, g = gestion(sh, encabezados(sh)), fila = f.fila;
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const put = (k, v) => { if (v !== undefined && v !== null && v !== '') sh.getRange(fila, g[k] + 1).setValue(v); };
    put('estado', ESTADO_TXT[q.estado]);
    put('taller', q.taller);
    put('resumen', q.resumen);
    if (q.trabajos !== undefined) sh.getRange(fila, g.trabajos + 1).setValue(q.trabajos);
    if (q.obs !== undefined) sh.getRange(fila, g.obs + 1).setValue(q.obs);
    if (q.hist !== undefined) sh.getRange(fila, g.hist + 1).setValue(q.hist);
    if (q.servicio) put('servicio', q.servicio); if (q.dur) put('dur', Number(q.dur)); if (q.bahia) put('bahia', Number(q.bahia)); if (q.rec) put('rec', q.rec === 'ayu' ? 'Ayudante' : 'Técnico'); if (q.por) put('por', q.por);
    put('fecha', q.fecha);
    if (q.hora) put('hora', "'" + q.hora);
    if (q.primera !== undefined) put('primera', q.primera ? 'Sí' : 'No');
    if (q.kmIngreso) put('kmIngreso', Number(q.kmIngreso));
    put('act', new Date());
  } finally {
    lock.releaseLock();
  }
  return { ok: true };
}

function hoja(h) {
  const ss = h.archivo ? SpreadsheetApp.openById(h.archivo) : libro();
  if (h.nombre) return ss.getSheetByName(h.nombre);
  return ss.getSheets().filter(s => String(s.getSheetId()) === String(h.gid))[0] || null;
}

function encabezados(sh) {
  return sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(x => String(x).trim());
}

// Agrega las columnas de gestión que falten y devuelve su posición.
function gestion(sh, head) {
  const g = {};
  Object.keys(GESTION).forEach(k => {
    let i = head.indexOf(GESTION[k]);
    if (i < 0) { i = head.length; sh.getRange(1, i + 1).setValue(GESTION[k]); head.push(GESTION[k]); }
    g[k] = i;
  });
  return g;
}

function mapa(head) {
  const col = {}, usados = {}, gest = Object.keys(GESTION).map(k => GESTION[k]);
  Object.keys(BUSCAR).forEach(k => {
    let i = COLUMNAS[k] ? head.indexOf(COLUMNAS[k]) : -1;
    if (!COLUMNAS[k]) {
      for (const re of BUSCAR[k]) {
        i = head.findIndex((x, j) => x && !usados[j] && gest.indexOf(x) < 0 && re.test(x.replace(/_/g, ' ')));
        if (i >= 0) break;
      }
    }
    col[k] = i;
    if (i >= 0) usados[i] = true;
  });
  return col;
}

function registro(h, fila, r, d, col, g, tz, head) {
  const val = k => (col[k] >= 0 ? r[col[k]] : '');
  const txt = k => String(val(k) == null ? '' : val(k)).trim();
  const placa = txt('placa').toUpperCase().replace(/[\s-]/g, ''), vt = txt('vehiculo').toLowerCase(), sol = txt('solicitud').toLowerCase();
  const ult = numero(val('ultimo')), prox = numero(val('proximo')), f = val('fecha'), vi = txt('inmediata');
  const tipo = h.tipo !== 'auto' ? h.tipo : sol ? (/mant|prevent/.test(sol) ? 'mant' : 'falla') : (ult != null || prox != null ? 'mant' : 'falla');
  const est = String(r[g.estado] || '').toLowerCase(), cf = r[g.fecha], hm = /(\d{1,2}):(\d{2})/.exec(String(d[g.hora] || ''));
  return {
    id: txt('codigo') || h.prefijo + '-' + fila,
    tipo: tipo,
    vehiculo: /moto/.test(vt) ? 'moto' : vt ? 'carro' : /^A[A-Z]\d[A-Z]\d{2}[A-Z]$/.test(placa) ? 'moto' : 'carro',
    t: esFecha(f) ? f.getTime() : fechaTexto(f),
    nombre: txt('nombre'),
    telefono: txt('telefono'),
    correo: txt('correo'),
    cedula: numero(val('cedula')),
    placa: placa,
    ciudad: titulo(txt('ciudad')),
    km: numero(val('km')),
    ult: ult,
    prox: prox,
    desc: txt('descripcion'),
    inmediata: /^(s[ií]|true|x)$/i.test(vi) || /inmediat|urgent/i.test(vi),
    estado: /otorgar|de cita|por cita/.test(est) ? 'porcita' : /procesad/.test(est) ? 'procesado' : /agend/.test(est) ? 'agendada' : /taller|ingres/.test(est) ? 'taller' : /efecto|anul/.test(est) ? 'anulada' : 'pendiente',
    cita: r[g.taller] ? {
      taller: String(r[g.taller]),
      fecha: esFecha(cf) ? Utilities.formatDate(cf, tz, 'yyyy-MM-dd') : String(cf || ''),
      hora: hm ? ('0' + hm[1]).slice(-2) + ':' + hm[2] : '',
      trabajos: String(r[g.trabajos] || '').trim(),
      obs: String(r[g.obs] || '').trim(),
      hist: String(r[g.hist] || '').trim(),
      servicio: String(r[g.servicio] || '').trim(),
      dur: numero(r[g.dur]),
      bahia: numero(r[g.bahia]),
      rec: /ayud/i.test(String(r[g.rec] || '')) ? 'ayu' : 'tec',
      por: String(r[g.por] || '').trim()
    } : null,
    primera: /^(s[ií]|true)/i.test(String(r[g.primera] || '')),
    kmAct: numero(r[g.kmIngreso]),
    resumen: String(r[g.resumen] || '').trim(),
    // Todas las respuestas del formulario, tal como se ven en el Sheet
    resp: (head || []).map((n, j) => [n, String(d[j] == null ? '' : d[j]).trim()]).filter(p => p[0] && GEST_NOMBRES.indexOf(p[0]) < 0)
  };
}

// Toma el número más grande del texto: "17.010" → 17010, "Servicio 17 (17.000 km)" → 17000.
function numero(x) {
  if (typeof x === 'number') return isNaN(x) ? null : x;
  if (esFecha(x)) return null;
  const m = String(x == null ? '' : x).replace(/,(?=\d{3}\b)/g, '').match(/\d[\d.]*/g);
  if (!m) return null;
  const n = m.map(s => Number(s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(/\.$/, ''))).filter(v => !isNaN(v));
  return n.length ? Math.max.apply(null, n) : null;
}

function fechaTexto(s) {
  const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(String(s || ''));
  return m ? new Date(+m[3], m[2] - 1, +m[1], +(m[4] || 0), +(m[5] || 0)).getTime() : null;
}

function esFecha(x) { return Object.prototype.toString.call(x) === '[object Date]' && !isNaN(x); }

function titulo(s) { return s.toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase()); }

// Busca la fila por el código de solicitud (ej. PV-0014) o por prefijo-fila (ej. GS-12).
function buscarFila(id) {
  id = String(id || '').trim();
  for (const h of HOJAS) {
    const sh = hoja(h);
    if (!sh || sh.getLastRow() < 2) continue;
    const col = mapa(encabezados(sh));
    if (col.codigo >= 0) {
      const v = sh.getRange(2, col.codigo + 1, sh.getLastRow() - 1, 1).getDisplayValues().map(r => String(r[0]).trim());
      const i = v.indexOf(id);
      if (i >= 0) return { h: h, sh: sh, fila: i + 2 };
    }
    if (id.indexOf(h.prefijo + '-') === 0) {
      const n = Number(id.slice(h.prefijo.length + 1));
      if (n >= 2) return { h: h, sh: sh, fila: n };
    }
  }
  return null;
}

// Redacta con IA el resumen para la orden de servicio y lo guarda en el Sheet.
function resumenIA(q) {
  const key = PropertiesService.getScriptProperties().getProperty('CLAUDE_API_KEY');
  if (!key) return { ok: false, error: 'sin_ia' };
  const f = buscarFila(q.id);
  if (!f) return { ok: false, error: 'id' };
  const head = encabezados(f.sh), g = gestion(f.sh, head);
  const d = f.sh.getRange(f.fila, 1, 1, head.length).getDisplayValues()[0];
  const texto = head.map((n, j) => (n && d[j] && GEST_NOMBRES.indexOf(n) < 0 ? n.replace(/_/g, ' ') + ': ' + d[j] : '')).filter(Boolean).join('\n');
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    payload: JSON.stringify({ model: MODELO_IA, max_tokens: 400, system: PROMPT_IA, messages: [{ role: 'user', content: 'Respuestas del formulario:\n' + texto }] })
  });
  if (res.getResponseCode() !== 200) return { ok: false, error: 'ia' };
  const j = JSON.parse(res.getContentText());
  const resumen = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('').trim();
  if (!resumen) return { ok: false, error: 'ia' };
  f.sh.getRange(f.fila, g.resumen + 1).setValue(resumen);
  return { ok: true, resumen: resumen };
}

// Crea una cita sin formulario, en la pestaña "Citas manuales" (se crea sola).
function crearCita(q) {
  const ss = libro(), cab = ['CODIGO_SOLICITUD', 'MARCA_TEMPORAL', 'NOMBRE_CONDUCTOR', 'TELEFONO_CONDUCTOR', 'PLACA', 'TIPO_VEHICULO', 'CIUDAD', 'TIPO_SOLICITUD', 'KM_ACTUAL', 'DESCRIPCION', 'ORIGEN'];
  let sh = ss.getSheetByName('Citas manuales');
  if (!sh) { sh = ss.insertSheet('Citas manuales'); sh.getRange(1, 1, 1, cab.length).setValues([cab]); }
  const g = gestion(sh, encabezados(sh)), lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const fila = sh.getLastRow() + 1, codigo = 'CM-' + ('000' + (fila - 1)).slice(-4);
    sh.getRange(fila, 1, 1, cab.length).setValues([[codigo, new Date(), q.nombre || 'Sin nombre registrado', q.telefono || '', String(q.placa || '').toUpperCase(), q.vehiculo === 'moto' ? 'Moto' : 'Carro', q.ciudad || '', q.tipo === 'falla' ? 'Falla' : 'Mantenimiento', q.km || '', q.desc || '', 'Creada desde el panel']]);
    const put = (k, v) => { if (v !== undefined && v !== null && v !== '') sh.getRange(fila, g[k] + 1).setValue(v); };
    put('estado', 'Agendada'); put('taller', q.taller); put('fecha', q.fecha); if (q.hora) put('hora', "'" + q.hora);
    put('trabajos', q.trabajos); put('obs', q.obs); put('primera', 'Sí'); put('act', new Date());
    put('servicio', q.servicio); put('dur', q.dur); put('bahia', q.bahia); put('rec', q.rec === 'ayu' ? 'Ayudante' : 'Técnico'); put('por', q.por);
    return { ok: true, id: codigo };
  } finally {
    lock.releaseLock();
  }
}

// Ajustes de capacidad y particularidades por día, guardados desde Configuración.
function ajustesLeer() {
  try { return JSON.parse(PropertiesService.getScriptProperties().getProperty('PANEL_AJUSTES') || '{}'); } catch (e) { return {}; }
}
function ajustesGuardar(q) {
  const t = JSON.stringify(q.ajustes || {});
  if (t.length > 9000) return { ok: false, error: 'grande' };
  PropertiesService.getScriptProperties().setProperty('PANEL_AJUSTES', t);
  return { ok: true };
}

// Lee "Información de Centros ECR" (horario y personal por día de la semana) y "Condiciones especiales" (cambios por fecha).
function disponibilidad() {
  if (!DISPONIBILIDAD.id) return null;
  const cache = CacheService.getScriptCache(), c0 = cache.get('disp');
  if (c0) return JSON.parse(c0);
  let res;
  try {
    const ss = SpreadsheetApp.openById(DISPONIBILIDAD.id), tz = ss.getSpreadsheetTimeZone();
    res = { semana: filasDisp(ss.getSheetByName(DISPONIBILIDAD.semana), tz, false), especiales: filasDisp(ss.getSheetByName(DISPONIBILIDAD.especiales), tz, true), leido: new Date().toISOString() };
  } catch (e) {
    return { error: String((e && e.message) || e) };
  }
  try { cache.put('disp', JSON.stringify(res), 60); } catch (e) {}
  return res;
}

function filasDisp(sh, tz, conFecha) {
  if (!sh || sh.getLastRow() < 2) return [];
  const rg = sh.getRange(1, 1, sh.getLastRow(), sh.getLastColumn()), v = rg.getValues(), d = rg.getDisplayValues();
  const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();
  const H = v[0].map(norm), c = k => H.indexOf(k), out = [];
  const ix = { id: c('ID CENTRO'), nombre: c('NOMBRE CENTRO'), ciudad: c('CIUDAD'), dia: c('DIA'), fecha: c('FECHA'), abre: c('ABRE'), apertura: c('HORA APERTURA'), recepcion: c('ULTIMA HORA RECEPCION'), descanso: c('DESCANSO'), cierre: c('HORA CIERRE'), bahias: c('BAHIAS OPERATIVAS'), fisicas: c('BAHIAS FISICAS DISPONIBLES'), tecnicos: c('CANTIDAD DE TECNICOS'), ayudantes: c('CANTIDAD DE AYUDANTES'), carros: c('ATIENDE CARROS'), motos: c('ATIENDE MOTOS'), preventivos: c('ATIENDE PREVENTIVOS'), correctivos: c('ATIENDE CORRECTIVOS'), obs: c('OBSERVACIONES ALCANCE SERVICIO') };
  const DIAS = ['DOMINGO', 'LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];
  for (let r = 1; r < v.length; r++) {
    const g = i => (i >= 0 ? v[r][i] : ''), gd = i => (i >= 0 ? d[r][i] : ''), si = i => /^s/i.test(String(g(i)).trim()), n = i => { const x = Number(g(i)); return isNaN(x) ? 0 : x; };
    const id = String(g(ix.id) || '').trim(); if (!id || id === '0') continue;
    const o = { id: id, nombre: String(g(ix.nombre) || '').trim(), ciudad: String(g(ix.ciudad) || '').trim(), abre: si(ix.abre), apertura: hora24(gd(ix.apertura)), recepcion: hora24(gd(ix.recepcion)), cierre: hora24(gd(ix.cierre)), descanso: n(ix.descanso), bahias: n(ix.bahias), fisicas: n(ix.fisicas), tecnicos: n(ix.tecnicos), ayudantes: n(ix.ayudantes), carros: si(ix.carros), motos: si(ix.motos), preventivos: si(ix.preventivos), correctivos: si(ix.correctivos), obs: String(g(ix.obs) || '').trim() };
    if (conFecha) { const f = g(ix.fecha); o.fecha = esFecha(f) ? Utilities.formatDate(f, tz, 'yyyy-MM-dd') : fechaIso(gd(ix.fecha)); if (!o.fecha) continue; }
    else { o.dia = DIAS.indexOf(norm(g(ix.dia))); if (o.dia < 0) continue; }
    out.push(o);
  }
  return out;
}

function hora24(s) {
  const m = /(\d{1,2}):(\d{2})(?::\d{2})?\s*([ap])?/i.exec(String(s || '').replace(/\./g, ''));
  if (!m) return '';
  let h = +m[1];
  if (m[3]) { const pm = /p/i.test(m[3]); if (pm && h < 12) h += 12; if (!pm && h === 12) h = 0; }
  return ('0' + h).slice(-2) + ':' + m[2];
}

function fechaIso(s) { const m = /(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(s || '')); return m ? m[3] + '-' + ('0' + m[2]).slice(-2) + '-' + ('0' + m[1]).slice(-2) : ''; }
