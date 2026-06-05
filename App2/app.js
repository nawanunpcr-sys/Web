// ===== CONFIG =====
const SUPABASE_URL = 'https://exugnmdsyqbqtxsrwhbm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV4dWdubWRzeXFicXR4c3J3aGJtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0NTAxMDMsImV4cCI6MjA5NjAyNjEwM30.HGAGiO0ixPct17SwExWPo-NZpF2KdFPjQa3BLmc10kk';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let allLaws = [];
let allEvalRecords = [];
let lawCategories = [];
let deptLaws = [];
let currentAnalysis = null;
let currentSkillTab = 'summary';

// Build <option> list for the law categories (LA–LF)
function categoryOptions(selected) {
  return '<option value="">-- เลือกหมวด --</option>' +
    lawCategories.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${c.id} — ${(c.name_th || '').slice(0, 40)}</option>`).join('');
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  loadDashboard();
  loadLawsForSelect();
});

// ===== NAVIGATION =====
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  document.querySelector(`[data-page="${page}"]`).classList.add('active');
  const labels = {
    dashboard: 'แดชบอร์ด', gazette: 'ดึงข้อมูลราชกิจจาฯ',
    laws: 'ฐานข้อมูลกฎหมาย', departments: 'มอบหมายหน่วยงาน', analyze: 'วิเคราะห์ AI',
    compliance: 'บันทึกการปฏิบัติตาม', evaluation: 'ผลการประเมินความสอดคล้อง'
  };
  document.getElementById('breadcrumb').textContent = labels[page] || page;
  if (page === 'laws') loadLawsTable();
  if (page === 'departments') loadDepartmentsPage();
  if (page === 'compliance') loadCompliancePage();
  if (page === 'evaluation') loadEvaluationPage();
}

function toggleSidebar() { document.getElementById('sidebar').classList.toggle('open'); }

// ===== TOAST =====
function showToast(msg, type = 'info') {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.className = `toast ${type} show`;
  setTimeout(() => t.classList.remove('show'), 3500);
}

// ===== GAZETTE =====
async function fetchFromGazette() {
  const url = document.getElementById('gazetteUrl').value.trim();
  const keyword = document.getElementById('gazetteKeyword').value.trim();
  if (!url && !keyword) { showToast('กรุณากรอก URL หรือคำค้นหา', 'error'); return; }
  document.getElementById('gazetteSpinner').style.display = 'inline';
  document.getElementById('gazetteResults').innerHTML = '<div class="loading-state">กำลังดึงข้อมูลจากราชกิจจาฯ...</div>';
  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 1000,
        messages: [{ role: 'user', content: `คุณเป็นผู้เชี่ยวชาญด้านกฎหมายความปลอดภัยและอาชีวอนามัยไทย กรุณาค้นหาและสรุปข้อมูลกฎหมายจากราชกิจจานุเบกษา
URL: ${url||'ไม่ระบุ'} คำค้นหา: ${keyword||'ไม่ระบุ'}
ตอบเป็น JSON array (3-5 รายการ) โดยใช้รหัสหมวดต่อไปนี้: LA=บริหารจัดการ, LB=ไฟฟ้าและพลังงาน, LC=อัคคีภัย, LD=สภาพแวดล้อม, LE=เครื่องจักร, LF=Service
[{"law_code":"รหัส เช่น LA-040","category":"LA","ministry":"กระทรวง/หน่วยงานผู้ออก","title":"ชื่อกฎหมายเต็ม","summary":"สรุปสาระสำคัญ","announced_date":"วันที่ประกาศ","effective_date":"วันที่มีผลบังคับ","responsible_unit":"หน่วยงานที่ควรรับผิดชอบ","check_frequency":"ความถี่การตรวจสอบ"}]
ตอบเฉพาะ JSON เท่านั้น` }]
      })
    });
    const data = await res.json();
    const results = JSON.parse(data.content.find(b => b.type==='text').text.replace(/```json|```/g,'').trim());
    window._gazetteResults = results;
    document.getElementById('gazetteResults').innerHTML = results.length
      ? results.map((item, i) => `<div class="gazette-item" onclick="previewGazetteLaw(${i})">
          <div class="gazette-item-title">${item.title}</div>
          <div class="gazette-item-meta">${item.ministry||'—'} · ${item.announced_date||'—'} · ${item.category||'—'}</div>
        </div>`).join('')
      : '<div class="empty-state">ไม่พบข้อมูล</div>';
  } catch(e) {
    document.getElementById('gazetteResults').innerHTML = '<div class="empty-state">เกิดข้อผิดพลาด</div>';
    showToast('เกิดข้อผิดพลาด: ' + e.message, 'error');
  } finally { document.getElementById('gazetteSpinner').style.display = 'none'; }
}

function previewGazetteLaw(index) {
  const law = window._gazetteResults[index];
  document.querySelectorAll('.gazette-item').forEach((el,i) => el.style.borderColor = i===index?'var(--gold)':'');
  document.getElementById('gazettePreview').style.display = 'block';
  document.getElementById('gazettePreviewContent').innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
      <div class="form-group"><label>รหัสกฎหมาย *</label><input class="input" id="prev-id" value="${law.law_code||''}" placeholder="เช่น LA-040" /></div>
      <div class="form-group"><label>หมวดหมู่ *</label><select class="input" id="prev-category">${categoryOptions(law.category)}</select></div>
      <div class="form-group" style="grid-column:1/-1"><label>ชื่อกฎหมาย *</label><input class="input" id="prev-title" value="${law.title||''}" /></div>
      <div class="form-group"><label>หน่วยงานผู้ออก (กระทรวง)</label><input class="input" id="prev-ministry" value="${law.ministry||''}" /></div>
      <div class="form-group"><label>หน่วยงานที่รับผิดชอบ</label><input class="input" id="prev-responsible" value="${law.responsible_unit||''}" /></div>
      <div class="form-group"><label>วันที่ประกาศ</label><input class="input" id="prev-announced" value="${law.announced_date||''}" placeholder="เช่น 1 ม.ค. 2567" /></div>
      <div class="form-group"><label>วันที่มีผลบังคับ</label><input class="input" id="prev-effective" value="${law.effective_date||''}" /></div>
      <div class="form-group"><label>ความถี่การตรวจสอบ</label><input class="input" id="prev-frequency" value="${law.check_frequency||''}" placeholder="เช่น รายปี" /></div>
      <div class="form-group"><label>สถานะการปฏิบัติตาม</label><select class="input" id="prev-status">
        <option value="N/A" selected>— ยังไม่ประเมิน (N/A)</option>
        <option value="C">✓ สอดคล้อง (C)</option>
        <option value="NC">✗ ไม่สอดคล้อง (NC)</option>
      </select></div>
      <div class="form-group" style="grid-column:1/-1"><label>สรุปสาระสำคัญ</label><textarea class="input textarea" id="prev-summary" rows="3">${law.summary||''}</textarea></div>
    </div>`;
}

