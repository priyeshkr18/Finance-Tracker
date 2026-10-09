'use strict';
const KEY = 'pennywise:v1';
const $ = (s, r = document) => r.querySelector(s);
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
const r2 = n => Math.round(n * 100) / 100;
const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') };
const today = () => iso(new Date());
const RED = '#E53935', GREEN = '#54C58A', GREY = '#6B6E75', AMBER = '#F2B84B';
const PAL = [RED, GREEN, AMBER, '#8E9099', '#B91C1C', '#3E8E66', '#C9A13B', '#5B5E66'];
const DEF = { currency: 'INR', dateFmt: 'DD/MM/YYYY', theme: 'dark', period: 'month' };
const NAV = [['overview', 'Overview', '▦'], ['transactions', 'Transactions', '⇄'], ['income', 'Income', '↓'], ['expenses', 'Expenses', '↑'], ['budgets', 'Budgets', '◔'], ['analytics', 'Analytics', '▤'], ['categories', 'Categories', '◇'], ['recurring', 'Recurring Payments', '↻'], ['goals', 'Savings Goals', '◎'], ['reports', 'Reports', '▥'], ['settings', 'Settings', '⚙']];
let S, pending = [], charts = [], BM = today().slice(0, 7);
const F = { q: '', type: '', cat: '', acc: '', from: '', to: '', sort: 'date', dir: -1, page: 1 };
const A = { from: '', to: '', cat: '' };
const RP = { from: '', to: '' };
const pages = {};

function h(t, a, ...c) { const e = document.createElement(t); for (const k in a || {}) { const v = a[k]; if (k === 'class') e.className = v; else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else if (v === true) e.setAttribute(k, ''); else if (v !== false && v != null) e.setAttribute(k, v) } c.flat(9).forEach(x => { if (x != null && x !== false) e.append(x.nodeType ? x : document.createTextNode(String(x))) }); return e }
const card = (t, ...c) => h('section', { class: 'card' }, t ? h('h3', null, t) : null, ...c);
const btn = (t, fn, cls = '', label) => h('button', { type: 'button', class: 'btn ' + cls, onclick: fn, 'aria-label': label || null }, t);
const stat = (l, v, c, s) => h('div', { class: 'card stat' }, h('span', { class: 'lbl' }, l), h('strong', { class: c || '' }, v), s ? h('small', null, s) : null);
const empty = (m, a) => h('div', { class: 'empty' }, h('p', null, m), a || null);
const bar = p => h('div', { class: 'bar' }, h('i', { class: p > 100 ? 'over' : p >= 80 ? 'warn' : '', style: 'width:' + Math.min(100, Math.max(0, p)) + '%' }));
const safeColor = c => /^#[0-9a-f]{6}$/i.test(c) ? c : '#777777';

function toast(m, bad) { const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: 'status' }, m); $('#toasts').append(t); setTimeout(() => t.remove(), 3400) }
function dlg(title, body) { const d = h('dialog', { class: 'modal', 'aria-label': title }, h('h2', null, title), body); d.addEventListener('close', () => d.remove()); document.body.append(d); d.showModal(); return d }
function confirmBox(msg, fn, label = 'Delete') { const d = dlg('Please confirm', h('div', { class: 'form' }, h('p', null, msg), h('div', { class: 'row end' }, btn('Cancel', () => d.close()), btn(label, () => { d.close(); fn() }, 'danger')))) }
function form(title, fields, init, onSave) {
	const f = h('form', { class: 'form', novalidate: true });
	fields.forEach(x => {
		const id = 'f_' + x.k; let i;
		if (x.t === 'select') i = h('select', { id, name: x.k }, x.o.map(o => h('option', { value: o[0] }, o[1])));
		else if (x.t === 'area') i = h('textarea', { id, name: x.k, rows: 2, maxlength: 300 });
		else i = h('input', { id, name: x.k, type: x.t || 'text', step: x.t === 'number' ? '0.01' : null, maxlength: x.t ? null : 80 });
		i.value = init[x.k] ?? x.d ?? '';
		f.append(h('label', { for: id }, x.l + (x.r ? ' *' : ''), i))
	});
	const err = h('p', { class: 'err', role: 'alert' });
	const ok = h('button', { type: 'submit', class: 'btn primary' }, 'Save');
	f.append(err, h('div', { class: 'row end' }, btn('Cancel', () => d.close()), ok));
	const d = dlg(title, f);
	f.addEventListener('submit', e => {
		e.preventDefault(); if (ok.disabled) return; const v = {};
		for (const x of fields) { const s = f.elements[x.k].value.trim(); if (x.r && !s) { err.textContent = 'Fill in: ' + x.l; return } v[x.k] = x.t === 'number' ? (s === '' ? NaN : parseFloat(s)) : s }
		const m = onSave(v); if (m) { err.textContent = m; return } ok.disabled = true; d.close()
	});
	const first = f.querySelector('input,select'); if (first) first.focus();
}

