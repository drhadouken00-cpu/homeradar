import { readFile, writeFile, rename } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const catalogFile = new URL('../public/catalog.json', import.meta.url);
const tempFile = new URL('../public/catalog.json.tmp', import.meta.url);
const array = value => Array.isArray(value) ? value : value == null ? [] : [value];

export function parseSumario(body, day) {
  const summary = body?.data?.sumario;
  const date = summary?.metadatos?.fecha_publicacion ?? summary?.metadatos?.fecha;
  if (String(body?.status?.code) !== '200' || date !== day || !array(summary.diario).length) {
    throw new Error('Sumario BOE inesperado: ' + day);
  }
  const items = array(summary.diario).flatMap(issue =>
    array(issue.sumario_diario?.seccion ?? issue.seccion).flatMap(section =>
      array(section.departamento).flatMap(department =>
        [...array(department.item), ...array(department.epigrafe).flatMap(group => array(group.item))]
      )
    )
  );
  if (!items.length) throw new Error('Sumario BOE sin entradas: ' + day);
  return items.flatMap(item => {
    const { identificador: id, titulo: title } = item;
    if (!/^BOE-[AB]-\d{4}-\d+$/.test(id ?? '') || typeof title !== 'string') return [];
    if (!/\b(madrid|madrileñ\w*)\b/i.test(title) || !/\b(viviendas?|alquiler|arrendamiento|habitacional)\b/i.test(title)) return [];
    if (/subasta|juzgado|notar[ií]a/i.test(title)) return [];
    return [{
      id, title, category: 'Boletines', town: 'Comunidad de Madrid',
      operation: 'Por confirmar', stage: 'Documento publicado',
      summary: 'Referencia temática del sumario. Consulta el documento para saber si contiene algún trámite, ámbito de aplicación o plazo.',
      url: 'https://www.boe.es/diario_boe/txt.php?id=' + id,
      application: null, dwellings: null, price: null,
      source: 'Agencia Estatal Boletín Oficial del Estado',
      published: day.replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3')
    }];
  });
}

async function fetchDay(day) {
  const response = await fetch('https://www.boe.es/datosabiertos/api/boe/sumario/' + day, {
    headers: {Accept:'application/json', 'User-Agent':'HomeRadar/1.0 (public housing reference index)'},
    redirect: 'error', signal: AbortSignal.timeout(15000)
  });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('BOE HTTP ' + response.status);
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = '';
  try {
    while (true) {
      const {done, value} = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 5_000_000) throw new Error('Sumario demasiado grande');
      text += decoder.decode(value, {stream:true});
    }
    return parseSumario(JSON.parse(text + decoder.decode()), day);
  } finally {
    await reader.cancel().catch(() => {});
  }
}

export async function update(loadDay = fetchDay, now = new Date()) {
  const old = JSON.parse(await readFile(catalogFile,'utf8'));
  if (old.version !== 1 || !Array.isArray(old.records) || !old.records.length) throw new Error('Índice previo inválido');
  const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/Madrid',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
  const anchor = Date.parse(today + 'T12:00:00Z');
  const merged = new Map(old.records.map(row => [row.id,row]));
  let boeThrough = old.boeThrough;
  let errors = 0;
  let available = 0;
  for (let offset = 4; offset >= 0; offset--) {
    const date = new Date(anchor - offset * 86400000).toISOString().slice(0,10);
    try {
      const entries = await loadDay(date.replaceAll('-',''));
      if (entries === null) continue;
      available++;
      for (const row of entries) merged.set(row.id, row);
      if (!boeThrough || date > boeThrough) boeThrough = date;
    } catch (error) {
      errors++;
      console.error(date, error.message);
      if (/HTTP (429|403)/.test(error.message)) break;
    }
  }
  if (!available && errors) throw new Error('BOE no disponible. Se conserva el índice anterior.');
  if (!available) return false;
  const manual = [...merged.values()].filter(row => !row.published);
  const boe = [...merged.values()].filter(row => row.published).sort((a,b) =>
    b.published.localeCompare(a.published) || a.id.localeCompare(b.id)
  ).slice(0,200);
  const records = [...manual,...boe];
  if (JSON.stringify(records) === JSON.stringify(old.records) && boeThrough === old.boeThrough) return false;
  const snapshot = {version:1, updatedAt:now.toISOString(), boeThrough, records};
  await writeFile(tempFile, JSON.stringify(snapshot,null,2) + '\n');
  await rename(tempFile,catalogFile);
  console.log('Índice actualizado. Días con errores:',errors);
  return true;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await update();

