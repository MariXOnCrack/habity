import { useState } from "react";

const TODAY_IDX = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
const DAY_LABELS = ["Mo","Tu","We","Th","Fr","Sa","Su"];

const SEED = [
  { id: 1, name: "Morning pages",       streak: 8,  weekLog: [true,true,false,true,true,false,false] },
  { id: 2, name: "Drink enough water",  streak: 14, weekLog: [true,true,true,true,true,true,false] },
  { id: 3, name: "Walk outside",        streak: 3,  weekLog: [false,true,false,true,true,false,false] },
  { id: 4, name: "No phone after 9pm",  streak: 5,  weekLog: [true,true,true,false,true,false,false] },
];

export default function HabitTracker() {
  const [habits, setHabits] = useState(
    SEED.map(h => ({ ...h, done: h.weekLog[TODAY_IDX] }))
  );
  const [showAdd, setShowAdd]   = useState(false);
  const [newName, setNewName]   = useState("");
  const [nextId, setNextId]     = useState(20);

  const done  = habits.filter(h => h.done).length;
  const total = habits.length;

  const toggle = id =>
    setHabits(prev => prev.map(h => {
      if (h.id !== id) return h;
      const d = !h.done;
      const log = [...h.weekLog]; log[TODAY_IDX] = d;
      return { ...h, done: d, weekLog: log, streak: d ? h.streak + 1 : Math.max(0, h.streak - 1) };
    }));

  const add = () => {
    if (!newName.trim()) return;
    setHabits(prev => [...prev, { id: nextId, name: newName.trim(), streak: 0, weekLog: Array(7).fill(false), done: false }]);
    setNextId(n => n + 1); setNewName(""); setShowAdd(false);
  };

  const remove = id => setHabits(prev => prev.filter(h => h.id !== id));

  const dateStr = new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

  return (
    <div style={{ minHeight:"100vh", background:"#0f0f0d", fontFamily:"'DM Sans','Helvetica Neue',sans-serif", color:"#e0ddd7", display:"flex", justifyContent:"center", padding:"3rem 1.25rem" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=DM+Serif+Display:ital@1&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        .row{display:flex;align-items:center;gap:14px;padding:14px 0;border-bottom:1px solid #1e1e1b;transition:opacity .2s;}
        .row:last-child{border-bottom:none;}
        .row.done-row{opacity:.4;}
        .chk{width:20px;height:20px;border-radius:50%;border:1.5px solid #3a3a36;background:transparent;flex-shrink:0;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:border-color .2s,background .2s;}
        .chk.on{border-color:#c4c0b8;background:#c4c0b8;}
        .chk:hover{border-color:#706e68;}
        .chk.on:hover{background:#b5b1a9;border-color:#b5b1a9;}
        .rm{opacity:0;background:none;border:none;color:#3a3a36;cursor:pointer;font-size:12px;padding:0 2px;transition:opacity .15s,color .15s;line-height:1;flex-shrink:0;}
        .row:hover .rm{opacity:1;}
        .rm:hover{color:#706e68;}
        .add-pill{display:flex;align-items:center;gap:8px;background:none;border:1px dashed #252522;border-radius:999px;padding:9px 18px;color:#3d3c39;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;transition:border-color .2s,color .2s;margin-top:1.75rem;}
        .add-pill:hover{border-color:#3a3a36;color:#706e68;}
        .inp{width:100%;background:transparent;border:none;border-bottom:1px solid #252522;color:#e0ddd7;font-family:'DM Sans',sans-serif;font-size:15px;padding:10px 0;outline:none;transition:border-color .2s;}
        .inp:focus{border-bottom-color:#555350;}
        .inp::placeholder{color:#2e2e2b;}
        .save{background:#c4c0b8;color:#0f0f0d;border:none;border-radius:999px;padding:9px 22px;font-family:'DM Sans',sans-serif;font-size:13px;font-weight:500;cursor:pointer;transition:background .2s;letter-spacing:.02em;}
        .save:hover{background:#d0ccc4;}
        .cancel{background:transparent;color:#3d3c39;border:none;font-family:'DM Sans',sans-serif;font-size:13px;cursor:pointer;padding:9px 0;transition:color .15s;}
        .cancel:hover{color:#706e68;}
        .dot{border-radius:999px;transition:background .3s;}
      `}</style>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&family=DM+Serif+Display:ital@1&display=swap" rel="stylesheet" />

      <div style={{ width:"100%", maxWidth:400 }}>

        {/* Header */}
        <div style={{ marginBottom:"2.5rem" }}>
          <p style={{ fontSize:12, color:"#3d3c39", letterSpacing:"0.06em", marginBottom:10, fontWeight:300 }}>
            {dateStr}
          </p>
          <h1 style={{ fontFamily:"'DM Serif Display',serif", fontStyle:"italic", fontSize:32, fontWeight:400, color:"#e8e5df", lineHeight:1.1 }}>
            Daily habits
          </h1>
        </div>

        {/* Progress line */}
        <div style={{ marginBottom:"2rem" }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:9 }}>
            <span style={{ fontSize:11, color:"#3d3c39", fontWeight:300, letterSpacing:"0.04em" }}>progress</span>
            <span style={{ fontSize:11, color:"#555350" }}>{done}/{total}</span>
          </div>
          <div style={{ height:1, background:"#1a1a18", borderRadius:999 }}>
            <div style={{ height:1, background:"#c4c0b8", borderRadius:999, width:`${total > 0 ? (done/total)*100 : 0}%`, transition:"width 0.6s cubic-bezier(.4,0,.2,1)" }} />
          </div>
        </div>

        {/* Habit list */}
        <div style={{ borderTop:"1px solid #1e1e1b" }}>
          {habits.map(h => (
            <div key={h.id} className={`row${h.done ? " done-row" : ""}`}>

              <button className={`chk${h.done ? " on" : ""}`} onClick={() => toggle(h.id)}>
                {h.done && (
                  <svg width={10} height={8} viewBox="0 0 10 8" fill="none">
                    <polyline points="1,4 4,7 9,1" stroke="#0f0f0d" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>

              <span style={{ flex:1, fontSize:14, fontWeight: h.done ? 300 : 400, color: h.done ? "#3a3a36" : "#d8d5cf", textDecoration: h.done ? "line-through" : "none", textDecorationColor:"#2e2e2b" }}>
                {h.name}
              </span>

              {/* Week dots */}
              <div style={{ display:"flex", gap:3, alignItems:"center" }}>
                {DAY_LABELS.map((_, i) => (
                  <div key={i} className="dot" style={{
                    width:  i === TODAY_IDX ? 6 : 5,
                    height: i === TODAY_IDX ? 6 : 5,
                    background: h.weekLog[i]
                      ? (i === TODAY_IDX ? "#c4c0b8" : "#484643")
                      : "#1e1e1b",
                    opacity: i > TODAY_IDX ? 0.25 : 1,
                  }} />
                ))}
              </div>

              <span style={{ fontSize:11, color:"#2e2e2b", width:24, textAlign:"right", fontVariantNumeric:"tabular-nums", flexShrink:0 }}>
                {h.streak}d
              </span>

              <button className="rm" onClick={() => remove(h.id)}>✕</button>
            </div>
          ))}
        </div>

        {/* Add */}
        {!showAdd
          ? <button className="add-pill" onClick={() => setShowAdd(true)}>
              <span style={{ fontSize:15, lineHeight:1 }}>+</span> New habit
            </button>
          : <div style={{ marginTop:"1.75rem", display:"flex", flexDirection:"column", gap:18 }}>
              <input className="inp" autoFocus value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="Habit name…" />
              <div style={{ display:"flex", gap:14, alignItems:"center" }}>
                <button className="save" onClick={add}>Add</button>
                <button className="cancel" onClick={() => { setShowAdd(false); setNewName(""); }}>Cancel</button>
              </div>
            </div>
        }

      </div>
    </div>
  );
}
