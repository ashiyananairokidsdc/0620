import React, { useState, useEffect, useMemo } from "react";
import { db } from "./firebase";
import { collection, query, orderBy, onSnapshot, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { seedData } from "./seedData";

/* =========================================================================
   なないろ歯科・こども矯正歯科クリニック 兵庫・芦屋医院
   「当院の矯正を選んでいただいた理由について」アンケート 集計サイト
   - 回答を入力 → 自動集計・グラフ化
   - データは共有ストレージに保存（同じサイトを開いた人全員で集計を共有）
   - CSV書き出し対応
   ========================================================================= */

/* なないろ歯科・こども矯正歯科クリニック 兵庫・芦屋医院 アンケート集計サイト */

/* ---- ブランド／デザイントークン ------------------------------------------ */
const C = {
  bg: "#FBFAF7",
  card: "#FFFFFF",
  ink: "#2A2D34",
  sub: "#6B7280",
  line: "#ECE8E1",
  teal: "#2F8F8A",
  tealDeep: "#256E6A",
  tealTrack: "#EAF2F1",
  // 七色（なないろ）スペクトラム
  spectrum: ["#E07A5F", "#E9A14B", "#E0C04A", "#6FB07F", "#4BA9A1", "#5A8DD6", "#8B7BC7"],
  red: "#E07A5F",
  amber: "#E9A14B",
  green: "#6FB07F",
};
const FONT =
  '"Hiragino Sans","Hiragino Kaku Gothic ProN","Noto Sans JP",Meiryo,system-ui,sans-serif';

/* ---- 設問定義 ------------------------------------------------------------ */
const Q1_OPTS = ["0〜3歳ごろ", "幼稚園・保育園のころ", "小学校低学年", "小学校高学年", "中学生以降"];
const Q2_OPTS = ["園・学校の歯科健診で指摘された", "受診時に歯科で言われた", "仕上げ磨き・食事で気づいた", "きょうだい・周りと比べて", "ネット・SNS・本で知って", "その他"];
const Q3_OPTS = ["ネットで調べた", "ほかの歯科に相談", "市販品・教材を試した", "学校・園で相談", "特に何もしていない"];
const Q4_OPTS = ["なかった（最初から当院だけ）", "1院", "2〜3院", "4院以上"];
const Q5_OPTS = [
  "院長・スタッフの説明が信頼できた",
  "お口の機能・くせの改善（MFT）重視",
  "なるべく歯を抜かない方針",
  "子どもへの接し方・院内の雰囲気",
  "通いやすさ（場所・時間・駐車場）",
  "「英語も学べる」点に魅力",
  "呼吸・発音・成長まで見据える",
  "口コミ・評判・紹介",
  "費用に見合う価値があると納得した",
  "ほかの医院より費用が抑えられた",
  "料金・支払い方法がわかりやすい",
  "その他",
];
const Q6_OPTS = ["その場で決めた", "数日", "1〜2週間", "1か月以上"];
const Q7_OPTS = ["申し込む前から知っていた", "申し込んだ後・通い始めてから", "このアンケートで初めて"];
const Q9_OPTS = ["英会話教室に通わせている／いた", "教材・アプリを使用", "インター系の園・学校", "家庭で取り組み", "特にない"];
const Q10_TIME = ["15分以内", "30分ほど", "1時間ほど", "1時間以上"];
const Q11_OPTS = ["すでに取り組ませている", "関心があり検討中", "特に関心はない"];
const RESPONDENT = ["保護者", "本人"];

const blankForm = () => ({
  // ▼個人情報（匿名集計とは分けて管理する）
  patientNo: "", patientName: "",
  // ▼アンケート本体（匿名集計の対象）
  date: new Date().toISOString().slice(0, 10),
  respondent: "",
  q1: "", q2: [], q2_other: "", q3: [], q4: "",
  q5: [], q5_top: "", q5_other: "",
  q6: "", q7: "", q8: "", q9: [],
  q10_age: "", q10_time: "", q10_city: "",
  q11: "", q12: "", q13: "",
  // ▼後日のお話（任意・協力者のみ別管理）
  followupOk: false, followupName: "", followupContact: "",
});

/* 回答データは Firestore（responses コレクション）で管理します。初期データは ./seedData.js を参照。 */

/* =========================================================================
   小さなUI部品
   ========================================================================= */
function RainbowRule({ height = 4 }) {
  return (
    <div style={{ display: "flex", height, borderRadius: 99, overflow: "hidden" }}>
      {C.spectrum.map((c, i) => (
        <div key={i} style={{ flex: 1, background: c }} />
      ))}
    </div>
  );
}

function Chip({ active, children, onClick, accent = C.teal }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        font: FONT, fontSize: 14, lineHeight: 1.3, cursor: "pointer",
        padding: "9px 14px", borderRadius: 11, textAlign: "left",
        border: `1.5px solid ${active ? accent : C.line}`,
        background: active ? accent : "#fff",
        color: active ? "#fff" : C.ink,
        fontWeight: active ? 600 : 400,
        transition: "all .12s ease",
        boxShadow: active ? `0 2px 8px ${accent}33` : "none",
      }}
    >
      {children}
    </button>
  );
}

function Field({ label, children }) {
  return (
    <label style={{ display: "block", marginBottom: 14 }}>
      <span style={{ display: "block", fontSize: 13, color: C.sub, marginBottom: 6 }}>{label}</span>
      {children}
    </label>
  );
}

const inputStyle = {
  font: FONT, fontSize: 15, color: C.ink, width: "100%", boxSizing: "border-box",
  padding: "10px 12px", borderRadius: 10, border: `1.5px solid ${C.line}`,
  background: "#fff", outline: "none",
};