function lsGet() { try { return localStorage.getItem(KEY) } catch (e) { return null } }
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)) } catch (e) { toast('Could not save: browser storage is full or blocked.', true) } }
const arrs = ['accounts', 'categories', 'transactions', 'budgets', 'goals', 'recurring'];
function valid(d) { return !!d && typeof d === 'object' && d.version === 1 && arrs.every(k => Array.isArray(d[k])) && !!d.settings && typeof d.settings === 'object' && d.transactions.every(t => t && typeof t.id === 'string' && ['income', 'expense', 'transfer'].includes(t.type) && typeof t.amount === 'number' && isFinite(t.amount) && /^\d{4}-\d{2}-\d{2}$/.test(t.date)) && d.accounts.every(a => a && a.id && typeof a.name === 'string' && typeof a.opening === 'number') && d.categories.every(c => c && c.id && typeof c.name === 'string') && d.budgets.every(b => b && typeof b.amount === 'number') && d.goals.every(g => g && typeof g.target === 'number' && typeof g.saved === 'number' && Array.isArray(g.contribs)) && d.recurring.every(r => r && typeof r.amount === 'number' && /^\d{4}-\d{2}-\d{2}$/.test(r.next)) }
const defCats = () => [['c_food', 'Food', 'expense', '#E53935'], ['c_shop', 'Shopping', 'expense', '#B91C1C'], ['c_transport', 'Transport', 'expense', '#F2B84B'], ['c_education', 'Education', 'expense', '#8E9099'], ['c_ent', 'Entertainment', 'expense', '#C9A13B'], ['c_bills', 'Bills', 'expense', '#5B5E66'], ['c_health', 'Healthcare', 'expense', '#D96C6A'], ['c_other_e', 'Other expense', 'expense', '#6B6E75'], ['c_salary', 'Salary', 'income', '#54C58A'], ['c_freelance', 'Freelance', 'income', '#3E8E66'], ['c_invest', 'Investments', 'income', '#7FD6A8'], ['c_other_i', 'Other income', 'income', '#4F9C77']].map(c => ({ id: c[0], name: c[1], type: c[2], color: c[3] }));
function blank() { return { version: 1, settings: { ...DEF }, accounts: [{ id: 'a_cash', name: 'Cash', type: 'cash', opening: 0 }], categories: defCats(), transactions: [], budgets: [], goals: [], recurring: [] } }
function demo() {
	const d = blank(); d.accounts = [{ id: 'a_cash', name: 'Cash', type: 'cash', opening: 5000, demo: true }, { id: 'a_bank', name: 'Bank Account', type: 'bank', opening: 60000, demo: true }, { id: 'a_wal', name: 'Digital Wallet', type: 'wallet', opening: 3000, demo: true }];
	const now = new Date(), T = d.transactions;
	for (let i = 0; i < 4; i++) {
		const y = now.getFullYear(), m = now.getMonth() - i;
		const add = (type, desc, amount, day, category, account) => { const date = iso(new Date(y, m, day)); if (date <= today()) T.push({ id: uid(), type, desc, amount, date, category, account, notes: '', tags: '', demo: true }) };
		add('income', 'Salary', 72000, 1, 'c_salary', 'a_bank');
		if (i % 2 === 0) add('income', 'Freelance project', 14500, 12, 'c_freelance', 'a_bank');
		add('expense', 'Rent', 18000, 3, 'c_bills', 'a_bank');
		add('expense', 'Electricity bill', 2100 + i * 130, 8, 'c_bills', 'a_bank');
		add('expense', 'Groceries', 3200 + i * 210, 6, 'c_food', 'a_wal');
		add('expense', 'Restaurant', 1450 + i * 90, 14, 'c_food', 'a_cash');
		add('expense', 'Metro card', 900, 10, 'c_transport', 'a_wal');
		add('expense', 'Online course', 3499, 16, 'c_education', 'a_bank');
		add('expense', 'Movie night', 850, 18, 'c_ent', 'a_cash');
		add('expense', 'Clothes', 2799 + i * 150, 20, 'c_shop', 'a_bank');
		add('expense', 'Pharmacy', 640, 22, 'c_health', 'a_cash');
		add('income', 'Mutual fund returns', 1800, 25, 'c_invest', 'a_bank')
	}
	T.push({ id: uid(), type: 'transfer', desc: 'Move to wallet', amount: 4000, date: iso(new Date(now.getFullYear(), now.getMonth(), 1)), category: '', account: 'a_bank', to: 'a_wal', notes: '', tags: '', demo: true });
	d.budgets = [{ id: uid(), name: 'Food', category: 'c_food', amount: 6000, demo: true }, { id: uid(), name: 'Bills', category: 'c_bills', amount: 22000, demo: true }, { id: uid(), name: 'Shopping', category: 'c_shop', amount: 4000, demo: true }, { id: uid(), name: 'Monthly limit', category: '', amount: 45000, demo: true }];
	d.goals = [{ id: uid(), name: 'Emergency fund', target: 200000, saved: 45000, date: iso(new Date(now.getFullYear() + 1, now.getMonth(), 1)), desc: 'Six months of expenses', contribs: [], demo: true }, { id: uid(), name: 'New laptop', target: 90000, saved: 30000, date: iso(new Date(now.getFullYear(), now.getMonth() + 5, 1)), desc: '', contribs: [], demo: true }];
	d.recurring = [{ id: uid(), desc: 'Internet', amount: 999, type: 'expense', category: 'c_bills', account: 'a_bank', freq: 'monthly', next: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 5)), active: true, demo: true }, { id: uid(), desc: 'Streaming plan', amount: 649, type: 'expense', category: 'c_ent', account: 'a_bank', freq: 'monthly', next: iso(new Date(now.getFullYear(), now.getMonth(), now.getDate() + 12)), active: true, demo: true }];
	return d
}
function load() {
	const raw = lsGet();
	if (raw) {
		try { const d = JSON.parse(raw); if (valid(d)) { d.settings = { ...DEF, ...d.settings }; return d } } catch (e) { }
		try { localStorage.setItem(KEY + ':corrupt', raw) } catch (e) { }
		setTimeout(() => toast('Saved data could not be read. A copy was kept and sample data was loaded.', true), 400)
	}
	const d = demo(); try { localStorage.setItem(KEY, JSON.stringify(d)) } catch (e) { } return d
}

const money = n => { try { return new Intl.NumberFormat(S.settings.currency === 'INR' ? 'en-IN' : 'en-US', { style: 'currency', currency: S.settings.currency }).format(n) } catch (e) { return n.toFixed(2) } };
const fdate = s => { const [y, m, d] = s.split('-'); return S.settings.dateFmt === 'MM/DD/YYYY' ? m + '/' + d + '/' + y : S.settings.dateFmt === 'YYYY-MM-DD' ? s : d + '/' + m + '/' + y };
const monthLabel = ym => { const [y, m] = ym.split('-').map(Number); return new Date(y, m - 1, 1).toLocaleString('en', { month: 'long', year: 'numeric' }) };
const mRange = ym => { const [y, m] = ym.split('-').map(Number); return [iso(new Date(y, m - 1, 1)), iso(new Date(y, m, 0))] };
function range(p) {
	const n = new Date(), y = n.getFullYear(), m = n.getMonth();
	if (p === 'month') return [iso(new Date(y, m, 1)), iso(new Date(y, m + 1, 0))];
	if (p === '30d') return [iso(new Date(y, m, n.getDate() - 29)), today()];
	if (p === 'year') return [y + '-01-01', y + '-12-31'];
	return ['0000-01-01', '9999-12-31']
}
const PL = { month: 'This month', '30d': 'Last 30 days', year: 'This year', all: 'All time' };
const monthsBack = n => { const o = [], d = new Date(); for (let i = n - 1; i >= 0; i--) { const x = new Date(d.getFullYear(), d.getMonth() - i, 1); o.push([iso(x), iso(new Date(x.getFullYear(), x.getMonth() + 1, 0)), x.toLocaleString('en', { month: 'short', year: '2-digit' })]) } return o };

