/* Session Warrant 감사 콘솔 — 바닐라 JS. 프레임워크·빌드 없이 index.html 을 열면 동작한다. */
(function () {
  "use strict";
  const D = window.SW_DATA;
  const $ = (sel, root) => (root || document).querySelector(sel);
  const MIN = D.MIN;

  const state = { view: "overview", range: 360, node: "all", verdict: "all", hook: "all", subject: "all", agg: true, q: "", selected: null, warrant: "W-4821-3F", wlSel: null };

  // ── 서식 ─────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const pad = (n) => String(n).padStart(2, "0");
  const fmtT = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`; };
  const fmtHM = (ts) => { const d = new Date(ts); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
  const fmtN = (n) => n.toLocaleString("ko-KR");
  const rel = (ts) => { const m = Math.round((D.NOW - ts) / MIN); return m <= 0 ? `${-m}분 후` : m < 60 ? `${m}분 전` : `${Math.floor(m / 60)}시간 ${m % 60}분 전`; };
  const subjName = (id) => (id && D.subjects[id]) ? D.subjects[id].name : null;
  const hookLabel = (h) => D.HOOKS[h] || h;
  const VERD_KO = { ALLOW: "허용", WOULD_DENY: "차단 예정(dry-run)", DENY: "차단" };

  // ── 필터 ─────────────────────────────────────────────────────────
  const since = () => D.NOW - state.range * MIN;
  const inWindow = (e) => e.ts >= since() && e.ts <= D.NOW && (state.node === "all" || e.node === state.node);
  const baseEvents = () => D.events.filter(inWindow);
  const gapsIn = () => D.gaps.filter((g) => g.to >= since() && (state.node === "all" || g.node === state.node));
  const blocked = (e) => e.verdict === "DENY" || e.verdict === "WOULD_DENY";

  // ── 공통: 판정 칩 · 이벤트 행 ───────────────────────────────────
  const pill = (v) => `<span class="pill ${v}" title="${VERD_KO[v] || ""}">${v}</span>`;

  function whoCell(e) {
    if (e.warrant) {
      return `<td class="who">${esc(subjName(e.subject))}<br><span class="w">${esc(e.warrant)}</span></td>`;
    }
    return `<td class="who"><span class="chip sev-critical">무영장</span><br><span class="w">cgroup ${e.cgroup}</span></td>`;
  }
  function whatCell(e) {
    switch (e.hook) {
      case "exec": {
        const flags = [e.setuid ? "setuid" : null, e.interp ? `interp ${e.interp}` : null].filter(Boolean).join(" · ");
        return `<td class="what"><div class="path">${esc(e.filename)}</div><div class="ino">dev ${e.dev} · ino ${fmtN(e.ino)}${flags ? " · " + esc(flags) : ""}</div><div class="argv">${esc(e.argv)}</div></td>`;
      }
      case "write": case "unlink": case "rename":
        return `<td class="what"><div class="path">${esc(e.path)}</div><div class="ino">dev ${e.dev} · ino ${fmtN(e.ino)} · 부모 ino ${fmtN(e.parent_ino)}${e.flags ? " · " + esc(e.flags) : ""}</div>${e.note ? `<div class="argv" style="opacity:1">${esc(e.note)}</div>` : ""}</td>`;
      case "connect": {
        const dst = e.family === "AF_UNIX" ? e.addr : `${e.addr}:${e.port}`;
        return `<td class="what"><div class="path">${esc(dst)}</div><div class="ino">${e.family}${e.family === "AF_UNIX" ? " · 위임 소켓 (§04 2겹)" : ""}</div>${e.note ? `<div class="argv" style="opacity:1">${esc(e.note)}</div>` : ""}</td>`;
      }
      case "agg":
        return `<td class="what">허용 쓰기 집계 <b class="num">${fmtN(e.count)}</b>건 / ${e.window} <span class="dim">— 개별 기록 없음 (§11)</span></td>`;
      case "self":
        return `<td class="what">${esc(e.note)}</td>`;
      default:
        return `<td class="what"></td>`;
    }
  }
  function eventRow(e) {
    const cls = e.hook === "agg" ? "ev aggrow" : "ev";
    const sel = state.selected === e.id ? ' aria-selected="true"' : "";
    return `<tr class="${cls}" data-id="${esc(e.id)}"${sel}>
      <td class="t">${fmtT(e.ts)}</td>
      <td>${pill(e.verdict)}</td>
      <td class="hook">${esc(hookLabel(e.hook))}</td>
      ${whoCell(e)}
      <td class="hook">${esc(e.node)}</td>
      ${whatCell(e)}
      <td class="pid">pid ${e.pid}<br>uid ${e.uid}→${e.euid}</td>
    </tr>`;
  }
  function gapRow(g) {
    return `<tr class="gaprow"><td colspan="7"><b>감사 유실 구간</b> · ${esc(g.node)} · ${fmtT(g.from)} – ${fmtT(g.to)} · seq ${fmtN(g.seq_from)} → ${fmtN(g.seq_to)} · <b>dropped ${fmtN(g.dropped)}</b> · ${esc(g.cause)}</td></tr>`;
  }
  const THEAD = `<thead><tr><th>시각</th><th>판정</th><th>훅</th><th>주체 · 영장</th><th>노드</th><th>대상 (근거: dev, ino)</th><th>프로세스</th></tr></thead>`;

  /** 이벤트와 유실 구간을 시간순으로 섞어 표를 만든다. 유실 구간은 숨기지 않는다. */
  function renderTable(el, events, gaps, emptyMsg) {
    const items = events.map((e) => ({ t: e.ts, html: eventRow(e) })).concat(gaps.map((g) => ({ t: g.from, html: gapRow(g) })));
    items.sort((a, b) => b.t - a.t);
    el.innerHTML = items.length ? `<table>${THEAD}<tbody>${items.map((i) => i.html).join("")}</tbody></table>` : `<div class="empty">${emptyMsg || "해당하는 이벤트가 없습니다"}</div>`;
  }

  // ── 개요 ─────────────────────────────────────────────────────────
  function renderOverview() {
    const ev = baseEvents();
    const gaps = gapsIn();
    const deny = ev.filter((e) => e.verdict === "DENY").length;
    const would = ev.filter((e) => e.verdict === "WOULD_DENY").length;
    const wl = D.warrantless.filter((s) => s.last >= since() && (state.node === "all" || s.node === state.node));
    const dropped = gaps.reduce((a, g) => a + g.dropped, 0);
    const active = D.warrants.filter((w) => w.expires > D.NOW || (w.on_expiry === "grace" && w.expires + 120 * MIN > D.NOW)).filter((w) => state.node === "all" || w.node === state.node);
    const execs = ev.filter((e) => e.hook === "exec").length;

    $("#tiles").innerHTML = `
      <div class="panel tile ${wl.length ? "crit" : "ok"}"><div class="label">무영장 세션</div><div class="value">${wl.length}<small>세션</small></div><div class="foot">${wl.filter((s) => s.severity === "critical").length}건 critical · 게이트웨이 우회 의심</div></div>
      <div class="panel tile ${deny ? "crit" : "would"}"><div class="label">차단 판정</div><div class="value">${fmtN(deny + would)}<small>건</small></div><div class="foot">DENY ${fmtN(deny)} · WOULD_DENY ${fmtN(would)} — 전건 기록</div></div>
      <div class="panel tile ${gaps.length ? "gap" : "ok"}"><div class="label">감사 유실 구간</div><div class="value">${gaps.length}<small>구간</small></div><div class="foot">dropped 합계 ${fmtN(dropped)}건 · seq 로 검증</div></div>
      <div class="panel tile ok"><div class="label">활성 영장</div><div class="value">${active.length}<small>/ ${D.warrants.filter((w) => state.node === "all" || w.node === state.node).length}</small></div><div class="foot">귀속된 exec ${fmtN(execs)}건 · 노드 ${state.node === "all" ? Object.keys(D.nodes).length : 1}대</div></div>`;

    renderTimelineChart(ev, gaps);
    renderHookBars(ev);

    $("#wl-sub").textContent = wl.length ? `${wl.length}세션 · 최근 ${rel(Math.max(...wl.map((s) => s.first)))}` : "없음";
    $("#wl-list").innerHTML = wl.length ? wl.map((s) => `
      <div class="wl-row" data-cg="${s.cgroup}" tabindex="0" role="button">
        <div class="l1"><span class="chip sev-${s.severity}">${s.severity === "critical" ? "critical" : "warning"}</span>${esc(s.node)} <span class="mono dim">${esc(s.session)}</span></div>
        <div class="r">${rel(s.first)} 시작<br>${s.count}건 귀속</div>
        <div class="l2">uid ${s.uid} · ${esc(s.from)} 에서 · ${esc(s.reason)}</div>
      </div>`).join("") : `<div class="empty">이 기간에는 무영장 세션이 없습니다</div>`;
    $("#wl-list").querySelectorAll(".wl-row").forEach((r) => {
      const go = () => { state.wlSel = Number(r.dataset.cg); setView("warrantless"); };
      r.addEventListener("click", go);
      r.addEventListener("keydown", (k) => { if (k.key === "Enter" || k.key === " ") { k.preventDefault(); go(); } });
    });

    const recent = ev.filter(blocked).slice(-10);
    renderTable($("#recent-deny"), recent, [], "이 기간에는 차단 판정이 없습니다");
    bindRowClicks($("#recent-deny"), (id) => { state.selected = id; state.verdict = "all"; state.hook = "all"; state.subject = "all"; state.q = ""; setView("search"); });
  }

  /** 5분 버킷 스택 막대. 한 축, 시리즈 3개 고정 순서, 유실 구간은 빗금 띠. */
  function renderTimelineChart(ev, gaps) {
    const bucket = 5 * MIN, n = (state.range * MIN) / bucket, t0 = since();
    const rows = Array.from({ length: n }, (_, i) => ({ t: t0 + i * bucket, ALLOW: 0, WOULD_DENY: 0, DENY: 0 }));
    ev.forEach((e) => { if (e.hook === "agg") return; const i = Math.min(n - 1, Math.floor((e.ts - t0) / bucket)); rows[i][e.verdict]++; });
    const max = Math.max(4, ...rows.map((r) => r.ALLOW + r.WOULD_DENY + r.DENY));
    const step = max <= 8 ? 2 : max <= 20 ? 5 : max <= 50 ? 10 : 20;
    const yMax = Math.ceil(max / step) * step;
    const W = 760, H = 190, L = 34, R = 6, T = 8, B = 24;
    const pw = W - L - R, ph = H - T - B;
    const bw = pw / n, gapPx = Math.min(2, bw * 0.3);
    const y = (v) => T + ph - (v / yMax) * ph;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="5분 단위 판정 건수 추이">
      <defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="transparent"/><line x1="0" y1="0" x2="0" y2="6" stroke="var(--gap-ink)" stroke-width="1.2"/></pattern></defs>`;
    for (let v = 0; v <= yMax; v += step) s += `<line class="grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="axis" x="${L - 6}" y="${y(v) + 4}" text-anchor="end">${v}</text>`;
    gaps.forEach((g) => { const x1 = L + ((Math.max(g.from, t0) - t0) / (n * bucket)) * pw, x2 = L + ((Math.min(g.to, D.NOW) - t0) / (n * bucket)) * pw; s += `<rect class="gapband" x="${x1 - 2}" y="${T}" width="${Math.max(4, x2 - x1)}" height="${ph}"/><line class="gapline" x1="${x1}" x2="${x1}" y1="${T}" y2="${T + ph}"/>`; });
    rows.forEach((r, i) => {
      const x = L + i * bw + gapPx / 2, w = bw - gapPx;
      let acc = 0;
      ["ALLOW", "WOULD_DENY", "DENY"].forEach((k, j) => {
        if (!r[k]) return;
        const y1 = y(acc + r[k]), y0 = y(acc) - (acc ? 1 : 0);
        const top = (j === 2) || (j === 1 && !r.DENY) || (j === 0 && !r.WOULD_DENY && !r.DENY);
        s += `<rect class="bar-${k === "ALLOW" ? "allow" : k === "WOULD_DENY" ? "would" : "deny"}" x="${x}" y="${y1}" width="${w}" height="${Math.max(0, y0 - y1)}" rx="${top ? Math.min(3, w / 2) : 0}"/>`;
        acc += r[k];
      });
    });
    const labelEvery = n <= 12 ? 1 : n <= 36 ? 3 : 6;
    rows.forEach((r, i) => { if (i % labelEvery === 0) s += `<text class="axis" x="${L + i * bw}" y="${H - 6}">${fmtHM(r.t)}</text>`; });
    s += `<text class="axis" x="${W - R}" y="${H - 6}" text-anchor="end">지금</text>`;
    rows.forEach((r, i) => { s += `<rect class="hit" data-i="${i}" x="${L + i * bw}" y="${T}" width="${bw}" height="${ph}"/>`; });
    s += `</svg>`;
    const el = $("#chart-timeline");
    el.innerHTML = s;
    const tip = $("#tip");
    el.querySelectorAll(".hit").forEach((h) => {
      h.addEventListener("mousemove", (m) => {
        const r = rows[Number(h.dataset.i)];
        const g = gaps.filter((x) => x.from < r.t + bucket && x.to > r.t);
        tip.innerHTML = `<b>${fmtHM(r.t)} – ${fmtHM(r.t + bucket)}</b>
          <div class="row"><span>ALLOW</span><span>${r.ALLOW}</span></div>
          <div class="row"><span>WOULD_DENY</span><span>${r.WOULD_DENY}</span></div>
          <div class="row"><span>DENY</span><span>${r.DENY}</span></div>
          ${g.map((x) => `<div class="row"><span>유실 ${esc(x.node)}</span><span>dropped ${x.dropped}</span></div>`).join("")}`;
        tip.style.display = "block";
        const tw = tip.offsetWidth, th = tip.offsetHeight;
        tip.style.left = Math.min(window.innerWidth - tw - 8, m.clientX + 14) + "px";
        tip.style.top = Math.max(8, m.clientY - th - 10) + "px";
      });
      h.addEventListener("mouseleave", () => { tip.style.display = "none"; });
    });
  }

  function renderHookBars(ev) {
    const order = ["exec", "write", "unlink", "rename", "connect", "self"];
    const agg = {};
    ev.forEach((e) => { if (e.hook === "agg") return; const a = agg[e.hook] || (agg[e.hook] = { ALLOW: 0, WOULD_DENY: 0, DENY: 0, n: 0 }); a[e.verdict]++; a.n++; });
    const max = Math.max(1, ...Object.values(agg).map((a) => a.n));
    $("#hbars").innerHTML = order.filter((h) => agg[h]).map((h) => {
      const a = agg[h];
      const seg = (k, c) => a[k] ? `<i class="${c}" style="width:${(a[k] / max) * 100}%" title="${k} ${a[k]}"></i>` : "";
      return `<div class="k">${esc(hookLabel(h))}</div><div class="track">${seg("ALLOW", "allow")}${seg("WOULD_DENY", "would")}${seg("DENY", "deny")}</div><div class="v">${fmtN(a.n)}${a.DENY + a.WOULD_DENY ? ` <span class="dim">(차단 ${a.DENY + a.WOULD_DENY})</span>` : ""}</div>`;
    }).join("") || `<div class="empty">이벤트 없음</div>`;
  }

  // ── 감사 검색 ────────────────────────────────────────────────────
  function searchEvents() {
    const q = state.q.trim().toLowerCase();
    return baseEvents().filter((e) => {
      if (state.verdict === "blocked" ? !blocked(e) : state.verdict !== "all" && e.verdict !== state.verdict) return false;
      if (state.hook !== "all" && e.hook !== state.hook) return false;
      if (state.subject === "none" ? e.warrant !== null : state.subject !== "all" && String(e.subject) !== state.subject) return false;
      if (!state.agg && e.hook === "agg") return false;
      if (q) {
        const hay = [e.filename, e.argv, e.path, e.addr, e.warrant, e.comm, e.ino, e.node, subjName(e.subject), e.note].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }
  function renderSearch() {
    const ev = searchEvents();
    const filteredOut = state.verdict !== "all" || state.hook !== "all" || state.subject !== "all" || state.q;
    $("#search-count").textContent = `${fmtN(ev.length)}건` + (filteredOut ? " (필터 적용)" : "");
    renderTable($("#search-table"), ev, gapsIn());
    bindRowClicks($("#search-table"), (id) => { state.selected = id; renderSearch(); });
    renderDrawer();
  }
  function bindRowClicks(el, fn) {
    el.querySelectorAll("tr.ev").forEach((r) => {
      r.addEventListener("click", () => fn(r.dataset.id));
      r.tabIndex = 0;
      r.addEventListener("keydown", (k) => { if (k.key === "Enter") fn(r.dataset.id); });
    });
  }
  function renderDrawer() {
    const e = D.events.find((x) => x.id === state.selected);
    const el = $("#drawer");
    if (!e) { el.innerHTML = `<div class="panel-h"><h2>상세</h2></div><div class="panel-b"><div class="empty">행을 고르면 레코드 전체 필드를 보여줍니다</div></div>`; return; }
    const w = e.warrant ? D.warrantById[e.warrant] : null;
    const kv = (rows) => `<dl class="kv">${rows.map(([k, v, cls]) => `<dt>${k}</dt><dd class="${cls || ""}">${v}</dd>`).join("")}</dl>`;
    let payload = "";
    if (e.hook === "exec") payload = kv([["filename", esc(e.filename)], ["dev · ino", `${e.dev} · ${fmtN(e.ino)}`], ["interp", e.interp ? esc(e.interp) : "= filename"], ["setuid", e.setuid ? "S_ISUID — lint 경고 대상" : "아니오"], ["argv", `<span class="dim">${esc(e.argv)}</span>`]]);
    else if (["write", "unlink", "rename"].includes(e.hook)) payload = kv([["path", esc(e.path)], ["dev · ino", `${e.dev} · ${fmtN(e.ino)}`], ["parent ino", fmtN(e.parent_ino)], ["f_flags", esc(e.flags || "—")]]);
    else if (e.hook === "connect") payload = kv([["family", e.family], [e.family === "AF_UNIX" ? "sun_path" : "addr", esc(e.addr)], ["port", e.family === "AF_UNIX" ? "—" : e.port]]);
    else if (e.hook === "agg") payload = kv([["count", fmtN(e.count)], ["window", e.window]]);
    else payload = `<div class="note">${esc(e.note || "")}</div>`;

    el.innerHTML = `
      <div class="panel-h"><h2>${pill(e.verdict)} <span class="mono">${esc(hookLabel(e.hook))}</span></h2><span class="right">${fmtT(e.ts)}</span></div>
      <div class="panel-b">
        <div><h3>귀속</h3>${kv([
          ["주체", w ? `${esc(subjName(e.subject))} <span class="dim">(${esc(D.subjects[e.subject].email)})</span>` : `<span class="chip sev-critical">무영장</span>`, "sans"],
          ["영장", w ? `${esc(w.id)} · <span class="chip mode-${w.mode}">${w.mode}</span>` : "—", "sans"],
          ["정책", w ? esc(`write ${w.policy.write.join(", ") || "없음"} · exec ${w.policy.exec}`) : "—", "sans"],
          ["cgroup_id", `${e.cgroup}${w ? ` <span class="dim">(${esc(w.session)})</span>` : ""}`],
          ["node · seq", `${esc(e.node)} · ${fmtN(e.seq)}`],
        ])}</div>
        <div><h3>프로세스 (공통 메타 §03)</h3>${kv([
          ["pid · tgid", `${e.pid} · ${e.tgid}`],
          ["start_time", `${fmtN(Math.round((e.start_time - (D.NOW - 90 * 24 * 3600 * 1000)) / 1000))}s (boot)`],
          ["ppid", String(e.ppid)],
          ["uid → euid", `${e.uid} → ${e.euid}`],
          ["comm", `<span class="dim">${esc(e.comm)}</span>`],
          ["pid ns · mnt ns", `${e.pid_ns} · ${e.mnt_ns}`],
        ])}</div>
        <div><h3>페이로드</h3>${payload}</div>
        ${e.hook === "exec" ? `<div class="note"><b>argv 는 참고 정보입니다.</b> <span class="mono">exec -a</span> 로 위조되고 BPF 스택 제약으로 잘립니다. 근거는 커널이 실제로 연 바이너리의 (dev, ino) 입니다 (§14).</div>` : ""}
        ${e.euid === 0 ? `<div class="note warn">euid 0 은 신원이 아니라 정황입니다. 신원은 subject_id 에 있습니다 (§03).</div>` : ""}
        ${e.hook === "agg" ? `<div class="note">허용된 쓰기는 개별 기록하지 않습니다. per-CPU 카운터를 5분마다 한 건으로 올린 값입니다 (§11).</div>` : ""}
        ${e.verdict === "WOULD_DENY" ? `<div class="note">dry-run 영장 — 강제 모드였다면 <span class="mono">-EPERM</span>. 같은 판정 함수를 쓰므로 강제 전환 시 결과가 달라지지 않습니다 (§15).</div>` : ""}
      </div>`;
  }

  // ── 세션 타임라인 ────────────────────────────────────────────────
  function renderTimeline() {
    const ws = D.warrants.filter((w) => state.node === "all" || w.node === state.node);
    if (!ws.find((w) => w.id === state.warrant)) state.warrant = ws[0] ? ws[0].id : null;
    $("#wsel").innerHTML = ws.map((w) => {
      const status = w.expires > D.NOW ? `만료 ${rel(w.expires)}` : w.on_expiry === "grace" ? "유예 중" : "만료됨";
      return `<button data-w="${w.id}" aria-pressed="${w.id === state.warrant}"><span class="id">${w.id} <span class="chip mode-${w.mode}">${w.mode}</span></span><span class="meta">${esc(subjName(w.subject))} · ${esc(w.node)} · ${status}</span></button>`;
    }).join("");
    $("#wsel").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => { state.warrant = b.dataset.w; renderTimeline(); }));
    const w = D.warrantById[state.warrant];
    if (!w) { $("#wpanel").innerHTML = `<div class="empty">이 노드에는 영장이 없습니다</div>`; $("#wev-table").innerHTML = ""; return; }

    const ON = { downgrade: "강등 — 세션은 살고 권한만 죽는다", kill: "종료 — scope 프로세스 일괄 종료", grace: "유예 — 세션만 자르고 백그라운드 잡은 grace 까지" };
    const graceEnd = w.on_expiry === "grace" ? w.expires + 120 * MIN : null;
    const t0 = w.lineage[0].t, t1 = Math.max(graceEnd || w.expires, D.NOW) + 5 * MIN;
    const px = (t) => ((t - t0) / (t1 - t0)) * 100;
    const nowRow = w.expires > D.NOW ? `<li class="now"><span class="t">${fmtHM(D.NOW)}</span><span class="dot"></span><span><span class="kind">지금</span> <span class="who">· 만료까지 ${rel(w.expires).replace(" 후", "")}</span></span></li>` : "";
    $("#wpanel").innerHTML = `
      <div class="panel-h"><h2>${w.id}</h2><span class="sub">${esc(w.reason)}</span><span class="right">발급 ${fmtHM(w.issued)} · ${rel(w.issued)}</span></div>
      <div class="panel-b">
        <div class="whead">
          <div><div class="k">주체</div><div class="v">${esc(subjName(w.subject))} <span class="dim">${esc(D.subjects[w.subject].email)}</span></div></div>
          <div><div class="k">대상 · 바인딩</div><div class="v">${esc(w.node)} <span class="mono dim">${esc(w.session)} → cgroup ${w.cgroup}</span></div></div>
          <div><div class="k">정책</div><div class="v">write ${w.policy.write.length ? w.policy.write.map((p) => `<span class="mono">${esc(p)}</span>`).join(", ") : "<span class='dim'>없음(read-only)</span>"} · exec ${esc(w.policy.exec)} · net ${w.policy.net.length ? w.policy.net.map((p) => `<span class="mono">${esc(p)}</span>`).join(", ") : "<span class='dim'>전면 차단</span>"}</div></div>
          <div><div class="k">모드 · 만료 동작</div><div class="v"><span class="chip mode-${w.mode}">${w.mode}</span> ${esc(ON[w.on_expiry])}</div></div>
        </div>
        <div class="bar-life" aria-hidden="true">
          <div class="seg-i" style="left:${px(w.issued)}%;width:${px(w.expires) - px(w.issued)}%"><span class="lbl">발급 ${fmtHM(w.issued)}</span></div>
          ${graceEnd ? `<div class="seg-g" style="left:${px(w.expires)}%;width:${px(graceEnd) - px(w.expires)}%"><span class="lbl">유예 → ${fmtHM(graceEnd)}</span></div>` : ""}
          <div class="nowmark" style="left:${px(D.NOW)}%"></div>
          <span class="lbl" style="right:0">만료 ${fmtHM(w.expires)}</span>
        </div>
        <ul class="lineage">
          ${w.lineage.map((l) => `<li class="${/만료/.test(l.kind) ? "end" : ""}"><span class="t">${fmtHM(l.t)}</span><span class="dot"></span><span><span class="kind">${esc(l.kind)}</span> <span class="who">· ${esc(l.who)}</span><br><span class="note">${esc(l.note)}</span></span></li>`).join("")}
          ${nowRow}
        </ul>
      </div>`;
    const ev = D.events.filter((e) => e.warrant === w.id);
    const gaps = D.gaps.filter((g) => g.node === w.node && g.from >= w.issued);
    $("#wev-count").textContent = `${fmtN(ev.length)}건 · 차단 ${fmtN(ev.filter(blocked).length)} · 유실 구간 ${gaps.length}`;
    renderTable($("#wev-table"), ev, gaps);
    bindRowClicks($("#wev-table"), (id) => { state.selected = id; state.verdict = "all"; state.hook = "all"; state.subject = "all"; state.q = ""; setView("search"); });
  }

  // ── 무영장 세션 ──────────────────────────────────────────────────
  function renderWarrantless() {
    const wl = D.warrantless.filter((s) => state.node === "all" || s.node === state.node);
    if (!wl.find((s) => s.cgroup === state.wlSel)) state.wlSel = wl[0] ? wl[0].cgroup : null;
    $("#wl-table").innerHTML = wl.length ? `<table><thead><tr><th>등급</th><th>노드</th><th>세션 · cgroup</th><th>uid</th><th>출발지</th><th>시작</th><th>귀속 이벤트</th><th>왜 무영장인가</th></tr></thead><tbody>${wl.map((s) => `
      <tr class="ev" data-cg="${s.cgroup}" ${state.wlSel === s.cgroup ? 'aria-selected="true"' : ""} tabindex="0">
        <td><span class="chip sev-${s.severity}">${s.severity}</span></td><td class="hook">${esc(s.node)}</td>
        <td class="hook">${esc(s.session)} · ${s.cgroup}</td><td class="pid">${s.uid}${s.uid === 0 ? " (root)" : ""}</td>
        <td class="hook">${esc(s.from)}</td><td class="t">${fmtT(s.first)} <span class="dim">${rel(s.first)}</span></td>
        <td class="num">${s.count}</td><td>${esc(s.reason)}</td></tr>`).join("")}</tbody></table>` : `<div class="empty">무영장 세션이 없습니다</div>`;
    $("#wl-table").querySelectorAll("tr.ev").forEach((r) => {
      const go = () => { state.wlSel = Number(r.dataset.cg); renderWarrantless(); };
      r.addEventListener("click", go); r.addEventListener("keydown", (k) => { if (k.key === "Enter") go(); });
    });
    const s = wl.find((x) => x.cgroup === state.wlSel);
    if (!s) { $("#wl-ev-table").innerHTML = ""; $("#wl-ev-sub").textContent = ""; return; }
    const ev = D.events.filter((e) => e.warrant === null && e.cgroup === s.cgroup);
    $("#wl-ev-sub").textContent = `${esc(s.node)} · ${s.session} · ${ev.length}건 — exec·connect 만 귀속 기록, 판정 없음`;
    renderTable($("#wl-ev-table"), ev, []);
    bindRowClicks($("#wl-ev-table"), (id) => { state.selected = id; state.subject = "none"; state.verdict = "all"; state.hook = "all"; state.q = ""; setView("search"); });
  }

  // ── 뷰 전환 · 필터 바인딩 ────────────────────────────────────────
  const TITLES = { overview: "개요", search: "감사 검색", timeline: "세션 타임라인", warrantless: "무영장 세션" };
  function setView(v) {
    state.view = v;
    document.querySelectorAll(".view").forEach((s) => { s.hidden = s.id !== `view-${v}`; });
    document.querySelectorAll(".nav button[data-view]").forEach((b) => { if (b.dataset.view === v) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current"); });
    $("#view-title").textContent = TITLES[v];
    syncFilterControls();
    render();
  }
  function syncFilterControls() {
    $("#f-verdict").value = state.verdict; $("#f-hook").value = state.hook; $("#f-subject").value = state.subject; $("#f-q").value = state.q; $("#f-agg").checked = state.agg;
  }
  function render() {
    const all = baseEvents();
    const wlN = D.warrantless.filter((s) => s.last >= since() && (state.node === "all" || s.node === state.node)).length;
    $("#nav-deny").textContent = fmtN(all.filter(blocked).length);
    $("#nav-wl").textContent = wlN || "";
    ({ overview: renderOverview, search: renderSearch, timeline: renderTimeline, warrantless: renderWarrantless })[state.view]();
  }

  function init() {
    $("#now-label").textContent = new Date(D.NOW).toLocaleString("ko-KR", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false });
    const nodeSel = $("#f-node");
    Object.keys(D.nodes).forEach((n) => { const o = document.createElement("option"); o.value = n; o.textContent = `${n} · ${D.nodes[n].mode}`; nodeSel.appendChild(o); });
    const hookSel = $("#f-hook");
    Object.keys(D.HOOKS).forEach((h) => { const o = document.createElement("option"); o.value = h; o.textContent = D.HOOKS[h]; hookSel.appendChild(o); });
    const subSel = $("#f-subject");
    Object.values(D.subjects).forEach((s) => { const o = document.createElement("option"); o.value = s.id; o.textContent = `${s.name} (${s.email})`; subSel.appendChild(o); });

    document.querySelectorAll(".nav button[data-view]").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
    $("#range-seg").querySelectorAll("button").forEach((b) => b.addEventListener("click", () => {
      state.range = Number(b.dataset.range);
      $("#range-seg").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", x === b));
      render();
    }));
    nodeSel.addEventListener("change", () => { state.node = nodeSel.value; render(); });
    $("#f-verdict").addEventListener("change", (e) => { state.verdict = e.target.value; render(); });
    hookSel.addEventListener("change", (e) => { state.hook = e.target.value; render(); });
    subSel.addEventListener("change", (e) => { state.subject = e.target.value; render(); });
    $("#f-agg").addEventListener("change", (e) => { state.agg = e.target.checked; render(); });
    let deb; $("#f-q").addEventListener("input", (e) => { clearTimeout(deb); deb = setTimeout(() => { state.q = e.target.value; render(); }, 120); });

    setView("overview");
  }
  init();
})();