/* 集計用：横棒リスト（日本語ラベル対応の自前バー） */
function BarList({ items, total, spectrum = false, accent = C.teal }) {
  const max = Math.max(1, ...items.map((i) => i.count));
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {items.map((it, idx) => {
        const pct = total ? Math.round((it.count / total) * 100) : 0;
        const w = (it.count / max) * 100;
        const col = spectrum ? C.spectrum[idx % C.spectrum.length] : accent;
        return (
          <div key={idx}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
              <span style={{ fontSize: 13.5, color: C.ink, lineHeight: 1.35 }}>{it.label}</span>
              <span style={{ fontSize: 12.5, color: C.sub, whiteSpace: "nowrap", fontWeight: 600 }}>
                {it.count}<span style={{ fontWeight: 400 }}> 件 ({pct}%)</span>
              </span>
            </div>
            <div style={{ height: 9, background: C.tealTrack, borderRadius: 99, overflow: "hidden" }}>
              <div style={{ width: `${w}%`, height: "100%", background: col, borderRadius: 99, transition: "width .4s ease" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Panel({ title, eyebrow, accent = C.teal, children, highlight = false }) {
  return (
    <section
      style={{
        background: C.card, borderRadius: 16, padding: "20px 20px 22px",
        border: `1px solid ${C.line}`,
        boxShadow: highlight ? `0 0 0 2px ${accent}22` : "0 1px 2px rgba(0,0,0,.03)",
        marginBottom: 16,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
        <span style={{ width: 5, height: 22, borderRadius: 99, background: accent, display: "inline-block" }} />
        <div>
          {eyebrow && <div style={{ fontSize: 11, letterSpacing: ".08em", color: accent, fontWeight: 700 }}>{eyebrow}</div>}
          <h3 style={{ margin: 0, fontSize: 16, color: C.ink, fontWeight: 700 }}>{title}</h3>
        </div>
      </div>
      {children}
    </section>
  );
}

/* =========================================================================
   集計ヘルパー
   ========================================================================= */
const countSingle = (rows, field, opts) =>
  opts.map((o) => ({ label: o, count: rows.filter((r) => r[field] === o).length }));
const countMulti = (rows, field, opts) =>
  opts.map((o) => ({ label: o, count: rows.filter((r) => Array.isArray(r[field]) && r[field].includes(o)).length }));

/* =========================================================================
   メイン
   ========================================================================= */
export default function SurveyDashboard() {
  /* Firestore のデータ購読（認証なし・そのまま読み書き） */
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dbError, setDbError] = useState("");
  useEffect(() => {
    const qy = query(collection(db, "responses"), orderBy("createdAt", "asc"));
    const unsub = onSnapshot(
      qy,
      (snap) => { setRows(snap.docs.map((d) => ({ ...d.data(), id: d.id }))); setDbError(""); setLoading(false); },
      (err) => { setDbError(err.message); setLoading(false); }
    );
    return unsub;
  }, []);

  /* UI 状態 */
  const [tab, setTab] = useState("dashboard");
  const [form, setForm] = useState(blankForm());
  const [editing, setEditing] = useState(null); // 編集中のドキュメントID
  const [toast, setToast] = useState("");
  const flash = (msg) => { setToast(msg); setTimeout(() => setToast(""), 2400); };

  const genId = () => "m" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  /* フォーム操作 */
  const setSingle = (field, val) => setForm((f) => ({ ...f, [field]: f[field] === val ? "" : val }));
  const toggleMulti = (field, val) =>
    setForm((f) => {
      const arr = f[field] || [];
      const has = arr.includes(val);
      const next = has ? arr.filter((x) => x !== val) : [...arr, val];
      if (field === "q5" && has && f.q5_top === val) return { ...f, q5: next, q5_top: "" };
      return { ...f, [field]: next };
    });

  /* 追加 / 更新 */
  const submit = async () => {
    try {
      if (editing) {
        const { id, createdAt, ...data } = form;
        await updateDoc(doc(db, "responses", editing), { ...data, updatedAt: Date.now() });
        flash("更新しました"); setEditing(null); setForm(blankForm()); setTab("data");
      } else {
        const id = genId();
        await setDoc(doc(db, "responses", id), { ...form, id, createdAt: Date.now() });
        flash("回答を追加しました"); setForm(blankForm()); setTab("dashboard");
      }
    } catch (e) { flash("保存に失敗しました: " + e.message); }
  };

  const startEdit = (row) => { setForm({ ...blankForm(), ...row }); setEditing(row.id); setTab("entry"); window.scrollTo(0, 0); };
  const cancelEdit = () => { setEditing(null); setForm(blankForm()); setTab("data"); };

  const removeRow = async (id) => {
    if (!window.confirm("この回答を削除します。元に戻せません。よろしいですか？")) return;
    try { await deleteDoc(doc(db, "responses", id)); flash("1件削除しました"); }
    catch (e) { flash("削除に失敗しました: " + e.message); }
  };

  /* 初期データ(seed) の取り込み（未登録のみ追加） */
  const importSeed = async () => {
    try {
      const existing = new Set(rows.map((r) => r.id));
      const toAdd = seedData.filter((s) => !existing.has(s.id));
      if (!toAdd.length) { flash("追加する初期データはありません（すべて登録済み）"); return; }
      await Promise.all(toAdd.map((s) => setDoc(doc(db, "responses", s.id), { ...s, createdAt: seedData.indexOf(s) })));
      flash(`初期データを ${toAdd.length} 件取り込みました`);
    } catch (e) { flash("取り込みに失敗しました: " + e.message); }
  };

  /* JSON 貼り付けでまとめて取り込み（id重複はスキップ） */
  const importJson = async (text) => {
    try {
      const arr = JSON.parse(text);
      if (!Array.isArray(arr)) throw new Error("配列(JSON)を貼り付けてください");
      const existing = new Set(rows.map((r) => r.id));
      let added = 0;
      for (let i = 0; i < arr.length; i++) {
        const s = arr[i];
        const id = s.id || genId();
        if (existing.has(id)) continue;
        await setDoc(doc(db, "responses", id), { ...s, id, createdAt: Date.now() + i });
        added++;
      }
      flash(`${added} 件を取り込みました`);
    } catch (e) { flash("JSON取り込みに失敗: " + e.message); }
  };

  /* CSV書き出し（共通） */
  const downloadCsv = (filename, head, lines) => {
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = "\uFEFF" + [head, ...lines].map((r) => r.map(esc).join(",")).join("\r\n");
    try {
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      flash("CSVを書き出しました");
    } catch (e) { flash("この環境では書き出しできませんでした"); }
  };
  const today = () => new Date().toISOString().slice(0, 10);
  const j = (a) => (Array.isArray(a) ? a.join("｜") : a ?? "");
  const exportCsv = () => {
    const head = ["No", "記入日", "記入者", "Q1", "Q2", "Q2その他", "Q3", "Q4", "Q5(選んだ理由)", "Q5(一番の決め手)", "Q5その他", "Q6", "Q7", "Q8影響度", "Q9", "Q10年齢", "Q10所要時間", "Q10市区町村", "Q11", "Q12おすすめ度", "Q13自由記述"];
    const lines = rows.map((r, i) => [i + 1, r.date, r.respondent, r.q1, j(r.q2), r.q2_other, j(r.q3), r.q4, j(r.q5), r.q5_top, r.q5_other, r.q6, r.q7, r.q8, j(r.q9), r.q10_age, r.q10_time, r.q10_city, r.q11, r.q12, r.q13]);
    downloadCsv(`naniiro-集計(匿名)-${today()}.csv`, head, lines);
  };
  const exportRoster = () => {
    const head = ["No", "患者番号", "お名前", "記入日", "記入者"];
    const lines = rows.map((r, i) => [i + 1, r.patientNo, r.patientName, r.date, r.respondent]);
    downloadCsv(`naniiro-回答者名簿-${today()}.csv`, head, lines);
  };
  const exportFollowup = () => {
    const head = ["No", "患者番号", "お名前(本体)", "後日お名前", "ご連絡先", "記入日"];
    const lines = rows.filter((r) => r.followupOk).map((r) => [rows.indexOf(r) + 1, r.patientNo, r.patientName, r.followupName, r.followupContact, r.date]);
    downloadCsv(`naniiro-後日連絡先-${today()}.csv`, head, lines);
  };

  /* 集計 */
  const agg = useMemo(() => {
    const n = rows.length;
    const q12 = rows.filter((r) => r.q12 !== "" && r.q12 != null && !isNaN(Number(r.q12))).map((r) => Number(r.q12));
    const recAvg = q12.length ? (q12.reduce((a, b) => a + b, 0) / q12.length).toFixed(1) : null;
    const q12dist = Array.from({ length: 11 }, (_, k) => ({ label: String(k), count: q12.filter((v) => v === k).length }));
    const q8 = rows.filter((r) => r.q8 !== "" && r.q8 != null && !isNaN(Number(r.q8))).map((r) => Number(r.q8));
    const q8Avg = q8.length ? (q8.reduce((a, b) => a + b, 0) / q8.length).toFixed(1) : null;
    const ages = rows.filter((r) => r.q10_age !== "" && r.q10_age != null && !isNaN(Number(r.q10_age))).map((r) => Number(r.q10_age));
    const ageAvg = ages.length ? (ages.reduce((a, b) => a + b, 0) / ages.length).toFixed(1) : null;
    const englishAppeal = rows.filter((r) => (r.q5 || []).includes("「英語も学べる」点に魅力")).length;
    const knewBefore = rows.filter((r) => r.q7 === "申し込む前から知っていた").length;
    const cities = {};
    rows.forEach((r) => { const c = (r.q10_city || "").trim(); if (c) cities[c] = (cities[c] || 0) + 1; });
    const cityList = Object.entries(cities).sort((a, b) => b[1] - a[1]);
    const comments = rows.filter((r) => (r.q13 || "").trim()).map((r) => ({ id: r.id, text: r.q13, date: r.date }));
    return {
      n, recAvg, q12n: q12.length, q12dist, q8Avg, q8Base: q8.length, ageAvg, ages, englishAppeal, knewBefore, cityList, comments,
      q1: countSingle(rows, "q1", Q1_OPTS), q2: countMulti(rows, "q2", Q2_OPTS), q3: countMulti(rows, "q3", Q3_OPTS),
      q4: countSingle(rows, "q4", Q4_OPTS),
      q5: countMulti(rows, "q5", Q5_OPTS).sort((a, b) => b.count - a.count),
      q5top: countSingle(rows, "q5_top", Q5_OPTS).filter((x) => x.count > 0).sort((a, b) => b.count - a.count),
      q6: countSingle(rows, "q6", Q6_OPTS), q7: countSingle(rows, "q7", Q7_OPTS), q9: countMulti(rows, "q9", Q9_OPTS),
      q10time: countSingle(rows, "q10_time", Q10_TIME), q11: countSingle(rows, "q11", Q11_OPTS),
      resp: countSingle(rows, "respondent", RESPONDENT),
    };
  }, [rows]);
  const ageHist = useMemo(() => {
    const map = {};
    agg.ages.forEach((a) => { map[a] = (map[a] || 0) + 1; });
    return Object.keys(map).map(Number).sort((a, b) => a - b).map((k) => ({ label: `${k}歳`, count: map[k] }));
  }, [agg.ages]);

  /* ---- 画面 ---- */

  return (
    <div style={{ font: FONT, background: C.bg, color: C.ink, minHeight: "100vh", padding: "0 0 60px" }}>
      <style>{`
        * { -webkit-tap-highlight-color: transparent; }
        button:focus-visible, input:focus-visible, textarea:focus-visible { outline: 2px solid ${C.teal}; outline-offset: 2px; }
        input:focus, textarea:focus { border-color: ${C.teal} !important; }
        ::-webkit-scrollbar { height: 8px; width: 8px; }
        ::-webkit-scrollbar-thumb { background: #d8d3ca; border-radius: 99px; }
        @media (prefers-reduced-motion: reduce){ *{transition:none!important} }
      `}</style>

      <header style={{ background: "#fff", borderBottom: `1px solid ${C.line}`, padding: "14px 20px 0" }}>
        <div style={{ maxWidth: 880, margin: "0 auto" }}>
          <div style={{ fontSize: 12.5, color: C.sub, letterSpacing: ".02em" }}>
            なないろ歯科・こども矯正歯科クリニック　兵庫・芦屋医院
          </div>
          <h1 style={{ margin: "4px 0 12px", fontSize: 21, fontWeight: 800, letterSpacing: ".01em" }}>
            当院の矯正を選んでいただいた理由について<span style={{ fontSize: 13, fontWeight: 500, color: C.sub, marginLeft: 8 }}>集計サイト</span>
          </h1>
          <RainbowRule />
          <nav style={{ display: "flex", gap: 4, marginTop: 4, flexWrap: "wrap" }}>
            {[
              ["dashboard", `集計結果${agg.n ? `（${agg.n}）` : ""}`],
              ["data", `回答データ${agg.n ? `（${agg.n}）` : ""}`],
              ["roster", "名簿・後日連絡"],
              ["entry", editing ? "編集中…" : "手入力／取り込み"],
            ].map(([k, label]) => (
              <button key={k} onClick={() => setTab(k)} style={{
                font: FONT, fontSize: 14.5, fontWeight: tab === k ? 700 : 500, cursor: "pointer", background: "none", border: "none",
                color: tab === k ? C.tealDeep : C.sub, padding: "12px 14px", borderBottom: `3px solid ${tab === k ? C.teal : "transparent"}`, marginBottom: -1,
              }}>{label}</button>
            ))}
          </nav>
        </div>
      </header>

      <main style={{ maxWidth: 880, margin: "0 auto", padding: "20px 16px 0" }}>
        {dbError && (
          <div style={{ background: "#FDECEA", border: "1px solid #F5C2BC", color: "#A23B2E", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, lineHeight: 1.6 }}>
            データの読み込みでエラーが発生しました：{dbError}<br />Firestore のルールで読み書きが許可されているか（テスト用に <code>allow read, write: if true;</code>）をご確認ください。
          </div>
        )}
        {loading ? (
          <CenterMsg text="読み込み中…" inline />
        ) : tab === "entry" ? (
          <>
            {!editing && <ImportBox importSeed={importSeed} importJson={importJson} />}
            <EntryForm form={form} setForm={setForm} setSingle={setSingle} toggleMulti={toggleMulti} submit={submit} editing={editing} onCancel={cancelEdit} />
          </>
        ) : tab === "dashboard" ? (
          <Dashboard agg={agg} ageHist={ageHist} goEntry={() => setTab("entry")} />
        ) : tab === "roster" ? (
          <RosterTab rows={rows} exportRoster={exportRoster} exportFollowup={exportFollowup} />
        ) : (
          <DataTab rows={rows} removeRow={removeRow} exportCsv={exportCsv} onEdit={startEdit} />
        )}
      </main>

      {toast && (
        <div style={{ position: "fixed", left: "50%", bottom: 24, transform: "translateX(-50%)", background: C.tealDeep, color: "#fff", padding: "11px 20px", borderRadius: 99, fontSize: 14, fontWeight: 600, boxShadow: "0 6px 20px rgba(0,0,0,.18)", zIndex: 50, maxWidth: "90%", textAlign: "center" }}>
          {toast}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   ローディング表示
   ========================================================================= */
function CenterMsg({ text, inline }) {
  return <div style={{ textAlign: "center", color: C.sub, padding: inline ? 40 : "20vh 20px", font: FONT }}>{text}</div>;
}

/* =========================================================================
   取り込みボックス（seed / JSON）
   ========================================================================= */
function ImportBox({ importSeed, importJson }) {
  const [open, setOpen] = useState(false);
  const [json, setJson] = useState("");
  return (
    <div style={{ background: "#F3F8F7", border: `1px solid ${C.tealTrack}`, borderRadius: 14, padding: "14px 16px", marginBottom: 16 }}>
      <div style={{ fontSize: 13.5, fontWeight: 700, color: C.tealDeep, marginBottom: 4 }}>データの取り込み</div>
      <p style={{ fontSize: 12.5, color: C.sub, lineHeight: 1.6, margin: "0 0 12px" }}>
        画像をClaudeに読み取ってもらった結果を反映する場所です。<code>seedData.js</code> を更新して push したら、下のボタンで未登録分を取り込みます。
      </p>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={importSeed} style={{ background: C.teal, color: "#fff", border: "none", padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", font: FONT }}>
          初期データ(seed)を取り込む
        </button>
        <button onClick={() => setOpen((v) => !v)} style={{ background: "#fff", color: C.tealDeep, border: `1.5px solid ${C.line}`, padding: "10px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: "pointer", font: FONT }}>
          JSONを貼り付けて取り込む
        </button>
      </div>
      {open && (
        <div style={{ marginTop: 12 }}>
          <textarea rows={5} value={json} onChange={(e) => setJson(e.target.value)} placeholder='[{"id":"r6","patientNo":"...","patientName":"...", ...}]'
            style={{ ...inputStyle, resize: "vertical", fontFamily: "monospace", fontSize: 12.5 }} />
          <button onClick={() => { importJson(json); setJson(""); }} disabled={!json.trim()} style={{
            marginTop: 8, background: json.trim() ? C.tealDeep : "#ccc", color: "#fff", border: "none", padding: "9px 16px", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: json.trim() ? "pointer" : "default", font: FONT,
          }}>取り込む</button>
        </div>
      )}
    </div>
  );
}


/* =========================================================================
   入力フォーム
   ========================================================================= */
function SectionHead({ letter, title, color }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 9, margin: "22px 0 12px" }}>
      <span style={{
        background: color, color: "#fff", fontWeight: 800, fontSize: 13,
        width: 26, height: 26, borderRadius: 7, display: "grid", placeItems: "center",
      }}>{letter}</span>
      <span style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</span>
    </div>
  );
}
function ChipRow({ children }) {
  return <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{children}</div>;
}

function EntryForm({ form, setForm, setSingle, toggleMulti, submit, editing, onCancel }) {
  const QLabel = ({ q, children, hint }) => (
    <div style={{ marginBottom: 9, marginTop: 16 }}>
      <span style={{ background: C.teal, color: "#fff", fontSize: 11.5, fontWeight: 700, padding: "2px 7px", borderRadius: 5, marginRight: 8 }}>{q}</span>
      <span style={{ fontSize: 14.5, fontWeight: 600 }}>{children}</span>
      {hint && <span style={{ fontSize: 12, color: C.sub, marginLeft: 6 }}>{hint}</span>}
    </div>
  );

  return (
    <div style={{ background: C.card, border: `1px solid ${C.line}`, borderRadius: 16, padding: "8px 20px 24px", marginBottom: 16 }}>
      {editing && (
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, marginTop: 14, marginBottom: 2, padding: "10px 14px", background: "#EAF2F1", borderRadius: 10 }}>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: C.tealDeep }}>この回答を編集中</span>
          <button onClick={onCancel} style={{ font: FONT, fontSize: 13, color: C.sub, background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, padding: "5px 12px", cursor: "pointer" }}>編集をやめる</button>
        </div>
      )}
      {/* 基本情報 */}
      {/* 個人情報（匿名集計とは別管理） */}
      <div style={{ marginTop: 16, padding: "12px 14px", background: "#FFF6EC", border: `1px solid #F0DEC4`, borderRadius: 12 }}>
        <div style={{ fontSize: 12, color: "#9A6B2F", fontWeight: 700, marginBottom: 8 }}>
          個人情報（学会用の匿名集計には含めず、「名簿」で別管理します）
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
          <Field label="患者番号">
            <input style={{ ...inputStyle, width: 160 }} value={form.patientNo}
              onChange={(e) => setForm((f) => ({ ...f, patientNo: e.target.value }))} placeholder="例）6" />
          </Field>
          <Field label="お名前">
            <input style={{ ...inputStyle, width: 220 }} value={form.patientName}
              onChange={(e) => setForm((f) => ({ ...f, patientName: e.target.value }))} placeholder="例）蛭川 結友" />
          </Field>
        </div>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 16 }}>
        <Field label="記入日">
          <input type="date" style={{ ...inputStyle, width: 180 }} value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} />
        </Field>
        <div>
          <span style={{ display: "block", fontSize: 13, color: C.sub, marginBottom: 6 }}>記入者</span>
          <ChipRow>
            {RESPONDENT.map((o) => <Chip key={o} active={form.respondent === o} onClick={() => setSingle("respondent", o)}>{o}</Chip>)}
          </ChipRow>
        </div>
      </div>

      {/* A */}
      <SectionHead letter="A" title="お子さまのお口について" color={C.spectrum[0]} />
      <QLabel q="Q1" hint="（1つ）">歯並び・お口のこと（むし歯以外）が気になり始めたのはいつ頃ですか</QLabel>
      <ChipRow>{Q1_OPTS.map((o) => <Chip key={o} active={form.q1 === o} onClick={() => setSingle("q1", o)}>{o}</Chip>)}</ChipRow>

      <QLabel q="Q2" hint="（いくつでも）">気になったきっかけは何でしたか</QLabel>
      <ChipRow>{Q2_OPTS.map((o) => <Chip key={o} active={form.q2.includes(o)} onClick={() => toggleMulti("q2", o)}>{o}</Chip>)}</ChipRow>
      {form.q2.includes("その他") && <input style={{ ...inputStyle, marginTop: 8 }} placeholder="その他（自由記入）" value={form.q2_other} onChange={(e) => setForm((f) => ({ ...f, q2_other: e.target.value }))} />}

      <QLabel q="Q3" hint="（いくつでも）">来院前に、ご家庭で調べたり相談したりしたことは</QLabel>
      <ChipRow>{Q3_OPTS.map((o) => <Chip key={o} active={form.q3.includes(o)} onClick={() => toggleMulti("q3", o)}>{o}</Chip>)}</ChipRow>

      {/* B */}
      <SectionHead letter="B" title="当院を選ぶまで" color={C.spectrum[1]} />
      <QLabel q="Q4" hint="（1つ）">当院以外に検討した歯科・サービスは</QLabel>
      <ChipRow>{Q4_OPTS.map((o) => <Chip key={o} active={form.q4 === o} onClick={() => setSingle("q4", o)}>{o}</Chip>)}</ChipRow>

      <QLabel q="Q5" hint="（当てはまるものすべて）">当院に決めた理由を選んでください</QLabel>
      <ChipRow>{Q5_OPTS.map((o) => <Chip key={o} active={form.q5.includes(o)} onClick={() => toggleMulti("q5", o)}>{o}</Chip>)}</ChipRow>
      {form.q5.includes("その他") && <input style={{ ...inputStyle, marginTop: 8 }} placeholder="その他（自由記入）" value={form.q5_other} onChange={(e) => setForm((f) => ({ ...f, q5_other: e.target.value }))} />}
      {form.q5.length > 0 && (
        <div style={{ marginTop: 12, padding: "12px 14px", background: C.tealTrack, borderRadius: 11 }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.tealDeep, marginBottom: 8 }}>◎ 一番の決め手（1つ）</div>
          <ChipRow>{form.q5.map((o) => <Chip key={o} active={form.q5_top === o} accent={C.tealDeep} onClick={() => setForm((f) => ({ ...f, q5_top: f.q5_top === o ? "" : o }))}>{o}</Chip>)}</ChipRow>
        </div>
      )}

      <QLabel q="Q6" hint="（1つ）">当院を知ってから申し込むまでの期間は</QLabel>
      <ChipRow>{Q6_OPTS.map((o) => <Chip key={o} active={form.q6 === o} onClick={() => setSingle("q6", o)}>{o}</Chip>)}</ChipRow>

      {/* C */}
      <SectionHead letter="C" title="英語が学べるこども矯正について" color={C.spectrum[3]} />
      <QLabel q="Q7" hint="（1つ）">「英語も学べるこども矯正」だと知ったのはいつですか</QLabel>
      <ChipRow>{Q7_OPTS.map((o) => <Chip key={o} active={form.q7 === o} onClick={() => setSingle("q7", o)}>{o}</Chip>)}</ChipRow>

      <QLabel q="Q8" hint="影響なし 1 → 5 強く影響">選ぶ決め手にどのくらい影響しましたか</QLabel>
      <ChipRow>{[1, 2, 3, 4, 5].map((n) => <Chip key={n} active={form.q8 === String(n)} onClick={() => setSingle("q8", String(n))}>{n}</Chip>)}</ChipRow>

      <QLabel q="Q9" hint="（いくつでも）">お子さまの英語のために取り組んできたことは</QLabel>
      <ChipRow>{Q9_OPTS.map((o) => <Chip key={o} active={form.q9.includes(o)} onClick={() => toggleMulti("q9", o)}>{o}</Chip>)}</ChipRow>

      {/* D */}
      <SectionHead letter="D" title="お子さま・ご家庭について" color={C.spectrum[5]} />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 8 }}>
        <Field label="Q10 お子さまの年齢（歳）">
          <input type="number" inputMode="numeric" style={{ ...inputStyle, width: 120 }} value={form.q10_age}
            onChange={(e) => setForm((f) => ({ ...f, q10_age: e.target.value }))} placeholder="例）7" />
        </Field>
        <Field label="お住まいの市区町村">
          <input style={{ ...inputStyle, width: 220 }} value={form.q10_city}
            onChange={(e) => setForm((f) => ({ ...f, q10_city: e.target.value }))} placeholder="例）芦屋市" />
        </Field>
      </div>
      <div style={{ marginTop: 2 }}>
        <span style={{ display: "block", fontSize: 13, color: C.sub, marginBottom: 6 }}>来院にかかる時間</span>
        <ChipRow>{Q10_TIME.map((o) => <Chip key={o} active={form.q10_time === o} onClick={() => setSingle("q10_time", o)}>{o}</Chip>)}</ChipRow>
      </div>

      <QLabel q="Q11" hint="（1つ）">ご家庭の英語学習への関心は</QLabel>
      <ChipRow>{Q11_OPTS.map((o) => <Chip key={o} active={form.q11 === o} onClick={() => setSingle("q11", o)}>{o}</Chip>)}</ChipRow>

      {/* E */}
      <SectionHead letter="E" title="最後に" color={C.spectrum[6]} />
      <QLabel q="Q12" hint="すすめない 0 → 10 とても">ご友人やご家族にどのくらいおすすめしたいですか</QLabel>
      <ChipRow>{Array.from({ length: 11 }, (_, i) => i).map((n) => <Chip key={n} active={form.q12 === String(n)} onClick={() => setSingle("q12", String(n))}>{n}</Chip>)}</ChipRow>

      <QLabel q="Q13">選んでよかった点・改善してほしい点など（自由記述）</QLabel>
      <textarea rows={3} style={{ ...inputStyle, resize: "vertical" }} value={form.q13}
        onChange={(e) => setForm((f) => ({ ...f, q13: e.target.value }))} placeholder="自由にご記入ください" />

      {/* 後日のお話（任意・別管理） */}
      <div style={{ marginTop: 22, padding: "14px 16px", background: "#FFF6EC", border: "1px dashed #E2B26A", borderRadius: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: "#9A6B2F", marginBottom: 4 }}>▶ 後日のお話（任意のお願い）</div>
        <div style={{ fontSize: 12.5, color: "#9A6B2F", marginBottom: 10 }}>後日15分ほど、選んだ理由を詳しくお聞かせいただける方。連絡先は協力者リストで別管理します。</div>
        <Chip active={form.followupOk} accent="#C98A3A" onClick={() => setForm((f) => ({ ...f, followupOk: !f.followupOk }))}>
          {form.followupOk ? "☑ 協力できます" : "協力できます"}
        </Chip>
        {form.followupOk && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 12 }}>
            <Field label="お名前">
              <input style={{ ...inputStyle, width: 200 }} value={form.followupName}
                onChange={(e) => setForm((f) => ({ ...f, followupName: e.target.value }))} />
            </Field>
            <Field label="ご連絡先">
              <input style={{ ...inputStyle, width: 240 }} value={form.followupContact}
                onChange={(e) => setForm((f) => ({ ...f, followupContact: e.target.value }))} placeholder="電話／メール など" />
            </Field>
          </div>
        )}
      </div>

      <button onClick={submit} style={{
        marginTop: 24, width: "100%", padding: "15px", borderRadius: 12, border: "none",
        background: C.teal, color: "#fff", fontSize: 16, fontWeight: 800, cursor: "pointer",
        boxShadow: `0 4px 14px ${C.teal}44`, font: FONT,
      }}>
        {editing ? "この内容で更新する" : "この回答を追加する"}
      </button>
      {editing && (
        <button onClick={onCancel} style={{ marginTop: 10, width: "100%", padding: "12px", borderRadius: 12, border: `1.5px solid ${C.line}`, background: "#fff", color: C.sub, fontSize: 14.5, fontWeight: 700, cursor: "pointer", font: FONT }}>
          編集をやめる（変更を破棄）
        </button>
      )}
    </div>
  );
}