async function saveToDatabase() {
  const law = {
    id: document.getElementById('prev-id').value.trim(),
    category_id: document.getElementById('prev-category').value || null,
    title: document.getElementById('prev-title').value.trim(),
    ministry: document.getElementById('prev-ministry').value || null,
    responsible_unit: document.getElementById('prev-responsible').value || null,
    announced_date: document.getElementById('prev-announced').value || null,
    effective_date: document.getElementById('prev-effective').value || null,
    check_frequency: document.getElementById('prev-frequency').value || null,
    compliance_status: document.getElementById('prev-status').value || 'N/A',
    summary: document.getElementById('prev-summary').value || null,
    is_cancelled: false
  };
  if (!law.id || !law.title) { showToast('กรุณากรอกรหัสและชื่อกฎหมาย', 'error'); return; }
  const { error } = await sb.from('laws').insert([law]);
  if (error) { showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); }
  else { showToast('✓ บันทึกกฎหมายลงทะเบียนเรียบร้อยแล้ว', 'success'); document.getElementById('gazettePreview').style.display='none'; loadDashboard(); loadLawsForSelect(); }
}


// ===== DASHBOARD =====
async function loadDashboard() {
  try {
    const [{ data: laws }, { data: cats }] = await Promise.all([
      sb.from('laws').select('id, title, compliance_status, check_frequency, is_cancelled, category_id'),
      sb.from('law_categories').select('id, name_th')
    ]);
    allLaws = laws || [];
    lawCategories = cats || [];
    const active = allLaws.filter(l => !l.is_cancelled);
    const compliant = active.filter(l => l.compliance_status === 'C').length;
    const nc = active.filter(l => l.compliance_status === 'NC').length;
    const evaluated = compliant + nc; // laws marked C or NC (exclude N/A from the rate)
    const pct = evaluated ? Math.round((compliant / evaluated) * 100) : null;

    document.getElementById('stat-total').textContent = active.length;
    document.getElementById('stat-compliant').textContent = compliant;
    document.getElementById('stat-critical').textContent = nc;
    document.getElementById('stat-pct').textContent = pct != null ? pct + '%' : '—';

    renderDashboardCategories(active, cats || []);

    document.getElementById('recentLaws').innerHTML = active.slice(0, 8).map(l => `
      <div class="law-item" onclick="navigate('analyze')">
        <span class="law-code">${l.id}</span>
        <span class="law-title">${l.title}</span>
        ${complianceStatusBadge(l.compliance_status)}
        <span class="status-badge" style="font-size:11px;color:var(--text-muted)">${l.check_frequency||'—'}</span>
      </div>`).join('');
  } catch (e) { console.error(e); showToast('ไม่สามารถโหลดข้อมูลได้', 'error'); }
}

// Register of laws grouped by category, with compliance % computed from the laws table
function renderDashboardCategories(activeLaws, cats) {
  const nameById = Object.fromEntries(cats.map(c => [c.id, c.name_th]));
  const groups = {};
  activeLaws.forEach(l => {
    const cid = l.category_id || 'unknown';
    const g = groups[cid] || (groups[cid] = { total: 0, c: 0, nc: 0, na: 0 });
    g.total++;
    if (l.compliance_status === 'C') g.c++;
    else if (l.compliance_status === 'NC') g.nc++;
    else g.na++;
  });
  const ids = Object.keys(groups).sort();
  const el = document.getElementById('dashboardCategories');
  if (!ids.length) { el.innerHTML = '<div class="empty-state">ไม่มีข้อมูลกฎหมาย</div>'; return; }
  el.innerHTML = ids.map(cid => {
    const g = groups[cid];
    const evaluated = g.c + g.nc;
    const pct = evaluated ? Math.round((g.c / evaluated) * 100) : 100;
    const col = pct >= 90 ? '#2a9d8f' : pct >= 70 ? '#e9c46a' : '#e63946';
    const fullName = nameById[cid] || cid;
    const label = fullName.length > 40 ? fullName.slice(0, 40) + '…' : fullName;
    return `<div class="eval-bar-row">
      <div class="eval-bar-label" title="${fullName}">${cid} — ${label}
        <span style="color:var(--text-muted);font-size:11px"> (${g.total} ฉบับ · NC ${g.nc})</span>
      </div>
      <div class="eval-bar-track"><div class="eval-bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="eval-bar-score" style="color:${col}">${pct}%</div>
    </div>`;
  }).join('');
}

function complianceStatusBadge(s) {
  const map = { C: ['var(--green)', '✓ สอดคล้อง'], NC: ['var(--red)', '✗ ไม่สอดคล้อง'], 'N/A': ['var(--text-muted)', '— N/A'] };
  const [col, label] = map[s] || ['var(--text-muted)', s || '—'];
  return `<span class="status-badge" style="color:${col};border-color:${col};background:${col}18;font-family:var(--font-mono);font-size:11px">${label}</span>`;
}

// ===== LAWS TABLE (new schema) =====
async function loadLawsTable() {
  document.getElementById('lawsTable').innerHTML = '<div class="loading-state">กำลังโหลด...</div>';
  const { data } = await sb.from('laws').select('*, law_categories(name_th)').order('id');
  allLaws = data || [];
  renderLawsTable(allLaws);
}

function renderLawsTable(laws) {
  if (!laws.length) { document.getElementById('lawsTable').innerHTML = '<div class="empty-state">ไม่พบกฎหมาย</div>'; return; }
  document.getElementById('lawsTable').innerHTML = `<table>
    <thead><tr><th>รหัส</th><th>ชื่อกฎหมาย</th><th>หมวด</th><th>ความถี่ตรวจสอบ</th><th>สถานะ</th><th>ยกเลิก</th><th></th></tr></thead>
    <tbody>${laws.map(l => `<tr style="${l.is_cancelled?'opacity:0.4':''}">
      <td class="law-code-cell">${l.id}</td>
      <td class="law-title-cell">${l.title}</td>
      <td style="font-size:12px;color:var(--text-muted)">${l.law_categories?.name_th ? l.law_categories.name_th.slice(0,30)+'…' : '—'}</td>
      <td style="font-size:12px;font-family:var(--font-mono)">${l.check_frequency||'—'}</td>
      <td>${complianceStatusBadge(l.compliance_status)}</td>
      <td style="text-align:center">${l.is_cancelled?'<span style="color:var(--red)">ยกเลิก</span>':'<span style="color:var(--green)">ใช้งาน</span>'}</td>
      <td><button class="btn-sm btn-primary" onclick="quickAnalyze('${l.id}')">วิเคราะห์</button></td>
    </tr>`).join('')}</tbody></table>`;
}

