/* data access: one place that knows where the JSON/HTML fragments live */
import { getJSON, getText } from './dom.js';

const B = 'app/data/';
export const toc = () => getJSON(B + 'toc.json');
export const glossary = () => getJSON(B + 'glossary.json');
export const tasks = () => getJSON(B + 'tasks.json');
export const tests = () => getJSON(B + 'tests.json');
export const docs = () => getJSON(B + 'docs.json');
export const searchIndex = () => getJSON(B + 'search.json');
export const lecture = (id) => getText(B + 'lec/' + id + '.html');

let idx = null;
/** derived lookups over the table of contents */
export async function index() {
  if (idx) return idx;
  const t = await toc();
  const lectures = [];
  const byTopic = new Map();
  t.topics.forEach((tp) => {
    byTopic.set(tp.n, tp);
    tp.lectures.forEach((l) => lectures.push(Object.assign({ topic: tp.n }, l)));
  });
  lectures.forEach((l, i) => { l.prev = lectures[i - 1] || null; l.next = lectures[i + 1] || null; l.i = i; });
  const byLec = new Map(lectures.map((l) => [l.id, l]));
  const labs = new Map(t.labs.map((l) => [l.id, l]));
  idx = { toc: t, topics: t.topics, lectures, byTopic, byLec, labs, labList: t.labs };
  return idx;
}