/* =========================================================================
   ダッシュボード
   ========================================================================= */
function Metric({ value, label, sub, color = C.teal }) {
  return (
    <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "16px 18px", flex: "1 1 150px", minWidth: 140 }}>
      <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.ink, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 11.5, color: C.sub, marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Dashboard({ agg, ageHist, goEntry }) {
  if (agg.n === 0) {
    return (
      <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 16, padding: "48px 24px", textAlign: "center" }}>
        <RainbowRule height={4} />
        <p style={{ fontSize: 16, fontWeight: 700, margin: "20px 0 6px" }}>まだ回答がありません</p>
        <p style={{ fontSize: 14, color: C.sub, margin: "0 0 20px", lineHeight: 1.7 }}>
          記入済みアンケートの写真をClaudeに送ってください。<br />読み取って1件ずつ集計に反映します。手入力で追加することもできます。
        </p>
        <button onClick={goEntry} style={{ background: C.teal, color: "#fff", border: "none", padding: "11px 22px", borderRadius: 10, fontSize: 14.5, fontWeight: 700, cursor: "pointer", font: FONT }}>手入力で追加する</button>
      </div>
    );
  }
  const pct = (x) => (agg.n ? Math.round((x / agg.n) * 100) : 0);

  return (
    <div>
      {/* ヘッドライン */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 12, marginBottom: 16 }}>
        <Metric value={agg.n} label="回答数" sub="合計" color={C.tealDeep} />
        <Metric value={agg.recAvg ?? "—"} label="平均おすすめ度" sub={`Q12（0〜10）/ n=${agg.q12n}`} color={C.green} />
        <Metric value={`${pct(agg.englishAppeal)}%`} label="「英語も学べる」が魅力" sub={`Q5 / ${agg.englishAppeal}件が選択`} color={C.spectrum[3]} />
      </div>

      {/* Q5 当院を選んだ理由（最重要） */}
      <Panel title="当院に決めた一番の決め手（◎）" eyebrow="MOST IMPORTANT — Q5" accent={C.teal} highlight>
        {agg.q5top.length ? (
          <BarList items={agg.q5top} total={agg.n} spectrum />
        ) : (
          <p style={{ fontSize: 13.5, color: C.sub, margin: 0 }}>「一番の決め手（◎）」が入力された回答はまだありません。</p>
        )}
      </Panel>
      <Panel title="当院に決めた理由（すべて／複数選択）" eyebrow="Q5 — ALL SELECTED" accent={C.tealDeep}>
        <BarList items={agg.q5} total={agg.n} />
      </Panel>

      {/* Q12 おすすめ度の分布 */}
      <Panel title="おすすめ度の分布" eyebrow="Q12 ── 0〜10点" accent={C.green}>
        <div style={{ fontSize: 13, color: C.sub, marginBottom: 12 }}>
          平均 <b style={{ color: C.ink, fontSize: 16 }}>{agg.recAvg ?? "—"}</b> ／ 10点満点（回答 {agg.q12n} 件）
        </div>
        <SubHead>点数ごとの回答数（0＝すすめない 〜 10＝とても）</SubHead>
        <BarList items={agg.q12dist} total={agg.q12n} accent={C.green} />
      </Panel>

      {/* 英語まわり */}
      <Panel title="「英語も学べるこども矯正」について" eyebrow="C — ENGLISH" accent={C.spectrum[3]}>
        <SubHead>Q7 知ったタイミング</SubHead>
        <BarList items={agg.q7} total={agg.n} accent={C.spectrum[3]} />
        <div style={{ display: "flex", gap: 12, margin: "16px 0", flexWrap: "wrap" }}>
          <Metric value={agg.q8Avg ?? "—"} label="Q8 英語の影響度（平均）" sub={agg.q8Base ? `1〜5 / n=${agg.q8Base}` : "—"} color={C.spectrum[3]} />
          <Metric value={`${pct(agg.knewBefore)}%`} label="申込前から英語点を認知" sub={`Q7 / ${agg.knewBefore}件`} color={C.spectrum[5]} />
        </div>
        <SubHead>Q9 これまでの英語の取り組み</SubHead>
        <BarList items={agg.q9} total={agg.n} accent={C.spectrum[3]} />
        <div style={{ height: 12 }} />
        <SubHead>Q11 ご家庭の英語学習への関心</SubHead>
        <BarList items={agg.q11} total={agg.n} accent={C.spectrum[3]} />
      </Panel>

      {/* 認知〜検討プロセス */}
      <Panel title="気づき・検討のプロセス" eyebrow="A・B — JOURNEY" accent={C.spectrum[1]}>
        <SubHead>Q1 気になり始めた時期</SubHead><BarList items={agg.q1} total={agg.n} accent={C.spectrum[1]} />
        <Gap /><SubHead>Q2 気になったきっかけ</SubHead><BarList items={agg.q2} total={agg.n} accent={C.spectrum[1]} />
        <Gap /><SubHead>Q3 来院前に調べた・相談したこと</SubHead><BarList items={agg.q3} total={agg.n} accent={C.spectrum[1]} />
        <Gap /><SubHead>Q4 当院以外に検討した数</SubHead><BarList items={agg.q4} total={agg.n} accent={C.spectrum[1]} />
        <Gap /><SubHead>Q6 知ってから申込みまでの期間</SubHead><BarList items={agg.q6} total={agg.n} accent={C.spectrum[1]} />
      </Panel>

      {/* 家庭の属性 */}
      <Panel title="お子さま・ご家庭の属性" eyebrow="D — PROFILE" accent={C.spectrum[5]}>
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          <Metric value={agg.ageAvg ?? "—"} label="平均年齢（歳）" color={C.spectrum[5]} />
          <Metric value={agg.resp.find((x) => x.label === "保護者")?.count ?? 0} label="記入者：保護者" sub={`本人 ${agg.resp.find((x) => x.label === "本人")?.count ?? 0}件`} color={C.spectrum[5]} />
        </div>
        {ageHist.length > 0 && (<><SubHead>年齢の分布</SubHead><BarList items={ageHist} total={agg.n} accent={C.spectrum[5]} /><Gap /></>)}
        <SubHead>Q10 来院にかかる時間</SubHead><BarList items={agg.q10time} total={agg.n} accent={C.spectrum[5]} />
        {agg.cityList.length > 0 && (
          <><Gap /><SubHead>お住まいの市区町村</SubHead>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {agg.cityList.map(([c, v]) => (
                <span key={c} style={{ fontSize: 13, background: C.tealTrack, color: C.tealDeep, padding: "5px 11px", borderRadius: 99, fontWeight: 600 }}>{c} <b>{v}</b></span>
              ))}
            </div></>
        )}
      </Panel>

      {/* 自由記述 */}
      <Panel title="自由記述（Q13）" eyebrow="E — VOICES" accent={C.spectrum[6]}>
        {agg.comments.length ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {agg.comments.map((c) => (
              <div key={c.id} style={{ borderLeft: `3px solid ${C.spectrum[6]}`, paddingLeft: 12 }}>
                <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>{c.text}</p>
                <span style={{ fontSize: 11.5, color: C.sub }}>{c.date}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ fontSize: 13.5, color: C.sub, margin: 0 }}>自由記述の入力はまだありません。</p>}
      </Panel>

      <p style={{ fontSize: 11.5, color: C.sub, textAlign: "center", marginTop: 24 }}>
        ※ 回答データはClaudeがアンケート画像から読み取って管理しています。読み間違いがあれば「回答データ」タブで確認のうえお知らせください。第4回 IAPD Global Summit 2026 発表用の集計にどうぞ。
      </p>
    </div>
  );
}
const SubHead = ({ children }) => <div style={{ fontSize: 13, fontWeight: 700, color: C.sub, margin: "0 0 10px" }}>{children}</div>;
const Gap = () => <div style={{ height: 18 }} />;