function filterLaws() {
  const q = document.getElementById('lawSearch').value.toLowerCase();
  const s = document.getElementById('lawStatusFilter').value;
  const p = document.getElementById('lawPriorityFilter').value; // reused as category filter
  renderLawsTable(allLaws.filter(l =>
    (!q || l.title.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) &&
    (!s || l.compliance_status === s) &&
    (!p || l.category_id === p)
  ));
}

// ===== EVALUATION DASHBOARD (new schema) =====
async function loadEvaluationPage() {
  try {
    const [{ data: laws }, { data: cats }, { data: summaries }, { data: regDocs }] = await Promise.all([
      sb.from('laws').select('id, title, compliance_status, check_frequency, is_cancelled, category_id, last_review_date, responsible_unit'),
      sb.from('law_categories').select('id, name_th, total_laws, compliant_count, non_compliant_count'),
      sb.from('compliance_summary').select('*, law_categories(name_th)').order('year', { ascending: false }),
      sb.from('regulatory_documents').select('*').order('seq_no')
    ]);

    const active = (laws||[]).filter(l => !l.is_cancelled);
    allEvalRecords = active;

    const counts = { C:0, NC:0, 'N/A':0 };
    active.forEach(l => { counts[l.compliance_status] = (counts[l.compliance_status]||0)+1; });
    const total = active.length;
    const pct = total ? Math.round((counts.C / total) * 100) : null;

    document.getElementById('eval-compliant').textContent = counts.C;
    document.getElementById('eval-partial').textContent = counts['N/A'];
    document.getElementById('eval-noncompliant').textContent = counts.NC;
    document.getElementById('eval-avg-score').textContent = pct != null ? pct + '%' : '—';

    drawDonut({ compliant: counts.C, partial: counts['N/A'], non_compliant: counts.NC });
    drawGauge(pct);
    drawBarsByCategory(cats || []);
    renderAlerts(active);
    renderRegDocTable(regDocs || []);
    populateYearFilter(summaries || []);
    renderEvalTable(active);
  } catch(e) { console.error(e); showToast('โหลดข้อมูลประเมินไม่สำเร็จ', 'error'); }
}

