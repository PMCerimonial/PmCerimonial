// IndexedDB: armazenamento transacional da fila e da lista offline.
// Não usa Cache Storage para dados dos convidados.
const DATABASE = 'pm-cerimonial-local-v2';
const STORE = 'registros';
let connection;

function openDB() {
  if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB indisponível neste dispositivo.'));
  if (!connection) {
    connection = new Promise((resolve, reject) => {
      const request = indexedDB.open(DATABASE, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        resolve(db);
      };
      request.onerror = () => reject(request.error || new Error('Banco local indisponível.'));
      request.onblocked = () => reject(new Error('Outra aba bloqueou a abertura do banco local.'));
    }).catch(error => {connection = null; throw error;});
  }
  return connection;
}

async function read(key) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result ?? null);
    req.onerror = () => reject(req.error || new Error('Falha ao ler armazenamento local.'));
    tx.onabort = () => reject(tx.error || new Error('Leitura local cancelada.'));
  });
}

async function write(key, value) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    // Só confirmar depois do commit, nunca em request.onsuccess.
    tx.oncomplete = () => resolve(true);
    tx.onerror = () => reject(tx.error || new Error('Não foi possível salvar no dispositivo.'));
    tx.onabort = () => reject(tx.error || new Error('Gravação local cancelada.'));
  });
}

// Serializar substituições da fila: não sobrescrever com conclusão antiga.
let queueWrite = Promise.resolve();
export function readQueue(eventoId) {
  return queueWrite.then(async () => {
    const value = await read(`fila:${eventoId}`);
    return Array.isArray(value) ? value : [];
  });
}
export function saveQueue(eventoId, items) {
  const copy = structuredClone(items);
  queueWrite = queueWrite.catch(() => {}).then(() => write(`fila:${eventoId}`, copy));
  return queueWrite;
}
export function readEventCache(eventoId) { return read(`evento:${eventoId}`); }
export function saveEventCache(eventoId, cache) { return write(`evento:${eventoId}`, cache); }

export function loadLocal(key) {
  try {return JSON.parse(localStorage.getItem(key) || 'null');} catch {return null;}
}
export function saveLocal(key, value) {
  try {localStorage.setItem(key, JSON.stringify(value)); return true;} catch {return false;}
}
export function makePending({eventoId,convidadoId,nome,mesa,recepcionista,desejado}) {
  if (!globalThis.crypto?.randomUUID) throw new Error('Identificador seguro indisponível.');
  return {id:crypto.randomUUID(),eventoId,convidadoId,nome,mesa,recepcionista,desejado,status:'aguardando',criadoEm:new Date().toISOString()};
}
export function installOffline() {
  if(typeof window==='undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/pm-sw.js').catch(() => {});
}