/* =========================================================================
   データ管理タブ
   ========================================================================= */
function DataTab({ rows, removeRow, exportCsv, onEdit }) {
  const fmt = (v) => (Array.isArray(v) ? (v.length ? v.join("、") : "—") : (v ?? "") === "" ? "—" : v);
  const FieldRow = ({ q, label, value, accent }) => (
    <div style={{ display: "flex", gap: 8, padding: "6px 0", borderTop: `1px solid ${C.line}` }}>
      <span style={{ flex: "0 0 96px", fontSize: 12, color: accent || C.sub, fontWeight: 700 }}>{q} {label}</span>
      <span style={{ flex: 1, fontSize: 13.5, color: C.ink, lineHeight: 1.45 }}>{value}</span>
    </div>
  );

  return (
    <div>
      <div style={{ background: C.tealTrack, borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: C.tealDeep, lineHeight: 1.6 }}>
        原本（写真）と見比べて確認できます。違う箇所は各カードの<b>「編集」</b>から直接修正できます（Firestoreに保存されます）。Claudeに直してもらう場合は「#番号のQ◯は◯◯」とお知らせください。
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={exportCsv} disabled={!rows.length} style={{
          background: rows.length ? C.teal : "#ccc", color: "#fff", border: "none",
          padding: "11px 18px", borderRadius: 10, fontSize: 14.5, fontWeight: 700,
          cursor: rows.length ? "pointer" : "default", font: FONT,
        }}>CSVを書き出す（{rows.length}件）</button>
        <span style={{ fontSize: 12.5, color: C.sub }}>Excel・スプレッドシートでそのまま開けます（UTF-8 / BOM付き）</span>
      </div>

      {rows.length === 0 ? (
        <div style={{ background: "#fff", border: `1px dashed ${C.line}`, borderRadius: 16, padding: 40, textAlign: "center", color: C.sub }}>
          まだ回答データがありません。アンケートの写真を送ってください。
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {rows.map((r, i) => (
            <div key={r.id} style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: C.tealDeep }}>
                  #{i + 1}
                  <span style={{ fontSize: 13, fontWeight: 700, color: C.ink, marginLeft: 10 }}>
                    {r.patientNo ? `No.${r.patientNo} ` : ""}{r.patientName || "（名前未記入）"}
                  </span>
                  <span style={{ fontSize: 12.5, fontWeight: 500, color: C.sub, marginLeft: 8 }}>
                    {r.date || "日付なし"}・{r.respondent || "記入者未記入"}
                  </span>
                </span>
                <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                  <button onClick={() => onEdit(r)} style={{ background: "none", border: "none", color: C.tealDeep, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>編集</button>
                  <button onClick={() => removeRow(r.id)} style={{ background: "none", border: "none", color: C.red, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>削除</button>
                </div>
              </div>
              <FieldRow q="Q1" label="時期" value={fmt(r.q1)} />
              <FieldRow q="Q2" label="きっかけ" value={fmt(r.q2) + (r.q2_other ? `（その他：${r.q2_other}）` : "")} />
              <FieldRow q="Q3" label="事前行動" value={fmt(r.q3)} />
              <FieldRow q="Q4" label="検討数" value={fmt(r.q4)} />
              <FieldRow q="Q5" label="決めた理由" value={fmt(r.q5) + (r.q5_other ? `（その他：${r.q5_other}）` : "")} accent={C.teal} />
              <FieldRow q="Q5◎" label="一番の決め手" value={fmt(r.q5_top)} accent={C.teal} />
              <FieldRow q="Q6" label="申込まで" value={fmt(r.q6)} />
              <FieldRow q="Q7" label="英語認知" value={fmt(r.q7)} accent={C.spectrum[3]} />
              <FieldRow q="Q8" label="英語影響度" value={fmt(r.q8)} accent={C.spectrum[3]} />
              <FieldRow q="Q9" label="英語の取組" value={fmt(r.q9)} accent={C.spectrum[3]} />
              <FieldRow q="Q10" label="年齢/時間/地域" value={`${fmt(r.q10_age)}歳 ／ ${fmt(r.q10_time)} ／ ${fmt(r.q10_city)}`} />
              <FieldRow q="Q11" label="英語関心" value={fmt(r.q11)} />
              <FieldRow q="Q12" label="おすすめ度" value={fmt(r.q12)} accent={C.green} />
              <FieldRow q="Q13" label="自由記述" value={fmt(r.q13)} />
              <FieldRow q="後日" label="協力" value={r.followupOk ? `協力OK（${fmt(r.followupName)} / ${fmt(r.followupContact)}）` : "—"} accent="#C98A3A" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* =========================================================================
   名簿・後日連絡タブ（個人情報の別管理）
   ========================================================================= */
const _btn = (enabled, color = C.teal) => ({
  background: enabled ? color : "#ccc", color: "#fff", border: "none",
  padding: "11px 18px", borderRadius: 10, fontSize: 14.5, fontWeight: 700,
  cursor: enabled ? "pointer" : "default", font: FONT,
});
const _table = { borderCollapse: "collapse", width: "100%", fontSize: 13, minWidth: 520 };
const _thead = { background: C.tealTrack, color: C.tealDeep, textAlign: "left" };
const _th = { padding: "10px 12px", fontWeight: 700, whiteSpace: "nowrap" };
const _td = { padding: "10px 12px", verticalAlign: "top", lineHeight: 1.4 };
const Empty = ({ text }) => <div style={{ color: C.sub, fontSize: 13.5, padding: "8px 2px" }}>{text}</div>;

function RosterTab({ rows, exportRoster, exportFollowup }) {
  const followers = rows.filter((r) => r.followupOk);
  return (
    <div>
      <div style={{ background: "#FFF6EC", border: "1px solid #F0DEC4", borderRadius: 12, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#9A6B2F", lineHeight: 1.6 }}>
        ここは患者個人を特定する情報の管理欄です。学会発表用の匿名集計とは切り離して扱います。取り扱いにご注意ください。
      </div>

      <Panel title="回答者名簿（患者番号・お名前）" eyebrow="ROSTER ── 個人情報" accent={C.tealDeep}>
        <div style={{ marginBottom: 12 }}>
          <button onClick={exportRoster} disabled={!rows.length} style={_btn(rows.length)}>名簿CSVを書き出す（{rows.length}件）</button>
        </div>
        {rows.length === 0 ? <Empty text="まだ回答がありません。" /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={_table}>
              <thead><tr style={_thead}>{["No", "患者番号", "お名前", "記入日", "記入者"].map((h) => <th key={h} style={_th}>{h}</th>)}</tr></thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                    <td style={_td}>{i + 1}</td>
                    <td style={_td}>{r.patientNo || "—"}</td>
                    <td style={{ ..._td, fontWeight: 600 }}>{r.patientName || "—"}</td>
                    <td style={_td}>{r.date || "—"}</td>
                    <td style={_td}>{r.respondent || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="後日のお話 協力者リスト" eyebrow={`FOLLOW-UP ── ${followers.length}名`} accent="#C98A3A">
        <div style={{ marginBottom: 12 }}>
          <button onClick={exportFollowup} disabled={!followers.length} style={_btn(followers.length, "#C98A3A")}>連絡先CSVを書き出す（{followers.length}名）</button>
        </div>
        {followers.length === 0 ? <Empty text="「協力できます」と回答した方はまだいません。" /> : (
          <div style={{ overflowX: "auto" }}>
            <table style={_table}>
              <thead><tr style={{ ..._thead, background: "#FBEFD9", color: "#9A6B2F" }}>{["No", "患者番号", "お名前", "ご連絡先", "記入日"].map((h) => <th key={h} style={_th}>{h}</th>)}</tr></thead>
              <tbody>
                {followers.map((r) => {
                  const no = rows.indexOf(r) + 1;
                  return (
                    <tr key={r.id} style={{ borderTop: `1px solid ${C.line}` }}>
                      <td style={_td}>{no}</td>
                      <td style={_td}>{r.patientNo || "—"}</td>
                      <td style={{ ..._td, fontWeight: 600 }}>{r.followupName || r.patientName || "—"}</td>
                      <td style={_td}>{r.followupContact || "—"}</td>
                      <td style={_td}>{r.date || "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