// Donut chart of C / N/A / NC counts
function drawDonut(counts) {
  const svg = document.getElementById('donutChart');
  const legend = document.getElementById('donutLegend');
  const segs = [
    { label: 'สอดคล้อง (C)', value: counts.compliant || 0, color: '#2a9d8f' },
    { label: 'ไม่เกี่ยวข้อง (N/A)', value: counts.partial || 0, color: '#457b9d' },
    { label: 'ไม่สอดคล้อง (NC)', value: counts.non_compliant || 0, color: '#e63946' }
  ];
  const total = segs.reduce((s, x) => s + x.value, 0);
  const r = 70, cx = 100, cy = 100, C = 2 * Math.PI * r;
  let offset = 0;
  let html = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#1a1e28" stroke-width="26"/>`;
  if (total) {
    segs.forEach(s => {
      if (!s.value) return;
      const len = (s.value / total) * C;
      html += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${s.color}" stroke-width="26"
        stroke-dasharray="${len} ${C - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 ${cx} ${cy})"/>`;
      offset += len;
    });
  }
  html += `<text x="${cx}" y="${cy - 2}" text-anchor="middle" fill="#e8eaf0" font-size="30" font-weight="700">${total}</text>
           <text x="${cx}" y="${cy + 18}" text-anchor="middle" fill="#7a8090" font-size="12">ฉบับ</text>`;
  svg.innerHTML = html;
  legend.innerHTML = segs.map(s => `<div class="legend-item"><span class="legend-dot" style="background:${s.color}"></span>${s.label} — <b style="margin-left:4px">${s.value}</b></div>`).join('');
}

// Semicircular gauge of the overall compliance percentage
function drawGauge(pct) {
  const svg = document.getElementById('gaugeChart');
  const label = document.getElementById('gaugeLabel');
  const sub = document.getElementById('gaugeSub');
  const v = pct == null ? 0 : Math.max(0, Math.min(100, pct));
  const r = 90, cx = 110, cy = 110;
  const polar = deg => [cx + r * Math.cos(Math.PI * deg / 180), cy - r * Math.sin(Math.PI * deg / 180)];
  const arc = (startDeg, endDeg, color, width) => {
    const [x1, y1] = polar(startDeg), [x2, y2] = polar(endDeg);
    return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round"/>`;
  };
  const col = v >= 90 ? '#2a9d8f' : v >= 70 ? '#e9c46a' : '#e63946';
  let html = arc(180, 0, '#1a1e28', 16);
  if (pct != null && v > 0) html += arc(180, 180 - (v / 100) * 180, col, 16);
  svg.innerHTML = html;
  label.textContent = pct == null ? '—' : v + '%';
  label.style.color = col;
  sub.textContent = pct == null ? 'ยังไม่มีข้อมูลประเมิน' : (v >= 90 ? 'อยู่ในเกณฑ์ดีมาก' : v >= 70 ? 'ควรปรับปรุงบางส่วน' : 'ต้องเร่งแก้ไข');
}

function drawBarsByCategory(cats) {
  if (!cats.length) { document.getElementById('evalBarsContainer').innerHTML = '<div class="empty-state">ไม่มีข้อมูล</div>'; return; }
  document.getElementById('evalBarsContainer').innerHTML = cats.map(c => {
    const total = c.total_laws || 1;
    const pct = Math.round((c.compliant_count / Math.max(c.compliant_count + c.non_compliant_count, 1)) * 100);
    const col = pct >= 90 ? '#2a9d8f' : pct >= 70 ? '#e9c46a' : '#e63946';
    const label = c.name_th.length > 36 ? c.name_th.slice(0,36)+'…' : c.name_th;
    return `<div class="eval-bar-row">
      <div class="eval-bar-label" title="${c.name_th}">${c.id} — ${label}</div>
      <div class="eval-bar-track"><div class="eval-bar-fill" style="width:${pct}%;background:${col}"></div></div>
      <div class="eval-bar-score" style="color:${col}">${pct}%</div>
    </div>`;
  }).join('');
}

function renderAlerts(active) {
  const nc = active.filter(l => l.compliance_status === 'NC');
  document.getElementById('evalAlerts').innerHTML = nc.length
    ? nc.slice(0,10).map(l=>`<div class="alert-item">
        <div class="alert-item-title">${l.title}</div>
        <div class="alert-item-meta">${l.id} · ผู้รับผิดชอบ: ${l.responsible_unit||'—'} · ความถี่: ${l.check_frequency||'—'}</div>
        ${l.last_review_date?`<div style="font-size:11px;color:var(--text-muted);margin-top:4px">ตรวจสอบล่าสุด: ${l.last_review_date}</div>`:''}
      </div>`).join('')
    : '<div class="empty-state" style="padding:20px">✓ ไม่มีรายการที่ไม่สอดคล้อง</div>';
}

function renderRegDocTable(docs) {
  const container = document.getElementById('evalDetailTable');
  if (!docs.length) { container.innerHTML = '<div class="empty-state">ไม่มีข้อมูลเอกสาร</div>'; return; }
  container.innerHTML = `<table>
    <thead><tr><th>ลำดับ</th><th>ชื่อเอกสาร</th><th>กำหนดยื่น</th><th>หน่วยที่ยื่น</th><th>ผู้รับผิดชอบ</th><th>ระยะเก็บ</th><th>หมวด</th></tr></thead>
    <tbody>${docs.map(d=>`<tr>
      <td style="font-family:var(--font-mono);font-size:12px">${d.seq_no||'—'}</td>
      <td class="law-title-cell">${d.document_name}</td>
      <td style="font-size:12px">${d.submission_timeline||'—'}</td>
      <td style="font-size:12px">${d.submission_location||'—'}</td>
      <td style="font-size:12px">${d.responsible_unit||'—'}</td>
      <td style="font-size:12px;font-family:var(--font-mono)">${d.retention_period||'—'}</td>
      <td style="font-size:12px;color:var(--gold)">${d.category||'—'}</td>
    </tr>`).join('')}</tbody></table>`;
}

function populateYearFilter(summaries) {
  const years = [...new Set(summaries.map(s=>s.year).filter(Boolean))].sort((a,b)=>b-a);
  const sel = document.getElementById('evalYearFilter');
  sel.innerHTML = '<option value="">ทุกปี</option>' + years.map(y=>`<option value="${y}">${y}</option>`).join('');
}

function filterEvalTable() {
  const s = document.getElementById('evalStatusFilter').value;
  renderEvalTable(allEvalRecords.filter(r => !s || r.compliance_status === s));
}

function renderEvalTable(records) {
  if (!records.length) { document.getElementById('evalDetailTable').innerHTML = '<div class="empty-state">ไม่พบข้อมูล</div>'; return; }
  document.getElementById('evalDetailTable').innerHTML = `<table>
    <thead><tr><th>รหัส</th><th>ชื่อกฎหมาย</th><th>ผู้รับผิดชอบ</th><th>ความถี่ตรวจสอบ</th><th>ตรวจล่าสุด</th><th>สถานะ</th></tr></thead>
    <tbody>${records.map(r=>`<tr>
      <td class="law-code-cell">${r.id}</td>
      <td class="law-title-cell">${r.title}</td>
      <td style="font-size:12px">${r.responsible_unit||'—'}</td>
      <td style="font-size:12px;font-family:var(--font-mono)">${r.check_frequency||'—'}</td>
      <td style="font-size:12px;font-family:var(--font-mono)">${r.last_review_date||'—'}</td>
      <td>${complianceStatusBadge(r.compliance_status)}</td>
    </tr>`).join('')}</tbody></table>`;
}

// ===== COMPLIANCE PAGE (new schema) =====
async function loadCompliancePage() {
  document.getElementById('complianceContent').innerHTML = '<div class="loading-state">กำลังโหลด...</div>';
  try {
    const [{ data: logs }, { data: laws }] = await Promise.all([
      sb.from('compliance_logs').select('*, laws(id, title)').order('created_at', { ascending: false }),
      sb.from('laws').select('id, title').eq('is_cancelled', false).order('id')
    ]);
    const html = (logs?.length
      ? `<div class="compliance-grid">${logs.map(complianceLogCardHTML).join('')}</div>`
      : `<div class="card"><div class="empty-state">ยังไม่มีบันทึกการทบทวน</div></div>`)
      + `<div class="card" style="margin-top:20px"><div class="card-title">➕ บันทึกผลการทบทวนกฎหมาย</div>${complianceFormHTML(laws||[])}</div>`;
    document.getElementById('complianceContent').innerHTML = html;
  } catch(e) { document.getElementById('complianceContent').innerHTML = '<div class="empty-state">เกิดข้อผิดพลาด</div>'; }
}

function complianceLogCardHTML(r) {
  return `<div class="compliance-card">
    <div class="compliance-law-title">${r.laws?.title||r.law_id||'ไม่ระบุกฎหมาย'}</div>
    <div class="compliance-status-row">
      <span style="font-size:12px;color:var(--text-muted)">ปี ${r.review_year||'—'} ${r.review_quarter?'/ '+r.review_quarter:''}</span>
      <span style="font-size:12px;font-family:var(--font-mono);color:var(--gold)">${r.reviewed_by||'—'}</span>
    </div>
    <div style="display:flex;gap:16px;margin-top:10px">
      <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--green)">${r.compliant_items||0}</div><div style="font-size:11px;color:var(--text-muted)">สอดคล้อง</div></div>
      <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--red)">${r.non_compliant_items||0}</div><div style="font-size:11px;color:var(--text-muted)">ไม่สอดคล้อง</div></div>
      <div style="text-align:center"><div style="font-size:20px;font-weight:700;color:var(--blue)">${r.new_laws_count||0}</div><div style="font-size:11px;color:var(--text-muted)">กม.ใหม่</div></div>
    </div>
    ${r.notes?`<div style="font-size:12px;color:var(--text-muted);margin-top:10px;border-top:1px solid var(--border);padding-top:8px">${r.notes}</div>`:''}
  </div>`;
}

function complianceFormHTML(laws) {
  return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
    <div class="form-group"><label>กฎหมาย</label><select id="cf-law" class="input">
      <option value="">-- เลือกกฎหมาย --</option>${laws.map(l=>`<option value="${l.id}">${l.id} – ${l.title.slice(0,50)}</option>`).join('')}
    </select></div>
    <div class="form-group"><label>ปีที่ทบทวน</label><input type="number" id="cf-year" class="input" value="${new Date().getFullYear()+543}" /></div>
    <div class="form-group"><label>ไตรมาส</label><select id="cf-quarter" class="input">
      <option value="">—</option><option>Q1</option><option>Q2</option><option>Q3</option><option>Q4</option>
    </select></div>
    <div class="form-group"><label>ผู้ทบทวน</label><input type="text" id="cf-reviewer" class="input" placeholder="ชื่อผู้ทบทวน" /></div>
    <div class="form-group"><label>รายการที่สอดคล้อง</label><input type="number" id="cf-compliant" class="input" min="0" value="0" /></div>
    <div class="form-group"><label>รายการที่ไม่สอดคล้อง</label><input type="number" id="cf-noncompliant" class="input" min="0" value="0" /></div>
    <div class="form-group"><label>กฎหมายใหม่ที่พบ</label><input type="number" id="cf-newlaws" class="input" min="0" value="0" /></div>
    <div class="form-group"><label>กฎหมายที่ถูกยกเลิก</label><input type="number" id="cf-cancelled" class="input" min="0" value="0" /></div>
    <div class="form-group" style="grid-column:1/-1"><label>หมายเหตุ</label><textarea id="cf-notes" class="input textarea" rows="3" placeholder="บันทึกเพิ่มเติม..."></textarea></div>
  </div>
  <button class="btn-primary" onclick="saveComplianceRecord()">💾 บันทึกผลการทบทวน</button>`;
}

async function saveComplianceRecord() {
  const lawId = document.getElementById('cf-law').value;
  if (!lawId) { showToast('กรุณาเลือกกฎหมาย', 'error'); return; }
  const record = {
    law_id: lawId,
    review_year: parseInt(document.getElementById('cf-year').value),
    review_quarter: document.getElementById('cf-quarter').value || null,
    reviewed_by: document.getElementById('cf-reviewer').value || null,
    compliant_items: parseInt(document.getElementById('cf-compliant').value)||0,
    non_compliant_items: parseInt(document.getElementById('cf-noncompliant').value)||0,
    new_laws_count: parseInt(document.getElementById('cf-newlaws').value)||0,
    cancelled_laws_count: parseInt(document.getElementById('cf-cancelled').value)||0,
    notes: document.getElementById('cf-notes').value || null
  };
  const { error } = await sb.from('compliance_logs').insert([record]);
  if (error) showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error');
  else { showToast('✓ บันทึกผลการทบทวนเรียบร้อยแล้ว', 'success'); loadCompliancePage(); loadDashboard(); }
}

// ===== LAWS FOR ANALYSIS SELECT (new schema) =====
async function loadLawsForSelect() {
  const { data } = await sb.from('laws').select('id, title').eq('is_cancelled', false).order('id');
  const sel = document.getElementById('analyzeLawSelect');
  if (!data) return;
  sel.innerHTML = '<option value="">-- เลือกกฎหมาย --</option>' +
    data.map(l => `<option value="${l.id}">${l.id} – ${l.title.slice(0,60)}</option>`).join('');
}

async function saveAnalysis() {
  if (!currentAnalysis?.lawId) return;
  const { analysis, lawId } = currentAnalysis;
  const a = analysis;
  // Store in compliance_logs as it's the closest table for tracking
  const record = {
    law_id: lawId,
    review_year: new Date().getFullYear() + 543,
    notes: JSON.stringify({ skill: currentSkillTab, analysis: a }),
    reviewed_by: 'AI Analysis'
  };
  const { error } = await sb.from('compliance_logs').insert([record]);
  if (error) showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error');
  else { showToast('✓ บันทึกผลการวิเคราะห์เรียบร้อยแล้ว', 'success'); document.getElementById('saveAnalysisBtn').style.display='none'; loadDashboard(); }
}

// ===== SKILL TABS =====
function switchSkillTab(tab) {
  currentSkillTab = tab;
  document.querySelectorAll('.skill-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.querySelectorAll('.skill-options').forEach(o => o.style.display = 'none');
  document.getElementById('skillOptions-' + tab).style.display = 'block';
  const titles = { summary: '📋 ผลสรุปสาระสำคัญ', deep: '🔬 ผลวิเคราะห์เชิงลึก', checklist: '✅ Checklist การปฏิบัติตาม' };
  document.getElementById('resultCardTitle').textContent = titles[tab];
}

// ===== AI ANALYSIS =====
function onLawSelected() { document.getElementById('analyzeLawText').value = ''; }

function quickAnalyze(id) {
  navigate('analyze');
  const sel = document.getElementById('analyzeLawSelect');
  for (let i = 0; i < sel.options.length; i++) {
    if (sel.options[i].value === id) { sel.selectedIndex = i; break; }
  }
}

async function runAnalysis() {
  const lawId = document.getElementById('analyzeLawSelect').value;
  const manualText = document.getElementById('analyzeLawText').value.trim();
  const context = document.getElementById('analyzeContext').value.trim();
  if (!lawId && !manualText) { showToast('กรุณาเลือกกฎหมายหรือวางเนื้อหา', 'error'); return; }

  const spinner = document.getElementById('analyzeSpinner');
  spinner.style.display = 'inline';
  document.getElementById('analyzeSpinner').parentElement.disabled = true;
  document.getElementById('analysisOutput').innerHTML = '<div class="loading-state">AI กำลังวิเคราะห์กฎหมาย...</div>';
  document.getElementById('saveAnalysisBtn').style.display = 'none';
  document.getElementById('exportAnalysisBtn').style.display = 'none';

  let lawInfo = {};
  if (lawId) { const { data } = await sb.from('laws').select('*').eq('id', lawId).single(); lawInfo = data || {}; }

  const lawContent = manualText || `ชื่อกฎหมาย: ${lawInfo.title||''}\nสรุป: ${lawInfo.summary||''}\nหน่วยงาน: ${lawInfo.issuing_authority||''}`;
  let prompt = '';

  if (currentSkillTab === 'summary') {
    const opts = {
      who: document.getElementById('opt-who').checked,
      what: document.getElementById('opt-what').checked,
      where: document.getElementById('opt-where').checked,
      how: document.getElementById('opt-how').checked,
      docs: document.getElementById('opt-docs').checked,
      freq: document.getElementById('opt-freq').checked
    };
    prompt = `คุณเป็นผู้เชี่ยวชาญด้านกฎหมายความปลอดภัยและอาชีวอนามัยไทย
วิเคราะห์กฎหมายต่อไปนี้โดยสรุปสาระสำคัญ:

${lawContent}
${context ? `ประเด็นพิเศษ: ${context}` : ''}

ตอบเป็น JSON ดังนี้:
{
  "overview": "ภาพรวมกฎหมาย 2-3 ประโยค",
  ${opts.who ? '"who": [{"group": "กลุ่มผู้มีหน้าที่", "role": "บทบาท/หน้าที่หลัก"}],' : ''}
  ${opts.what ? '"what": [{"duty": "ภาระหน้าที่", "detail": "รายละเอียด"}],' : ''}
  ${opts.where ? '"where": {"scope": "ขอบเขตบังคับใช้", "excluded": "ข้อยกเว้น (ถ้ามี)"},' : ''}
  ${opts.how ? '"how": [{"step": 1, "action": "ขั้นตอน/วิธีการ", "detail": "รายละเอียด"}],' : ''}
  ${opts.docs ? '"documents": [{"name": "ชื่อเอกสาร", "type": "ประเภท (แบบฟอร์ม/รายงาน/ใบอนุญาต/ทะเบียน)", "purpose": "วัตถุประสงค์", "authority": "ส่งหน่วยงานใด"}],' : ''}
  ${opts.freq ? '"inspection_frequency": [{"activity": "กิจกรรม/การตรวจสอบ", "frequency": "ความถี่ (รายวัน/รายเดือน/รายปี/ฯลฯ)", "responsible": "ผู้รับผิดชอบ", "detail": "รายละเอียดเพิ่มเติม"}],' : ''}
  "risk_level": "สูง/กลาง/ต่ำ",
  "key_deadline": "กำหนดเวลาสำคัญ"
}
ตอบเฉพาะ JSON เท่านั้น`;

  } else if (currentSkillTab === 'deep') {
    prompt = `คุณเป็นผู้เชี่ยวชาญด้านกฎหมายความปลอดภัยและอาชีวอนามัยไทย
วิเคราะห์กฎหมายเชิงลึก:

${lawContent}
${context ? `ประเด็นพิเศษ: ${context}` : ''}

ตอบเป็น JSON:
{
  "overview": "สรุปกฎหมาย",
  "who_must_do": ["ผู้มีหน้าที่"],
  "what_to_do": ["สิ่งที่ต้องทำ"],
  "where_to_do": "ขอบเขต",
  "how_to_do": ["วิธีการ"],
  "related_documents": ["เอกสาร"],
  "inspection_frequency": [{"activity":"กิจกรรม","frequency":"ความถี่"}],
  "penalties": {"criminal": "โทษอาญา", "civil": "โทษแพ่ง", "administrative": "โทษทางปกครอง"},
  "risk_assessment": {"level": "สูง/กลาง/ต่ำ", "reasons": ["เหตุผล"], "mitigation": ["มาตรการลดความเสี่ยง"]},
  "department_tasks": [{"dept": "แผนก", "tasks": ["งาน"], "frequency": "ความถี่"}],
  "compliance_tips": ["เคล็ดลับ"]
}
ตอบเฉพาะ JSON เท่านั้น`;

  } else {
    prompt = `คุณเป็นผู้เชี่ยวชาญด้านกฎหมายความปลอดภัยและอาชีวอนามัยไทย
สร้าง Checklist การปฏิบัติตามกฎหมายนี้:

${lawContent}
${context ? `ประเด็นพิเศษ: ${context}` : ''}

ตอบเป็น JSON:
{
  "overview": "สรุปกฎหมาย",
  "daily_checklist": [{"item": "รายการตรวจสอบรายวัน", "responsible": "ผู้รับผิดชอบ", "evidence": "หลักฐาน"}],
  "monthly_checklist": [{"item": "รายการตรวจสอบรายเดือน", "responsible": "ผู้รับผิดชอบ", "evidence": "หลักฐาน"}],
  "annual_checklist": [{"item": "รายการตรวจสอบรายปี", "responsible": "ผู้รับผิดชอบ", "deadline": "กำหนดเวลา", "evidence": "หลักฐาน"}],
  "event_checklist": [{"trigger": "เหตุการณ์ที่กระตุ้น", "item": "รายการที่ต้องทำ", "deadline": "ภายใน"}],
  "required_documents": [{"name": "เอกสาร", "frequency": "ความถี่การจัดทำ", "retention": "ระยะเวลาเก็บรักษา"}]
}
ตอบเฉพาะ JSON เท่านั้น`;
  }

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-sonnet-4-20250514', max_tokens: 1000, messages: [{ role: 'user', content: prompt }] })
    });
    const data = await res.json();
    const rawText = data.content?.find(b => b.type === 'text')?.text || '{}';
    const analysis = JSON.parse(rawText.replace(/```json|```/g, '').trim());
    currentAnalysis = { lawId, analysis, tab: currentSkillTab };
    renderAnalysis(analysis, lawInfo.title || 'กฎหมายที่วิเคราะห์');
    if (lawId) {
      document.getElementById('saveAnalysisBtn').style.display = 'inline-block';
      document.getElementById('exportAnalysisBtn').style.display = 'inline-block';
    }
  } catch(e) {
    document.getElementById('analysisOutput').innerHTML = '<div class="empty-state">เกิดข้อผิดพลาดในการวิเคราะห์</div>';
    showToast('AI วิเคราะห์ไม่สำเร็จ: ' + e.message, 'error');
  } finally {
    spinner.style.display = 'none';
    document.getElementById('analyzeSpinner').parentElement.disabled = false;
  }
}

function renderAnalysis(a, title) {
  const riskColor = { 'สูง': 'var(--red)', 'กลาง': 'var(--yellow)', 'ต่ำ': 'var(--green)' };
  const riskC = riskColor[a.risk_level || a.risk_assessment?.level] || 'var(--text-muted)';
  let html = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:20px;padding:12px 16px;background:var(--bg3);border-radius:8px">
    <span style="font-size:13px;font-weight:600;flex:1">${title}</span>
    <span style="font-size:12px;color:${riskC};font-family:var(--font-mono)">ความเสี่ยง: ${a.risk_level || a.risk_assessment?.level || '—'}</span>
  </div>`;

  if (currentSkillTab === 'summary') {
    html += section('📋 ภาพรวมกฎหมาย', `<div class="analysis-section-body">${a.overview||'—'}</div>`);

    if (a.who) html += section('👥 ใคร — ผู้ที่มีหน้าที่ปฏิบัติตาม',
      a.who.map(w => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:600;font-size:13px">${w.group}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${w.role}</div>
      </div>`).join(''));

    if (a.what) html += section('✅ ทำอะไร — ภาระหน้าที่และข้อกำหนด',
      a.what.map(w => `<div style="padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="font-weight:600;font-size:13px">${w.duty}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:3px">${w.detail}</div>
      </div>`).join(''));

    if (a.where) html += section('📍 ที่ไหน — ขอบเขตการบังคับใช้',
      `<div class="analysis-section-body">${a.where.scope}</div>
       ${a.where.excluded ? `<div style="margin-top:8px;font-size:12px;color:var(--text-muted)">ข้อยกเว้น: ${a.where.excluded}</div>` : ''}`);

    if (a.how) html += section('🔧 อย่างไร — วิธีการปฏิบัติ',
      `<ol style="padding-left:18px">${a.how.map(h => `<li style="margin-bottom:10px">
        <div style="font-size:13px;font-weight:500">${h.action}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:2px">${h.detail}</div>
      </li>`).join('')}</ol>`);

    if (a.documents) html += section('📄 เอกสารที่เกี่ยวข้อง',
      a.documents.map(d => `<div class="doc-item">
        <span class="doc-icon">${d.type==='ใบอนุญาต'?'📜':d.type==='แบบฟอร์ม'?'📝':d.type==='รายงาน'?'📊':'📁'}</span>
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${d.name}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">${d.type} · วัตถุประสงค์: ${d.purpose}</div>
          ${d.authority ? `<div style="font-size:11px;color:var(--gold);margin-top:2px">ส่ง: ${d.authority}</div>` : ''}
        </div>
      </div>`).join(''));

    if (a.inspection_frequency) html += section('🔁 ความถี่การตรวจสอบ',
      a.inspection_frequency.map(f => `<div style="display:flex;align-items:flex-start;gap:12px;padding:8px 0;border-bottom:1px solid var(--border)">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:500">${f.activity}</div>
          <div style="font-size:11px;color:var(--text-muted);margin-top:2px">ผู้รับผิดชอบ: ${f.responsible||'—'} ${f.detail?'· '+f.detail:''}</div>
        </div>
        <span class="freq-badge">${f.frequency}</span>
      </div>`).join(''));

    if (a.key_deadline) html += section('📅 กำหนดเวลาสำคัญ', `<div class="analysis-section-body">${a.key_deadline}</div>`);

  } else if (currentSkillTab === 'deep') {
    html += section('📋 ภาพรวม', `<div class="analysis-section-body">${a.overview||'—'}</div>`);
    if (a.who_must_do?.length) html += section('👥 ผู้มีหน้าที่', a.who_must_do.map(w=>`<span class="analysis-tag">${w}</span>`).join(''));
    if (a.what_to_do?.length) html += section('✅ สิ่งที่ต้องทำ', `<ul style="padding-left:18px">${a.what_to_do.map(w=>`<li style="margin-bottom:6px;font-size:13px">${w}</li>`).join('')}</ul>`);
    if (a.where_to_do) html += section('📍 ขอบเขต', `<div class="analysis-section-body">${a.where_to_do}</div>`);
    if (a.how_to_do?.length) html += section('🔧 วิธีการ', `<ol style="padding-left:18px">${a.how_to_do.map(h=>`<li style="margin-bottom:6px;font-size:13px">${h}</li>`).join('')}</ol>`);
    if (a.related_documents?.length) html += section('📄 เอกสาร', a.related_documents.map(d=>`<div class="doc-item"><span class="doc-icon">📄</span><div>${d}</div></div>`).join(''));
    if (a.inspection_frequency?.length) html += section('🔁 ความถี่ตรวจสอบ', a.inspection_frequency.map(f=>`<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border);font-size:13px"><span>${f.activity}</span><span class="freq-badge">${f.frequency}</span></div>`).join(''));
    if (a.penalties) html += section('⚠ บทลงโทษ', `
      ${a.penalties.criminal?`<div style="margin-bottom:8px"><span style="color:var(--red);font-size:11px;font-family:var(--font-mono)">โทษอาญา</span><div style="font-size:13px;margin-top:4px">${a.penalties.criminal}</div></div>`:''}
      ${a.penalties.civil?`<div style="margin-bottom:8px"><span style="color:var(--yellow);font-size:11px;font-family:var(--font-mono)">โทษแพ่ง</span><div style="font-size:13px;margin-top:4px">${a.penalties.civil}</div></div>`:''}
      ${a.penalties.administrative?`<div><span style="color:var(--blue);font-size:11px;font-family:var(--font-mono)">โทษปกครอง</span><div style="font-size:13px;margin-top:4px">${a.penalties.administrative}</div></div>`:''}`);
    if (a.risk_assessment) html += section('🎯 การประเมินความเสี่ยง', `
      <div style="margin-bottom:10px"><span style="font-size:13px;color:${riskC};font-weight:700">ระดับ: ${a.risk_assessment.level}</span></div>
      <ul style="padding-left:18px">${(a.risk_assessment.reasons||[]).map(r=>`<li style="font-size:13px;margin-bottom:4px">${r}</li>`).join('')}</ul>`);
    if (a.department_tasks?.length) html += section('🏢 ภาระหน้าที่แยกตามแผนก', a.department_tasks.map(d=>`<div style="margin-bottom:12px;padding:10px;background:var(--bg);border-radius:8px">
      <div style="font-size:13px;font-weight:600;color:var(--gold);margin-bottom:6px">${d.dept} <span class="freq-badge">${d.frequency||''}</span></div>
      <ul style="padding-left:16px">${(d.tasks||[]).map(t=>`<li style="font-size:12px;margin-bottom:3px">${t}</li>`).join('')}</ul>
    </div>`).join(''));
    if (a.compliance_tips?.length) html += section('💡 เคล็ดลับ', `<ul style="padding-left:18px">${a.compliance_tips.map(t=>`<li style="font-size:13px;margin-bottom:6px">${t}</li>`).join('')}</ul>`);

  } else {
    html += section('📋 ภาพรวม', `<div class="analysis-section-body">${a.overview||'—'}</div>`);
    const renderChecklist = (items, period) => items?.length ? items.map(i=>`<div class="checklist-item">
      <span style="color:var(--gold)">☐</span>
      <div style="flex:1"><div style="font-size:13px">${i.item}</div>
        <div style="font-size:11px;color:var(--text-muted);margin-top:3px">ผู้รับผิดชอบ: ${i.responsible||'—'} ${i.evidence?'· หลักฐาน: '+i.evidence:''} ${i.deadline?'· ภายใน: '+i.deadline:''}</div>
      </div><span class="checklist-period">${period}</span></div>`).join('') : '<div style="font-size:13px;color:var(--text-muted)">ไม่มีรายการ</div>';
    if (a.daily_checklist?.length) html += section('📅 รายวัน', renderChecklist(a.daily_checklist, 'รายวัน'));
    if (a.monthly_checklist?.length) html += section('📅 รายเดือน', renderChecklist(a.monthly_checklist, 'รายเดือน'));
    if (a.annual_checklist?.length) html += section('📅 รายปี', renderChecklist(a.annual_checklist, 'รายปี'));
    if (a.event_checklist?.length) html += section('⚡ เมื่อเกิดเหตุการณ์', a.event_checklist.map(i=>`<div class="checklist-item">
      <span style="color:var(--red)">⚡</span>
      <div style="flex:1"><div style="font-size:11px;color:var(--red);font-family:var(--font-mono)">${i.trigger}</div>
      <div style="font-size:13px;margin-top:3px">${i.item}</div>
      ${i.deadline?`<div style="font-size:11px;color:var(--text-muted);margin-top:2px">ภายใน: ${i.deadline}</div>`:''}</div></div>`).join(''));
    if (a.required_documents?.length) html += section('📄 เอกสารที่ต้องจัดทำ', a.required_documents.map(d=>`<div class="doc-item">
      <span class="doc-icon">📄</span>
      <div><div style="font-size:13px;font-weight:500">${d.name}</div>
      <div style="font-size:11px;color:var(--text-muted);margin-top:2px">ความถี่: ${d.frequency||'—'} · เก็บรักษา: ${d.retention||'—'}</div></div></div>`).join(''));
  }
  document.getElementById('analysisOutput').innerHTML = html;
}

function section(title, body) {
  return `<div class="analysis-section"><div class="analysis-section-title">${title}</div>${body}</div>`;
}

function exportAnalysis() {
  showToast('กำลังเตรียม Export...', 'info');
  const content = document.getElementById('analysisOutput').innerText;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = 'law-analysis.txt'; a.click();
  URL.revokeObjectURL(url);
}

// ===== DEPARTMENT ASSIGNMENT =====
async function loadDepartmentsPage() {
  document.getElementById('deptAssignTable').innerHTML = '<div class="loading-state">กำลังโหลด...</div>';
  const { data } = await sb.from('laws')
    .select('id, title, category_id, responsible_unit')
    .eq('is_cancelled', false).order('id');
  deptLaws = data || [];

  const sel = document.getElementById('deptLawSelect');
  sel.innerHTML = '<option value="">-- เลือกกฎหมาย --</option>' +
    deptLaws.map(l => `<option value="${l.id}">${l.id} – ${l.title.slice(0, 60)}</option>`).join('');

  // Suggestions = departments already used elsewhere
  const units = [...new Set(deptLaws.map(l => l.responsible_unit).filter(Boolean))].sort();
  document.getElementById('deptOptions').innerHTML = units.map(u => `<option value="${u}"></option>`).join('');

  // Category filter options
  const cats = [...new Set(deptLaws.map(l => l.category_id).filter(Boolean))].sort();
  document.getElementById('deptCatFilter').innerHTML = '<option value="">ทุกหมวด</option>' +
    cats.map(c => `<option value="${c}">${c}</option>`).join('');

  renderDeptTable(deptLaws);
}

function onDeptLawSelected() {
  const id = document.getElementById('deptLawSelect').value;
  const info = document.getElementById('deptCurrentInfo');
  const input = document.getElementById('deptUnitInput');
  const law = deptLaws.find(l => l.id === id);
  if (!law) { info.style.display = 'none'; input.value = ''; return; }
  input.value = law.responsible_unit || '';
  info.style.display = 'block';
  info.innerHTML = `<span style="color:var(--text-muted)">หน่วยงานปัจจุบัน:</span>
    <b style="color:var(--gold)">${law.responsible_unit || 'ยังไม่ได้กำหนด'}</b>`;
}

async function saveDepartmentAssignment() {
  const id = document.getElementById('deptLawSelect').value;
  const unit = document.getElementById('deptUnitInput').value.trim();
  if (!id) { showToast('กรุณาเลือกกฎหมาย', 'error'); return; }
  if (!unit) { showToast('กรุณาระบุหน่วยงานที่รับผิดชอบ', 'error'); return; }
  const { error } = await sb.from('laws').update({ responsible_unit: unit }).eq('id', id);
  if (error) { showToast('บันทึกไม่สำเร็จ: ' + error.message, 'error'); return; }
  showToast('✓ มอบหมายหน่วยงานเรียบร้อยแล้ว', 'success');
  const law = deptLaws.find(l => l.id === id);
  if (law) law.responsible_unit = unit;
  onDeptLawSelected();
  filterDeptTable();
}

function filterDeptTable() {
  const q = document.getElementById('deptSearch').value.toLowerCase();
  const c = document.getElementById('deptCatFilter').value;
  renderDeptTable(deptLaws.filter(l =>
    (!q || l.title.toLowerCase().includes(q) || l.id.toLowerCase().includes(q)) &&
    (!c || l.category_id === c)
  ));
}

function renderDeptTable(records) {
  const el = document.getElementById('deptAssignTable');
  if (!records.length) { el.innerHTML = '<div class="empty-state">ไม่พบกฎหมาย</div>'; return; }
  el.innerHTML = `<table>
    <thead><tr><th>รหัส</th><th>ชื่อกฎหมาย</th><th>หมวด</th><th>หน่วยงานรับผิดชอบ</th></tr></thead>
    <tbody>${records.map(l => `<tr onclick="selectDeptLaw('${l.id}')" style="cursor:pointer">
      <td class="law-code-cell">${l.id}</td>
      <td class="law-title-cell">${l.title}</td>
      <td style="font-size:12px;color:var(--text-muted)">${l.category_id || '—'}</td>
      <td style="font-size:12px">${l.responsible_unit
        ? `<span style="color:var(--gold)">${l.responsible_unit}</span>`
        : '<span style="color:var(--text-muted)">ยังไม่ได้กำหนด</span>'}</td>
    </tr>`).join('')}</tbody></table>`;
}

function selectDeptLaw(id) {
  document.getElementById('deptLawSelect').value = id;
  onDeptLawSelected();
}