const tx = () => S.transactions;
const inR = (a, b) => tx().filter(t => t.date >= a && t.date <= b);
const sum = (l, ty) => r2(l.filter(t => t.type === ty).reduce((s, t) => s + t.amount, 0));
const accBal = a => r2(a.opening + tx().reduce((s, t) => { if (t.type === 'income' && t.account === a.id) return s + t.amount; if (t.type === 'expense' && t.account === a.id) return s - t.amount; if (t.type === 'transfer') { if (t.account === a.id) return s - t.amount; if (t.to === a.id) return s + t.amount } return s }, 0));
const cat = id => S.categories.find(c => c.id === id) || { id: '', name: 'Uncategorized', color: '#777777' };
const acc = id => S.accounts.find(a => a.id === id) || { id: '', name: 'Deleted account' };
const byCat = (l, ty) => { const m = {}; l.filter(t => t.type === ty).forEach(t => m[t.category] = r2((m[t.category] || 0) + t.amount)); return Object.entries(m).sort((a, b) => b[1] - a[1]) };
const byAcc = l => { const m = {}; l.filter(t => t.type === 'expense').forEach(t => m[t.account] = r2((m[t.account] || 0) + t.amount)); return Object.entries(m) };
const bSpent = (b, ym) => { const [a, z] = mRange(ym); return r2(inR(a, z).filter(t => t.type === 'expense' && (!b.category || t.category === b.category)).reduce((s, t) => s + t.amount, 0)) };
const gSaved = g => r2(g.saved + g.contribs.reduce((s, c) => s + c.amount, 0));
function adv(s, f) { const [y, m, d] = s.split('-').map(Number); if (f === 'weekly') return iso(new Date(y, m - 1, d + 7)); if (f === 'yearly') return iso(new Date(y + 1, m - 1, Math.min(d, new Date(y + 1, m, 0).getDate()))); return iso(new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()))) }
function runRec() { let n = 0; S.recurring.forEach(r => { if (!r.active) return; let g = 0; while (r.next <= today() && g++ < 400) { if (!tx().some(t => t.recurringId === r.id && t.date === r.next)) { S.transactions.push({ id: uid(), type: r.type, desc: r.desc, amount: r.amount, date: r.next, category: r.category, account: r.account, recurringId: r.id, tags: 'recurring', notes: '', demo: !!r.demo }); n++ } r.next = adv(r.next, r.freq) } }); if (n) save(); return n }
function insights() {
	const [a, b] = range(S.settings.period), l = inR(a, b), out = [], bc = byCat(l, 'expense'), inc = sum(l, 'income'), exp = sum(l, 'expense');
	if (bc.length) out.push('Largest spending category: ' + cat(bc[0][0]).name + ' (' + money(bc[0][1]) + ').');
	if (inc > 0) out.push('Savings rate: ' + Math.round((inc - exp) / inc * 100) + '% of income.');
	if (S.settings.period === 'month') { const n = new Date(), pe = sum(inR(iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))), 'expense'); if (pe > 0) out.push('Spending so far this month is ' + (exp >= pe ? 'up ' : 'down ') + Math.abs(Math.round((exp - pe) / pe * 100)) + '% against the full previous month.') }
	return out
}
function notices() {
	const o = [], ym = today().slice(0, 7); S.budgets.forEach(b => { const p = b.amount > 0 ? Math.round(bSpent(b, ym) / b.amount * 100) : 0; if (p >= 80) o.push(b.name + ' budget is at ' + p + '% this month.') });
	const lim = iso(new Date(Date.now() + 3 * 864e5)); S.recurring.filter(r => r.active && r.next <= lim).forEach(r => o.push(r.desc + ' is due on ' + fdate(r.next) + '.')); return o
}
function updateBell() { const n = notices().length, b = $('#badge'); b.textContent = n; b.hidden = !n }

function chart(title, type, labels, datasets, opts = {}) {
	const c = h('canvas', { role: 'img', 'aria-label': title }), box = h('section', { class: 'card' }, h('h3', null, title), h('div', { class: 'cv' }, c));
	if (datasets.every(d => d.data.every(v => !v))) box.lastChild.replaceWith(h('p', { class: 'empty' }, 'No data for this selection yet.'));
	else pending.push(() => {
		if (typeof Chart === 'undefined') { c.replaceWith(h('p', { class: 'empty' }, 'Charts could not load. Check your internet connection.')); return }
		const st = getComputedStyle(document.documentElement), tc = st.getPropertyValue('--t2').trim(), gc = st.getPropertyValue('--bd').trim();
		charts.push(new Chart(c, { type, data: { labels, datasets }, options: Object.assign({ responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: tc } }, tooltip: { callbacks: { label: x => (x.dataset.label ? x.dataset.label + ': ' : '') + (x.dataset.pct ? x.parsed.y + '%' : money(type === 'doughnut' ? x.parsed : x.parsed.y)) } } }, scales: type === 'doughnut' ? {} : { x: { ticks: { color: tc }, grid: { color: gc } }, y: { ticks: { color: tc }, grid: { color: gc } } } }, opts) }))
	});
	return box
}
function catChart(title, l, ty = 'expense') { const e = byCat(l, ty); return chart(title, 'doughnut', e.map(x => cat(x[0]).name), [{ data: e.map(x => x[1]), backgroundColor: e.map(x => safeColor(cat(x[0]).color)), borderColor: 'transparent' }]) }

function txForm(t, dup) {
	const isNew = !t || dup, ao = S.accounts.map(a => [a.id, a.name]);
	form(isNew ? 'Add transaction' : 'Edit transaction', [
		{ k: 'type', l: 'Type', t: 'select', o: [['expense', 'Expense'], ['income', 'Income'], ['transfer', 'Transfer']] },
		{ k: 'desc', l: 'Description or merchant', r: 1 }, { k: 'amount', l: 'Amount', t: 'number', r: 1 }, { k: 'date', l: 'Date', t: 'date', r: 1 },
		{ k: 'category', l: 'Category', t: 'select', o: [['', 'None (transfers only)'], ...S.categories.map(c => [c.id, c.name + ' (' + c.type + ')'])] },
		{ k: 'sub', l: 'Subcategory (optional)' },
		{ k: 'account', l: 'Account', t: 'select', o: ao }, { k: 'to', l: 'Transfer to account', t: 'select', o: [['', 'Not a transfer'], ...ao] },
		{ k: 'tags', l: 'Tags (comma separated)' }, { k: 'notes', l: 'Notes', t: 'area' }],
		t ? { ...t } : { type: 'expense', date: today(), account: S.accounts[0] && S.accounts[0].id },
		v => {
			if (!(v.amount > 0)) return 'Amount must be greater than zero.';
			if (!S.accounts.some(a => a.id === v.account)) return 'Choose an account.';
			if (v.type === 'transfer') { if (!v.to || v.to === v.account) return 'Pick a different destination account.'; v.category = '' }
			else { v.to = ''; if (cat(v.category).type !== v.type || !v.category) return 'Choose a ' + v.type + ' category.' }
			const o = { ...(t || {}), ...v, amount: r2(v.amount), id: isNew ? uid() : t.id };
			if (dup) { delete o.demo; delete o.recurringId }
			if (isNew) S.transactions.push(o); else S.transactions = S.transactions.map(x => x.id === o.id ? o : x);
			save(); toast(dup ? 'Transaction duplicated' : isNew ? 'Transaction added' : 'Transaction updated'); render()
		})
}
function delTx(t) { confirmBox('Delete "' + t.desc + '" (' + money(t.amount) + ')?', () => { S.transactions = S.transactions.filter(x => x.id !== t.id); save(); toast('Transaction deleted'); render() }) }
function filtered(ty) {
	const q = F.q.toLowerCase(), k = t => { const v = F.sort === 'category' ? cat(t.category).name : F.sort === 'account' ? acc(t.account).name : t[F.sort]; return typeof v === 'string' ? v.toLowerCase() : v };
	return tx().filter(t => (!ty || t.type === ty) && (!F.type || t.type === F.type) && (!F.cat || t.category === F.cat) && (!F.acc || t.account === F.acc || t.to === F.acc) && (!F.from || t.date >= F.from) && (!F.to || t.date <= F.to) && (!q || [t.desc, t.notes, t.tags, t.sub, cat(t.category).name, t.id].join(' ').toLowerCase().includes(q))).sort((x, y) => { const p = k(x), z = k(y); return (p < z ? -1 : p > z ? 1 : 0) * F.dir })
}
const csv = rows => rows.map(r => r.map(c => { let s = String(c == null ? '' : c); if (/^[=+\-@]/.test(s) && isNaN(Number(s))) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"' }).join(',')).join('\n');
function dl(name, text, type) { const a = h('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name }); document.body.append(a); a.click(); a.remove() }
const txCsv = l => csv([['ID', 'Date', 'Type', 'Description', 'Category', 'Subcategory', 'Account', 'To account', 'Amount', 'Tags', 'Notes'], ...l.map(t => [t.id, t.date, t.type, t.desc, t.type === 'transfer' ? 'Transfer' : cat(t.category).name, t.sub || '', acc(t.account).name, t.to ? acc(t.to).name : '', t.amount.toFixed(2), t.tags || '', t.notes || ''])]);
function amt(t) { return h('span', { class: t.type === 'income' ? 'pos' : t.type === 'expense' ? 'neg' : 'mut' }, (t.type === 'income' ? '▲ +' : t.type === 'expense' ? '▼ −' : '⇄ ') + money(t.amount)) }
function filterBar(ty) {
	const sel = (k, l, o) => h('label', null, l, h('select', { onchange: e => { F[k] = e.target.value; F.page = 1; render() } }, [['', 'All'], ...o].map(x => h('option', { value: x[0], selected: F[k] === x[0] }, x[1]))));
	const inp = (k, l, t) => h('label', null, l, h('input', { type: t, value: F[k], onchange: e => { F[k] = e.target.value; F.page = 1; render() } }));
	return h('div', { class: 'filters card' }, inp('q', 'Search', 'search'), ty ? null : sel('type', 'Type', [['income', 'Income'], ['expense', 'Expense'], ['transfer', 'Transfer']]), sel('cat', 'Category', S.categories.filter(c => !ty || c.type === ty).map(c => [c.id, c.name])), sel('acc', 'Account', S.accounts.map(a => [a.id, a.name])), inp('from', 'From', 'date'), inp('to', 'To', 'date'), btn('Clear filters', () => { Object.assign(F, { q: '', type: '', cat: '', acc: '', from: '', to: '', page: 1 }); render() }), btn('Export CSV', () => { const l = filtered(ty); dl('pennywise-transactions-' + today() + '.csv', txCsv(l), 'text/csv'); toast('Exported ' + l.length + ' transactions') }))
}
function txTable(l) {
	const N = 15, pc = Math.max(1, Math.ceil(l.length / N)); F.page = Math.min(F.page, pc); const rows = l.slice((F.page - 1) * N, F.page * N);
	const cols = [['date', 'Date'], ['desc', 'Description'], ['category', 'Category'], ['account', 'Account'], ['amount', 'Amount']];
	if (!l.length) return empty('No transactions match these filters.', btn('+ Add Transaction', () => txForm(), 'primary'));
	return h('div', null, h('div', { class: 'tw' }, h('table', { class: 'tbl' },
		h('thead', null, h('tr', null, cols.map(c => h('th', { scope: 'col', 'aria-sort': F.sort === c[0] ? (F.dir > 0 ? 'ascending' : 'descending') : 'none' }, h('button', { class: 'th', type: 'button', onclick: () => { F.dir = F.sort === c[0] ? -F.dir : 1; F.sort = c[0]; render() } }, c[1] + (F.sort === c[0] ? (F.dir > 0 ? ' ▲' : ' ▼') : '')))), h('th', { scope: 'col' }, 'Actions'))),
		h('tbody', null, rows.map(t => h('tr', null,
			h('td', { 'data-label': 'Date' }, fdate(t.date)),
			h('td', { 'data-label': 'Description' }, t.desc + ' ', t.demo ? h('span', { class: 'tag' }, 'Demo') : null),
			h('td', { 'data-label': 'Category' }, t.type === 'transfer' ? 'Transfer' : [h('span', { class: 'dot', style: 'background:' + safeColor(cat(t.category).color) }), cat(t.category).name + (t.sub ? ' / ' + t.sub : '')]),
			h('td', { 'data-label': 'Account' }, t.type === 'transfer' ? acc(t.account).name + ' to ' + acc(t.to).name : acc(t.account).name),
			h('td', { 'data-label': 'Amount' }, amt(t)),
			h('td', { 'data-label': 'Actions' }, h('div', { class: 'row' }, btn('Edit', () => txForm(t), '', 'Edit ' + t.desc), btn('Copy', () => txForm(t, true), '', 'Duplicate ' + t.desc), btn('Delete', () => delTx(t), 'danger', 'Delete ' + t.desc)))))))),
		h('div', { class: 'row between', style: 'margin-top:12px' }, h('span', { class: 'mut' }, l.length + ' transactions, page ' + F.page + ' of ' + pc), h('div', { class: 'row' }, h('button', { class: 'btn', type: 'button', disabled: F.page <= 1, onclick: () => { F.page--; render() } }, 'Previous'), h('button', { class: 'btn', type: 'button', disabled: F.page >= pc, onclick: () => { F.page++; render() } }, 'Next'))))
}
function txPage(ty) {
	const l = filtered(ty), inc = sum(l, 'income'), exp = sum(l, 'expense');
	const cards = ty === 'income' ? [stat('Total income', money(inc), 'pos'), stat('Transactions', l.length), stat('Average', money(l.length ? r2(inc / l.length) : 0))] : ty === 'expense' ? [stat('Total expenses', money(exp), 'neg'), stat('Transactions', l.length), stat('Average', money(l.length ? r2(exp / l.length) : 0))] : [stat('Income', money(inc), 'pos'), stat('Expenses', money(exp), 'neg'), stat('Transactions', l.length)];
	return h('div', { class: 'page' }, h('div', { class: 'row between wrap' }, h('h2', null, ty === 'income' ? 'Income' : ty === 'expense' ? 'Expenses' : 'All transactions'), btn('+ Add Transaction', () => txForm(), 'primary')),
		h('div', { class: 'grid3' }, cards), filterBar(ty), ty ? h('div', { class: 'grid2' }, catChart(ty === 'income' ? 'Income sources' : 'Expense categories', l, ty), card('Recent activity', l.length ? h('ul', { class: 'list' }, l.slice(0, 6).map(t => h('li', null, h('span', null, t.desc + ', ' + fdate(t.date)), amt(t)))) : empty('Nothing recorded yet.'))) : null,
		card(null, txTable(l)))
}
pages.transactions = () => txPage(''); pages.income = () => txPage('income'); pages.expenses = () => txPage('expense');

function periodSelect() { return h('select', { 'aria-label': 'Reporting period', style: 'width:auto', onchange: e => { S.settings.period = e.target.value; save(); render() } }, Object.entries(PL).map(x => h('option', { value: x[0], selected: S.settings.period === x[0] }, x[1]))) }
function budgetCard(b, ym, full) {
	const sp = bSpent(b, ym), p = b.amount > 0 ? Math.round(sp / b.amount * 100) : 0, left = r2(b.amount - sp);
	return h('div', { class: 'card' }, h('div', { class: 'row between wrap' }, h('h3', null, b.name + (b.demo ? ' (demo)' : '')), full ? h('div', { class: 'row' }, btn('Edit', () => budgetForm(b), '', 'Edit ' + b.name), btn('Delete', () => confirmBox('Delete budget "' + b.name + '"?', () => { S.budgets = S.budgets.filter(x => x.id !== b.id); save(); toast('Budget deleted'); render() }), 'danger', 'Delete ' + b.name)) : null),
		h('p', { class: 'mut' }, (b.category ? cat(b.category).name : 'All spending') + ', ' + monthLabel(ym)), bar(p),
		h('div', { class: 'row between' }, h('span', null, money(sp) + ' of ' + money(b.amount)), h('strong', null, p + '%')),
		h('p', { class: p > 100 ? 'neg' : p >= 80 ? 'warnt' : 'mut' }, p > 100 ? 'Over budget by ' + money(-left) : p >= 80 ? 'Approaching limit, ' + money(left) + ' left' : money(left) + ' remaining'))
}
function budgetForm(b) { form(b ? 'Edit budget' : 'New budget', [{ k: 'name', l: 'Budget name', r: 1 }, { k: 'category', l: 'Category', t: 'select', o: [['', 'All spending'], ...S.categories.filter(c => c.type === 'expense').map(c => [c.id, c.name])] }, { k: 'amount', l: 'Monthly amount', t: 'number', r: 1 }], b || {}, v => { if (!(v.amount > 0)) return 'Amount must be greater than zero.'; const o = { ...(b || {}), ...v, amount: r2(v.amount), id: b ? b.id : uid() }; S.budgets = b ? S.budgets.map(x => x.id === o.id ? o : x) : [...S.budgets, o]; save(); toast(b ? 'Budget updated' : 'Budget created'); render() }) }
pages.budgets = () => h('div', { class: 'page' }, h('div', { class: 'row between wrap' }, h('label', { class: 'inl' }, 'Month', h('input', { type: 'month', value: BM, onchange: e => { if (e.target.value) { BM = e.target.value; render() } } })), btn('+ New Budget', () => budgetForm(), 'primary')), S.budgets.length ? h('div', { class: 'grid3' }, S.budgets.map(b => budgetCard(b, BM, true))) : empty('No budgets yet. Create one to track spending against a limit.'));

function goalCard(g, full) {
	const s = gSaved(g), p = g.target > 0 ? Math.round(s / g.target * 100) : 0, done = s >= g.target;
	return h('div', { class: 'card' }, h('div', { class: 'row between wrap' }, h('h3', null, g.name + (g.demo ? ' (demo)' : '')), h('span', { class: 'tag' }, done ? 'Completed' : 'In progress')),
		h('p', { class: 'mut' }, (g.desc || '') + (g.date ? ' Target date: ' + fdate(g.date) : '')), bar(Math.min(p, 100)),
		h('div', { class: 'row between' }, h('span', null, money(s) + ' of ' + money(g.target)), h('strong', null, p + '%')), h('p', { class: 'mut' }, done ? 'Goal reached.' : money(r2(g.target - s)) + ' remaining'),
		full ? h('div', { class: 'row wrap', style: 'margin-top:8px' }, btn('Contribute', () => contribForm(g), 'primary'), btn('Edit', () => goalForm(g), '', 'Edit ' + g.name), btn('Delete', () => confirmBox('Delete goal "' + g.name + '"?', () => { S.goals = S.goals.filter(x => x.id !== g.id); save(); toast('Goal deleted'); render() }), 'danger', 'Delete ' + g.name)) : null,
		full && g.contribs.length ? h('ul', { class: 'list' }, g.contribs.map(c => h('li', null, h('span', null, fdate(c.date) + ', ' + money(c.amount)), h('span', { class: 'row' }, btn('Edit', () => contribForm(g, c), '', 'Edit contribution'), btn('Remove', () => { g.contribs = g.contribs.filter(x => x.id !== c.id); save(); toast('Contribution removed'); render() }, 'danger', 'Remove contribution'))))) : null)
}
function goalForm(g) { form(g ? 'Edit goal' : 'New savings goal', [{ k: 'name', l: 'Goal name', r: 1 }, { k: 'target', l: 'Target amount', t: 'number', r: 1 }, { k: 'saved', l: 'Current saved amount', t: 'number', d: '0' }, { k: 'date', l: 'Target date', t: 'date' }, { k: 'desc', l: 'Description (optional)' }], g || {}, v => { if (!(v.target > 0)) return 'Target must be greater than zero.'; if (isNaN(v.saved) || v.saved < 0) return 'Saved amount cannot be negative.'; const o = { ...(g || {}), ...v, target: r2(v.target), saved: r2(v.saved), contribs: g ? g.contribs : [], id: g ? g.id : uid() }; S.goals = g ? S.goals.map(x => x.id === o.id ? o : x) : [...S.goals, o]; save(); toast(g ? 'Goal updated' : 'Goal created'); render() }) }
function contribForm(g, c) { form(c ? 'Edit contribution' : 'Add contribution', [{ k: 'amount', l: 'Amount', t: 'number', r: 1 }, { k: 'date', l: 'Date', t: 'date', r: 1, d: today() }], c || {}, v => { if (!(v.amount > 0)) return 'Amount must be greater than zero.'; if (c) { c.amount = r2(v.amount); c.date = v.date } else g.contribs.push({ id: uid(), amount: r2(v.amount), date: v.date }); save(); toast(c ? 'Contribution updated' : 'Contribution added'); render() }) }
pages.goals = () => h('div', { class: 'page' }, h('div', { class: 'row between' }, h('h2', null, 'Savings goals'), btn('+ New Goal', () => goalForm(), 'primary')), S.goals.length ? h('div', { class: 'grid3' }, S.goals.map(g => goalCard(g, true))) : empty('No goals yet. Set a target and start contributing.'));

function recForm(r) { const ao = S.accounts.map(a => [a.id, a.name]); form(r ? 'Edit recurring payment' : 'New recurring payment', [{ k: 'type', l: 'Type', t: 'select', o: [['expense', 'Expense'], ['income', 'Income']] }, { k: 'desc', l: 'Description', r: 1 }, { k: 'amount', l: 'Amount', t: 'number', r: 1 }, { k: 'category', l: 'Category', t: 'select', o: S.categories.map(c => [c.id, c.name + ' (' + c.type + ')']) }, { k: 'account', l: 'Account', t: 'select', o: ao }, { k: 'freq', l: 'Frequency', t: 'select', o: [['weekly', 'Weekly'], ['monthly', 'Monthly'], ['yearly', 'Yearly']] }, { k: 'next', l: 'Next due date', t: 'date', r: 1 }], r || { type: 'expense', freq: 'monthly', next: today(), account: S.accounts[0] && S.accounts[0].id }, v => { if (!(v.amount > 0)) return 'Amount must be greater than zero.'; if (cat(v.category).type !== v.type || !v.category) return 'Choose a ' + v.type + ' category.'; if (!S.accounts.some(a => a.id === v.account)) return 'Choose an account.'; const o = { ...(r || { active: true }), ...v, amount: r2(v.amount), id: r ? r.id : uid() }; S.recurring = r ? S.recurring.map(x => x.id === o.id ? o : x) : [...S.recurring, o]; const n = runRec(); save(); toast(n ? n + ' due transaction(s) added' : r ? 'Recurring payment updated' : 'Recurring payment created'); render() }) }
pages.recurring = () => {
	const l = [...S.recurring].sort((a, b) => a.next < b.next ? -1 : 1); return h('div', { class: 'page' }, h('div', { class: 'row between wrap' }, h('h2', null, 'Recurring payments'), btn('+ New Recurring Payment', () => recForm(), 'primary')), h('p', { class: 'banner' }, 'Pennywise runs in your browser only. Due entries are added when you open or reload the app, not in the background, and no notifications are sent while the browser is closed. Each due date creates at most one transaction.'),
		l.length ? card(null, h('div', { class: 'tw' }, h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Description', 'Frequency', 'Next due', 'Amount', 'Status', 'Actions'].map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, l.map(r => h('tr', null, h('td', { 'data-label': 'Description' }, r.desc), h('td', { 'data-label': 'Frequency' }, r.freq), h('td', { 'data-label': 'Next due' }, fdate(r.next)), h('td', { 'data-label': 'Amount' }, amt(r)), h('td', { 'data-label': 'Status' }, r.active ? 'Active' : 'Paused'), h('td', { 'data-label': 'Actions' }, h('div', { class: 'row' }, btn(r.active ? 'Pause' : 'Resume', () => { r.active = !r.active; const n = runRec(); save(); toast(r.active ? 'Resumed' : 'Paused'); render() }, '', 'Toggle ' + r.desc), btn('Edit', () => recForm(r), '', 'Edit ' + r.desc), btn('Delete', () => confirmBox('Delete "' + r.desc + '"? Past generated transactions stay.', () => { S.recurring = S.recurring.filter(x => x.id !== r.id); save(); toast('Recurring payment deleted'); render() }), 'danger', 'Delete ' + r.desc))))))))) : empty('No recurring payments yet.'))
};

function catForm(c) { form(c ? 'Edit category' : 'New category', [{ k: 'name', l: 'Name', r: 1 }, { k: 'type', l: 'Type', t: 'select', o: [['expense', 'Expense'], ['income', 'Income']] }, { k: 'color', l: 'Color', t: 'color', d: '#E53935' }], c || { type: 'expense' }, v => { if (S.categories.some(x => x.id !== (c && c.id) && x.name.toLowerCase() === v.name.toLowerCase() && x.type === v.type)) return 'A category with that name already exists.'; if (c && c.type !== v.type && tx().some(t => t.category === c.id)) return 'This category has transactions, so its type cannot change.'; const o = { ...(c || {}), ...v, color: safeColor(v.color), id: c ? c.id : 'c_' + uid() }; S.categories = c ? S.categories.map(x => x.id === o.id ? o : x) : [...S.categories, o]; save(); toast(c ? 'Category updated' : 'Category created'); render() }) }
function delCat(c) { const n = tx().filter(t => t.category === c.id).length, fb = c.type === 'income' ? 'c_other_i' : 'c_other_e'; confirmBox(n ? n + ' transaction(s) use "' + c.name + '". They will move to "' + cat(fb).name + '". Delete anyway?' : 'Delete category "' + c.name + '"?', () => { S.transactions.forEach(t => { if (t.category === c.id) t.category = fb }); S.recurring.forEach(t => { if (t.category === c.id) t.category = fb }); S.budgets = S.budgets.filter(b => b.category !== c.id); S.categories = S.categories.filter(x => x.id !== c.id); save(); toast('Category deleted'); render() }) }
pages.categories = () => {
	const col = ty => card(ty === 'expense' ? 'Expense categories' : 'Income categories', h('ul', { class: 'list' }, S.categories.filter(c => c.type === ty).map(c => h('li', null, h('span', null, h('span', { class: 'sw', style: 'background:' + safeColor(c.color) }), ' ' + c.name), h('span', { class: 'row' }, btn('Edit', () => catForm(c), '', 'Edit ' + c.name), c.id.startsWith('c_other') ? null : btn('Delete', () => delCat(c), 'danger', 'Delete ' + c.name))))));
	return h('div', { class: 'page' }, h('div', { class: 'row between' }, h('h2', null, 'Categories'), btn('+ New Category', () => catForm(), 'primary')), h('div', { class: 'grid2' }, col('expense'), col('income')))
};

pages.analytics = () => {
	const mk = monthsBack(6), from = A.from || mk[0][0], to = A.to || today(), base = tx().filter(t => !A.cat || t.category === A.cat), l = base.filter(t => t.date >= from && t.date <= to);
	const days = {}; l.filter(t => t.type === 'expense').forEach(t => days[t.date] = r2((days[t.date] || 0) + t.amount)); const dk = Object.keys(days).sort();
	const mi = mk.map(m => sum(base.filter(t => t.date >= m[0] && t.date <= m[1]), 'income')), me = mk.map(m => sum(base.filter(t => t.date >= m[0] && t.date <= m[1]), 'expense'));
	const ym = today().slice(0, 7), ba = byAcc(l);
	return h('div', { class: 'page' }, h('div', { class: 'filters card' }, h('label', null, 'From', h('input', { type: 'date', value: from, onchange: e => { A.from = e.target.value; render() } })), h('label', null, 'To', h('input', { type: 'date', value: to, onchange: e => { A.to = e.target.value; render() } })), h('label', null, 'Category', h('select', { onchange: e => { A.cat = e.target.value; render() } }, [['', 'All categories'], ...S.categories.map(c => [c.id, c.name])].map(o => h('option', { value: o[0], selected: A.cat === o[0] }, o[1])))), btn('Reset', () => { Object.assign(A, { from: '', to: '', cat: '' }); render() })),
		h('div', { class: 'grid2' },
			chart('Monthly income vs expenses', 'bar', mk.map(m => m[2]), [{ label: 'Income', data: mi, backgroundColor: GREEN }, { label: 'Expenses', data: me, backgroundColor: RED }]),
			chart('Daily spending', 'line', dk.map(fdate), [{ label: 'Spending', data: dk.map(k => days[k]), borderColor: RED, backgroundColor: RED, tension: .25 }]),
			catChart('Expenses by category', l), catChart('Income sources', l, 'income'),
			chart('Savings rate by month (%)', 'line', mk.map(m => m[2]), [{ label: 'Savings rate', pct: 1, data: mi.map((v, i) => v > 0 ? Math.round((v - me[i]) / v * 100) : 0), borderColor: GREEN, backgroundColor: GREEN, tension: .25 }]),
			chart('Monthly cash flow', 'bar', mk.map(m => m[2]), [{ label: 'Net cash flow', data: mi.map((v, i) => r2(v - me[i])), backgroundColor: mi.map((v, i) => v - me[i] >= 0 ? GREEN : RED) }]),
			chart('Budget vs actual, ' + monthLabel(ym), 'bar', S.budgets.map(b => b.name), [{ label: 'Budget', data: S.budgets.map(b => b.amount), backgroundColor: GREY }, { label: 'Actual', data: S.budgets.map(b => bSpent(b, ym)), backgroundColor: RED }]),
			chart('Spending by account', 'doughnut', ba.map(x => acc(x[0]).name), [{ data: ba.map(x => x[1]), backgroundColor: PAL, borderColor: 'transparent' }])),
		card('Insights', insights().length ? h('ul', { class: 'list' }, insights().map(x => h('li', null, x))) : empty('Add more transactions to see insights.')))
};

pages.reports = () => {
	const [ma, mb] = range('month'), from = RP.from || ma, to = RP.to || mb, l = inR(from, to), inc = sum(l, 'income'), exp = sum(l, 'expense'), ec = byCat(l, 'expense'), mk = monthsBack(6);
	return h('div', { class: 'page' }, h('div', { class: 'filters card noprint' }, h('label', null, 'From', h('input', { type: 'date', value: from, onchange: e => { RP.from = e.target.value; render() } })), h('label', null, 'To', h('input', { type: 'date', value: to, onchange: e => { RP.to = e.target.value; render() } })), btn('Download CSV', () => { dl('pennywise-report-' + from + '-to-' + to + '.csv', csv([['Report', from + ' to ' + to], ['Income', inc.toFixed(2)], ['Expenses', exp.toFixed(2)], ['Net savings', r2(inc - exp).toFixed(2)], [], ['Category', 'Amount', 'Share %'], ...ec.map(x => [cat(x[0]).name, x[1].toFixed(2), exp ? (x[1] / exp * 100).toFixed(1) : '0']), [], ['Month', 'Income', 'Expenses', 'Net'], ...mk.map(m => { const q = inR(m[0], m[1]); return [m[2], sum(q, 'income').toFixed(2), sum(q, 'expense').toFixed(2), r2(sum(q, 'income') - sum(q, 'expense')).toFixed(2)] })]), 'text/csv'); toast('Report downloaded') }), btn('Print or save as PDF', () => window.print(), 'primary')),
		h('h2', null, 'Pennywise report: ' + fdate(from) + ' to ' + fdate(to)),
		h('div', { class: 'grid3' }, stat('Income', money(inc), 'pos'), stat('Expenses', money(exp), 'neg'), stat('Net savings', money(r2(inc - exp)), inc >= exp ? 'pos' : 'neg')),
		card('Expense breakdown', ec.length ? h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Category', 'Amount', 'Share'].map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, ec.map(x => h('tr', null, h('td', { 'data-label': 'Category' }, cat(x[0]).name), h('td', { 'data-label': 'Amount' }, money(x[1])), h('td', { 'data-label': 'Share' }, Math.round(x[1] / exp * 100) + '%'))))) : empty('No expenses in this period.')),
		card('Monthly comparison', h('table', { class: 'tbl' }, h('thead', null, h('tr', null, ['Month', 'Income', 'Expenses', 'Net'].map(x => h('th', { scope: 'col' }, x)))), h('tbody', null, mk.map(m => { const q = inR(m[0], m[1]), i = sum(q, 'income'), e = sum(q, 'expense'); return h('tr', null, h('td', { 'data-label': 'Month' }, m[2]), h('td', { 'data-label': 'Income' }, money(i)), h('td', { 'data-label': 'Expenses' }, money(e)), h('td', { 'data-label': 'Net' }, money(r2(i - e)))) })))))
};

function accForm(a) { form(a ? 'Edit account' : 'New account', [{ k: 'name', l: 'Account name', r: 1 }, { k: 'type', l: 'Type', t: 'select', o: [['cash', 'Cash'], ['bank', 'Bank account'], ['wallet', 'Digital wallet']] }, { k: 'opening', l: 'Opening balance', t: 'number', d: '0' }], a || {}, v => { if (isNaN(v.opening)) return 'Enter an opening balance.'; const o = { ...(a || {}), ...v, opening: r2(v.opening), id: a ? a.id : 'a_' + uid() }; S.accounts = a ? S.accounts.map(x => x.id === o.id ? o : x) : [...S.accounts, o]; save(); toast(a ? 'Account updated' : 'Account created'); render() }) }
function exportJson() { dl('pennywise-backup-' + today() + '.json', JSON.stringify(S, null, 2), 'application/json'); toast('Backup downloaded') }
function importFile(file) {
	if (!file) return; const rd = new FileReader(); rd.onload = () => {
		let d; try { d = JSON.parse(rd.result) } catch (e) { toast('Import failed: the file is not valid JSON.', true); return }
		if (!valid(d)) { toast('Import failed: the file is not a valid Pennywise version 1 backup.', true); return }
		const d2 = dlg('Import preview', h('div', { class: 'form' }, h('p', null, 'This file contains ' + d.transactions.length + ' transactions, ' + d.accounts.length + ' accounts, ' + d.categories.length + ' categories, ' + d.budgets.length + ' budgets, ' + d.goals.length + ' goals and ' + d.recurring.length + ' recurring payments.'), h('p', { class: 'neg' }, 'Importing replaces all current data. Download a backup first if you may need it.'), h('div', { class: 'row end wrap' }, btn('Download current backup', exportJson), btn('Cancel', () => d2.close()), btn('Replace my data', () => { d.settings = { ...DEF, ...d.settings }; S = d; save(); d2.close(); applyTheme(); toast('Data imported'); render() }, 'danger'))))
	}; rd.readAsText(file)
}
function applyTheme() { document.documentElement.dataset.theme = S.settings.theme }
pages.settings = () => {
	const set = (k, l, o) => h('label', { class: 'inl' }, l, h('select', { onchange: e => { S.settings[k] = e.target.value; save(); applyTheme(); toast('Setting saved'); render() } }, o.map(x => h('option', { value: x[0], selected: S.settings[k] === x[0] }, x[1]))));
	const hasDemo = [...tx(), ...S.budgets, ...S.goals, ...S.recurring, ...S.accounts].some(x => x.demo);
	return h('div', { class: 'page' }, h('h2', null, 'Settings'),
		card('Preferences', h('div', { class: 'row wrap' }, set('currency', 'Currency', [['INR', 'INR (₹)'], ['USD', 'USD ($)'], ['EUR', 'EUR (€)'], ['GBP', 'GBP (£)']]), set('dateFmt', 'Date format', [['DD/MM/YYYY', 'DD/MM/YYYY'], ['MM/DD/YYYY', 'MM/DD/YYYY'], ['YYYY-MM-DD', 'YYYY-MM-DD']]), set('theme', 'Theme', [['dark', 'Dark'], ['light', 'Light']]), set('period', 'Default period', Object.entries(PL))), h('p', { class: 'mut' }, 'Changing currency changes display formatting only. Stored amounts are never converted.')),
		card('Accounts', h('ul', { class: 'list' }, S.accounts.map(a => h('li', null, h('span', null, a.name + ' (' + a.type + '), opening ' + money(a.opening) + ', balance ' + money(accBal(a))), h('span', { class: 'row' }, btn('Edit', () => accForm(a), '', 'Edit ' + a.name), btn('Delete', () => { if (tx().some(t => t.account === a.id || t.to === a.id) || S.recurring.some(r => r.account === a.id)) toast('This account has transactions. Move or delete them first.', true); else if (S.accounts.length < 2) toast('Keep at least one account.', true); else confirmBox('Delete account "' + a.name + '"?', () => { S.accounts = S.accounts.filter(x => x.id !== a.id); save(); toast('Account deleted'); render() }) }, 'danger', 'Delete ' + a.name))))), btn('+ New Account', () => accForm(), 'primary')),
		card('Data control', h('p', { class: 'mut' }, 'Data lives in this browser only (localStorage). Clearing site data removes it, so back up regularly.'), h('div', { class: 'row wrap', style: 'margin-top:10px' }, btn('Export backup (JSON)', exportJson), h('label', { class: 'btn' }, 'Import backup', h('input', { type: 'file', accept: 'application/json,.json', hidden: true, onchange: e => { importFile(e.target.files[0]); e.target.value = '' } })), hasDemo ? btn('Remove demo data', () => confirmBox('Remove all sample records? Your own records stay.', () => { S.transactions = S.transactions.filter(x => !x.demo); S.budgets = S.budgets.filter(x => !x.demo); S.goals = S.goals.filter(x => !x.demo); S.recurring = S.recurring.filter(x => !x.demo); const used = new Set(tx().flatMap(t => [t.account, t.to])); S.accounts = S.accounts.filter(a => !a.demo || used.has(a.id)); if (!S.accounts.length) S.accounts = blank().accounts; save(); toast('Demo data removed'); render() }, 'Remove demo data')) : null, btn('Reset demo data', () => confirmBox('Replace all data with fresh sample data?', () => { const s = S.settings; S = demo(); S.settings = s; save(); toast('Demo data restored'); render() }, 'Reset'), 'danger'), btn('Erase everything', () => confirmBox('This permanently deletes every transaction, budget, goal, account and setting. It cannot be undone.', () => { S = blank(); save(); applyTheme(); toast('All data erased'); render() }, 'Erase everything'), 'danger'))))
};

pages.overview = () => {
	const [a, b] = range(S.settings.period), l = inR(a, b), inc = sum(l, 'income'), exp = sum(l, 'expense'), net = r2(inc - exp), total = r2(S.accounts.reduce((s, x) => s + accBal(x), 0)), mk = monthsBack(6);
	let has = false, pi = 0, pe = 0; if (S.settings.period === 'month') { const n = new Date(), pl = inR(iso(new Date(n.getFullYear(), n.getMonth() - 1, 1)), iso(new Date(n.getFullYear(), n.getMonth(), 0))); has = pl.length > 0; pi = sum(pl, 'income'); pe = sum(pl, 'expense') }
	const chg = (c, p) => has && p > 0 ? (c >= p ? '+' : '') + Math.round((c - p) / p * 100) + '% vs last month' : '';
	const hr = new Date().getHours(), g = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening', ym = today().slice(0, 7);
	const rec = S.recurring.filter(r => r.active).sort((x, y) => x.next < y.next ? -1 : 1).slice(0, 4), ins = insights(), demoOn = tx().some(t => t.demo);
	return h('div', { class: 'page' },
		demoOn ? h('p', { class: 'banner' }, 'Sample data is loaded. Records tagged Demo are examples; remove them any time in Settings.') : null,
		h('div', { class: 'row between wrap' }, h('div', null, h('h2', null, g), h('p', { class: 'mut' }, new Date().toLocaleDateString('en-IN', { dateStyle: 'full' }) + ', ' + PL[S.settings.period])), h('div', { class: 'row' }, periodSelect(), btn('+ Add Transaction', () => txForm(), 'primary'))),
		h('div', { class: 'grid4' }, stat('Total Balance', money(total), '', 'All accounts'), stat('Total Income', money(inc), 'pos', chg(inc, pi)), stat('Total Expenses', money(exp), 'neg', chg(exp, pe)), stat('Net Savings', money(net), net >= 0 ? 'pos' : 'neg', inc ? Math.round(net / inc * 100) + '% of income' : '')),
		h('div', { class: 'grid2' }, chart('Income vs expenses, last 6 months', 'bar', mk.map(m => m[2]), [{ label: 'Income', data: mk.map(m => sum(inR(m[0], m[1]), 'income')), backgroundColor: GREEN }, { label: 'Expenses', data: mk.map(m => sum(inR(m[0], m[1]), 'expense')), backgroundColor: RED }]), catChart('Expenses by category', l)),
		h('div', { class: 'grid2' }, card('Recent transactions', tx().length ? h('ul', { class: 'list' }, [...tx()].sort((x, y) => x.date < y.date ? 1 : -1).slice(0, 6).map(t => h('li', null, h('span', null, t.desc + ', ' + fdate(t.date)), amt(t)))) : empty('No transactions yet.', btn('+ Add Transaction', () => txForm(), 'primary'))),
			card('Budgets, ' + monthLabel(ym), S.budgets.length ? h('div', { class: 'page' }, S.budgets.slice(0, 3).map(x => budgetCard(x, ym, false))) : empty('No budgets yet.', h('a', { href: '#budgets', class: 'btn' }, 'Create a budget')))),
		h('div', { class: 'grid3' }, card('Savings goals', S.goals.length ? h('div', { class: 'page' }, S.goals.slice(0, 2).map(x => goalCard(x, false))) : empty('No goals yet.', h('a', { href: '#goals', class: 'btn' }, 'Set a goal'))),
			card('Upcoming recurring payments', rec.length ? h('ul', { class: 'list' }, rec.map(r => h('li', null, h('span', null, r.desc + ', ' + fdate(r.next)), amt(r)))) : empty('Nothing scheduled.')),
			card('Insights', ins.length ? h('ul', { class: 'list' }, ins.map(x => h('li', null, x))) : empty('Add more transactions to see insights.'))))
};

function render() {
	charts.splice(0).forEach(c => c.destroy()); pending = [];
	const id = NAV.some(n => n[0] === location.hash.slice(1)) ? location.hash.slice(1) : 'overview';
	document.querySelectorAll('#nav a').forEach(a => { const on = a.dataset.p === id; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current') });
	$('#title').textContent = NAV.find(n => n[0] === id)[1];
	$('#main').replaceChildren(pages[id]());
	pending.forEach(f => f()); pending = []; updateBell()
}

function boot() {
	S = load(); applyTheme();
	$('#nav').append(...NAV.map(n => h('a', { href: '#' + n[0], 'data-p': n[0] }, h('span', { class: 'i', 'aria-hidden': 'true' }, n[2]), h('span', { class: 'l' }, n[1]))));
	$('#collapse').addEventListener('click', () => document.body.classList.toggle('min'));
	$('#theme').addEventListener('click', () => { S.settings.theme = S.settings.theme === 'dark' ? 'light' : 'dark'; save(); applyTheme(); render() });
	$('#bell').addEventListener('click', () => { const n = notices(), d = dlg('Notifications', h('div', { class: 'form' }, n.length ? h('ul', { class: 'list' }, n.map(x => h('li', null, x))) : h('p', { class: 'mut' }, 'You are all caught up.'), h('div', { class: 'row end' }, btn('Close', () => d.close())))) });
	$('#q').addEventListener('change', e => { F.q = e.target.value.trim(); F.page = 1; if (location.hash === '#transactions') render(); else location.hash = '#transactions' });
	window.addEventListener('hashchange', () => { render(); $('#main').focus({ preventScroll: true }) });
	const n = runRec(); if (n) setTimeout(() => toast(n + ' recurring transaction(s) added'), 300);
	render()
}
document.addEventListener('DOMContentLoaded', boot);