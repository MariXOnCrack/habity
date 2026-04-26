import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const ACTIVITY_WEEK_COUNT = 14;
const THEME_STORAGE_KEY = "habity-theme";
const THEME_OPTIONS = [
  {
    id: "stone",
    label: "Stone",
    accent: "#c4c0b8",
    accentRgb: "196, 192, 184",
    levels: ["#32342a", "#59633c", "#8a995f", "#d5d0a8"],
  },
  {
    id: "sage",
    label: "Sage",
    accent: "#a7d982",
    accentRgb: "167, 217, 130",
    levels: ["#203227", "#31583a", "#5c9155", "#a7d982"],
  },
  {
    id: "sky",
    label: "Sky",
    accent: "#8ec7ff",
    accentRgb: "142, 199, 255",
    levels: ["#1c2a38", "#244d71", "#3f83bd", "#8ec7ff"],
  },
  {
    id: "rose",
    label: "Rose",
    accent: "#f0a0b4",
    accentRgb: "240, 160, 180",
    levels: ["#38202a", "#693447", "#b7617a", "#f0a0b4"],
  },
];
const TABS = [
  { id: "today", label: "Today" },
  { id: "timelapse", label: "Timelapse" },
  { id: "progress", label: "Progress" },
  { id: "settings", label: "Settings" },
];

function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("today");
  const [showAdd, setShowAdd] = useState(false);
  const [draftType, setDraftType] = useState("habit");
  const [draftName, setDraftName] = useState("");
  const [objectiveFilter, setObjectiveFilter] = useState("all");
  const [frameIndex, setFrameIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [themeId, setThemeId] = useState(getStoredThemeId);
  const [clearingData, setClearingData] = useState(false);
  const [toast, setToast] = useToast();

  const today = todayKey();
  const stats = getTodayStats(items, today);
  const frames = getFrames(items, objectiveFilter);
  const theme = getTheme(themeId);

  useEffect(() => {
    loadState();
  }, []);

  useEffect(() => {
    applyTheme(theme);
    storeThemeId(theme.id);
  }, [theme]);

  useEffect(() => {
    if (frameIndex >= frames.length) {
      setFrameIndex(Math.max(0, frames.length - 1));
    }
  }, [frameIndex, frames.length]);

  useEffect(() => {
    if (!playing || frames.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setFrameIndex((index) => (index + 1) % frames.length);
    }, 720);
    return () => window.clearInterval(timer);
  }, [playing, frames.length]);

  async function loadState() {
    try {
      setError("");
      const data = await requestJson("/api/state");
      setItems(data.items);
    } catch (requestError) {
      console.error(requestError);
      setError("The API is not reachable. Start it with Docker Compose or run the backend locally.");
    } finally {
      setLoading(false);
    }
  }

  function switchTab(tab) {
    setActiveTab(tab);
    setPlaying(false);
  }

  async function toggleHabit(id) {
    try {
      const data = await requestJson(`/api/habits/${id}/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: today }),
      });
      setItems(data.items);
    } catch (requestError) {
      console.error(requestError);
      setToast("Could not update habit.");
    }
  }

  async function saveProof(id, file) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setToast("Please upload an image.");
      return;
    }

    try {
      const form = new FormData();
      form.append("date", today);
      form.append("photo", file);
      const data = await requestJson(`/api/objectives/${id}/proof`, {
        method: "POST",
        body: form,
      });
      setItems(data.items);
      setToast("Photo proof saved.");
    } catch (requestError) {
      console.error(requestError);
      setToast("Could not save that image.");
    }
  }

  async function addItem(event) {
    event.preventDefault();
    const name = draftName.trim();
    if (!name) return;

    try {
      const data = await requestJson("/api/items", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: draftType, name }),
      });
      setItems(data.items);
      setDraftName("");
      setShowAdd(false);
    } catch (requestError) {
      console.error(requestError);
      setToast("Could not add item.");
    }
  }

  function closeAddForm() {
    setDraftName("");
    setShowAdd(false);
  }

  function changeFilter(id) {
    setObjectiveFilter(id);
    setFrameIndex(0);
    setPlaying(false);
  }

  function moveFrame(amount) {
    if (!frames.length) return;
    setPlaying(false);
    setFrameIndex((index) => (index + amount + frames.length) % frames.length);
  }

  function changeTheme(nextThemeId) {
    const nextTheme = getTheme(nextThemeId);
    applyTheme(nextTheme);
    setThemeId(nextTheme.id);
    setToast("Theme updated.");
  }

  async function clearAllData() {
    try {
      setClearingData(true);
      const data = await requestJson("/api/data", { method: "DELETE" });
      setItems(data.items);
      setObjectiveFilter("all");
      setFrameIndex(0);
      setPlaying(false);
      setShowAdd(false);
      setDraftName("");
      setToast("All data cleared.");
    } catch (requestError) {
      console.error(requestError);
      setToast("Could not clear data.");
    } finally {
      setClearingData(false);
    }
  }

  return (
    <>
      <div className="app-bg" aria-hidden="true" />
      <main className="shell" aria-live="polite">
        <Header stats={stats} />
        <ProgressLine stats={stats} />
        <BottomNav activeTab={activeTab} onTab={switchTab} />

        {loading && <div className="empty">Loading your habit data...</div>}
        {!loading && error && (
          <div className="empty">
            {error}
            <button className="retry" onClick={loadState}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <div className={`view-content view-${activeTab}`} key={activeTab}>
            {activeTab === "today" && (
              <TodayView
                items={items}
                today={today}
                showAdd={showAdd}
                draftType={draftType}
                draftName={draftName}
                onToggleHabit={toggleHabit}
                onSaveProof={saveProof}
                onShowAdd={() => setShowAdd(true)}
                onCloseAdd={closeAddForm}
                onDraftType={setDraftType}
                onDraftName={setDraftName}
                onAddItem={addItem}
              />
            )}

            {activeTab === "timelapse" && (
              <TimelapseView
                items={items}
                frames={frames}
                frameIndex={frameIndex}
                filter={objectiveFilter}
                playing={playing}
                onFilter={changeFilter}
                onFrame={setFrameIndex}
                onMove={moveFrame}
                onPlaying={setPlaying}
              />
            )}

            {activeTab === "progress" && <ProgressView items={items} />}

            {activeTab === "settings" && (
              <SettingsView
                itemCount={items.length}
                themeId={theme.id}
                clearingData={clearingData}
                onTheme={changeTheme}
                onClearData={clearAllData}
              />
            )}
          </div>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

function Header({ stats }) {
  return (
    <header className="topbar">
      <div>
        <p className="date-label">{formatDate(new Date())}</p>
        <h1 className="title">
          Daily
          <br />
          proof
        </h1>
      </div>
      <div className="today-score" aria-label={`${stats.done} of ${stats.total} complete today`}>
        <span className="score-number">
          {stats.done}/{stats.total}
        </span>
        <span className="score-label">today</span>
      </div>
    </header>
  );
}

function ProgressLine({ stats }) {
  return (
    <section className="progress-line" aria-label="Daily completion">
      <div className="progress-meta">
        <span>progress</span>
        <span>{stats.percent}%</span>
      </div>
      <div className="track">
        <div className="fill" style={{ width: `${stats.percent}%` }} />
      </div>
    </section>
  );
}

function TodayView({
  items,
  today,
  showAdd,
  draftType,
  draftName,
  onToggleHabit,
  onSaveProof,
  onShowAdd,
  onCloseAdd,
  onDraftType,
  onDraftName,
  onAddItem,
}) {
  const habits = items.filter((item) => item.type === "habit");
  const objectives = items.filter((item) => item.type === "objective");

  return (
    <>
      <ItemSection title="Habits" count={`${habits.filter((item) => isDoneOn(item, today)).length}/${habits.length}`}>
        {habits.map((item, index) => (
          <HabitRow key={item.id} item={item} today={today} enterDelay={index * 40} onToggle={onToggleHabit} />
        ))}
      </ItemSection>

      <ItemSection title="Objectives" count={`${objectives.filter((item) => isDoneOn(item, today)).length}/${objectives.length}`}>
        {objectives.map((item, index) => (
          <ObjectiveRow key={item.id} item={item} today={today} enterDelay={index * 40} onSaveProof={onSaveProof} />
        ))}
      </ItemSection>

      <button className="add-pill" onClick={onShowAdd}>
        <span>+</span> New habit or objective
      </button>

      {showAdd && (
        <AddModal onClose={onCloseAdd}>
          <AddForm
            draftType={draftType}
            draftName={draftName}
            onDraftType={onDraftType}
            onDraftName={onDraftName}
            onSubmit={onAddItem}
            onCancel={onCloseAdd}
          />
        </AddModal>
      )}
    </>
  );
}

function ItemSection({ title, count, children }) {
  const childArray = Array.isArray(children) ? children : [children];
  const hasItems = childArray.some(Boolean);

  return (
    <section className="item-section">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      {hasItems ? <div className="list">{children}</div> : <div className="empty">No {title.toLowerCase()} yet.</div>}
    </section>
  );
}

function HabitRow({ item, today, enterDelay, onToggle }) {
  const done = isDoneOn(item, today);
  const week = getWeekLog(item);

  return (
    <article className={`item ${done ? "is-done" : ""}`} style={fadeDelayStyle(enterDelay)}>
      <button className={`check ${done ? "is-on" : ""}`} onClick={() => onToggle(item.id)} aria-label={`Toggle ${item.name}`}>
        {done && <CheckIcon />}
      </button>
      <div className="item-main">
        <span className="item-name">{item.name}</span>
        <span className="item-detail">{getItemStreak(item)}d streak</span>
      </div>
      <div className="dots" aria-hidden="true">
        {week.map((day) => (
          <span
            key={day.label}
            className={`dot ${day.done ? "done" : ""} ${day.isToday ? "today" : ""}`}
            style={{ opacity: day.isFuture ? 0.25 : 1 }}
          />
        ))}
      </div>
    </article>
  );
}

function ObjectiveRow({ item, today, enterDelay, onSaveProof }) {
  const record = item.records[today];
  const done = Boolean(record?.completed);
  const inputId = `proof-${item.id}`;

  return (
    <article className={`item ${done ? "is-done" : ""}`} style={fadeDelayStyle(enterDelay)}>
      <label className={`proof-thumb ${record?.photo ? "has-photo" : ""}`} htmlFor={inputId} aria-label={`Upload proof for ${item.name}`}>
        {record?.photo ? <img src={record.photo} alt="" /> : <CameraIcon />}
      </label>
      <div className="item-main">
        <span className="item-name">{item.name}</span>
        <span className="item-detail">{done ? `proof added - ${formatShortDate(today)}` : "needs a photo today"}</span>
      </div>
      <label className="proof-action" htmlFor={inputId}>
        <strong>{done ? "*" : "+"}</strong>
        {done ? "Replace" : "Proof"}
      </label>
      <input
        className="hidden-input"
        id={inputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(event) => onSaveProof(item.id, event.target.files?.[0])}
      />
    </article>
  );
}

function AddModal({ children, onClose }) {
  useEffect(() => {
    function handleKeyDown(event) {
      if (event.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="modal-header">
          <h2 id="add-dialog-title">New item</h2>
          <button className="modal-close" type="button" onClick={onClose} aria-label="Close add item dialog">
            x
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function AddForm({ draftType, draftName, onDraftType, onDraftName, onSubmit, onCancel }) {
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <form className="add-form" onSubmit={onSubmit}>
      <input
        ref={inputRef}
        className="input"
        autoComplete="off"
        value={draftName}
        placeholder={draftType === "habit" ? "Habit name..." : "Objective name..."}
        onChange={(event) => onDraftName(event.target.value)}
        required
      />
      <div className="type-switch" aria-label="Item type">
        <button className={`type-option ${draftType === "habit" ? "is-active" : ""}`} type="button" onClick={() => onDraftType("habit")}>
          Habit
        </button>
        <button
          className={`type-option ${draftType === "objective" ? "is-active" : ""}`}
          type="button"
          onClick={() => onDraftType("objective")}
        >
          Objective
        </button>
      </div>
      <div className="form-actions">
        <button className="save" type="submit">
          Add
        </button>
        <button className="cancel" type="button" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}

function TimelapseView({ items, frames, frameIndex, filter, playing, onFilter, onFrame, onMove, onPlaying }) {
  const objectives = items.filter((item) => item.type === "objective");
  const frame = frames[frameIndex];

  return (
    <section className="timelapse-view">
      <div className="section-title">
        <h2>Daily timelapse</h2>
        <span>{frames.length} frames</span>
      </div>

      <div className="filter-row">
        <button className={`chip ${filter === "all" ? "is-active" : ""}`} style={fadeDelayStyle(0)} onClick={() => onFilter("all")}>
          All proof
        </button>
        {objectives.map((item, index) => (
          <button
            key={item.id}
            className={`chip ${filter === item.id ? "is-active" : ""}`}
            style={fadeDelayStyle((index + 1) * 40)}
            onClick={() => onFilter(item.id)}
          >
            {item.name}
          </button>
        ))}
      </div>

      {frame ? (
        <div className="timelapse-card">
          <div className="frame">
            <img src={frame.photo} alt={`${frame.itemName} proof from ${formatShortDate(frame.key)}`} />
            <div className="frame-caption">
              <strong>{frame.itemName}</strong>
              <span>
                {formatShortDate(frame.key)} - frame {frameIndex + 1}/{frames.length}
              </span>
            </div>
          </div>
          <div className="timelapse-controls">
            <button className="round" onClick={() => onMove(-1)} aria-label="Previous frame">
              &lt;
            </button>
            <button className="play" onClick={() => onPlaying((value) => !value)}>
              {playing ? "Pause" : "Play timelapse"}
            </button>
            <button className="round" onClick={() => onMove(1)} aria-label="Next frame">
              &gt;
            </button>
          </div>
          <div className="filmstrip" aria-label="Timelapse frames">
            {frames.map((item, index) => (
              <button
                key={`${item.itemId}-${item.key}`}
                className={`film ${index === frameIndex ? "is-active" : ""}`}
                style={fadeDelayStyle(index * 40)}
                onClick={() => {
                  onPlaying(false);
                  onFrame(index);
                }}
              >
                <img src={item.photo} alt="" />
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty">Add a photo to an objective from the Today tab. Each daily proof becomes one frame in this small timelapse.</div>
      )}
    </section>
  );
}

function ProgressView({ items }) {
  const calendar = getActivityCalendar(items, ACTIVITY_WEEK_COUNT);
  const stats = getProgressStats(items, calendar.days);
  const weeklyProgress = getWeeklyProgress(calendar.weeks);
  const weekdayProgress = getWeekdayProgress(calendar.days);
  const itemProgress = getItemProgress(items, calendar.days);

  return (
    <section className="progress-view">
      <div className="section-title">
        <h2>Progress map</h2>
        <span>{calendar.rangeLabel}</span>
      </div>
      <div className="progress-dashboard">
        <div className="grid-card progress-map-card">
          <div className="heatmap-wrap" role="img" aria-label={`GitHub style activity from ${calendar.rangeLabel}`}>
            <div className="activity-grid" style={{ "--week-count": calendar.weeks.length }}>
              <div className="month-labels" aria-hidden="true">
                {calendar.months.map((month) => (
                  <span key={`${month.label}-${month.start}`} style={{ gridColumn: `${month.start} / ${month.end}` }}>
                    {month.label}
                  </span>
                ))}
              </div>
              <div className="weekday-labels" aria-hidden="true">
                {DAY_LABELS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="heatmap">
                {calendar.weeks.map((week, weekIndex) => (
                  <div className="heatmap-week" key={week.key}>
                    {week.days.map((day) => (
                      <span
                        key={day.key}
                        className={`day-cell level-${day.level} ${day.isToday ? "is-today" : ""} ${day.isFuture ? "is-future" : ""}`}
                        style={fadeDelayStyle(weekIndex * 16)}
                        title={formatActivityTitle(day)}
                        aria-label={formatActivityTitle(day)}
                      />
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="legend">
            <span>Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <span key={level} className={`legend-dot day-cell level-${level}`} style={fadeDelayStyle(level * 30)} />
            ))}
            <span>More</span>
          </div>
          <div className="stats">
            <Stat value={stats.currentStreak} label="day streak" enterDelay={0} />
            <Stat value={stats.completeDays} label="complete days" enterDelay={40} />
            <Stat value={stats.totalProofs} label="proofs" enterDelay={80} />
          </div>
        </div>

        <div className="chart-card weekly-chart-card">
          <div className="chart-title">
            <h3>Weekly completion</h3>
            <span>{stats.averagePercent}% avg</span>
          </div>
          <div className="weekly-bars" aria-label="Weekly completion chart">
            {weeklyProgress.map((week, index) => (
              <div
                key={week.key}
                className="weekly-bar"
                style={{ "--bar-height": `${week.percent}%`, ...fadeDelayStyle(index * 30) }}
                title={`${week.label}: ${week.percent}% complete`}
              >
                <span />
                <em>{week.shortLabel}</em>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card rhythm-card">
          <div className="chart-title">
            <h3>Weekday rhythm</h3>
            <span>{calendar.days.length} days</span>
          </div>
          <div className="rhythm-list">
            {weekdayProgress.map((day, index) => (
              <div key={day.label} className="rhythm-row" style={fadeDelayStyle(index * 30)}>
                <span>{day.label}</span>
                <div className="progress-bar" aria-label={`${day.label}: ${day.percent}% complete`}>
                  <i style={{ width: `${day.percent}%` }} />
                </div>
                <strong>{day.percent}%</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="chart-card item-progress-card">
          <div className="chart-title">
            <h3>Tracked items</h3>
            <span>{itemProgress.length} active</span>
          </div>
          {itemProgress.length ? (
            <div className="item-progress-list">
              {itemProgress.map((item, index) => (
                <div key={item.id} className="item-progress-row" style={fadeDelayStyle(index * 35)}>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.type}</span>
                  </div>
                  <div className="progress-bar" aria-label={`${item.name}: ${item.percent}% complete`}>
                    <i style={{ width: `${item.percent}%` }} />
                  </div>
                  <em>{item.percent}%</em>
                </div>
              ))}
            </div>
          ) : (
            <div className="empty compact-empty">Add a habit or objective to build progress charts.</div>
          )}
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label, enterDelay = 0 }) {
  return (
    <div className="stat" style={fadeDelayStyle(enterDelay)}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function SettingsView({ itemCount, themeId, clearingData, onTheme, onClearData }) {
  const [confirmingClear, setConfirmingClear] = useState(false);

  useEffect(() => {
    if (!confirmingClear) return undefined;
    const timer = window.setTimeout(() => setConfirmingClear(false), 3600);
    return () => window.clearTimeout(timer);
  }, [confirmingClear]);

  useEffect(() => {
    if (itemCount === 0) setConfirmingClear(false);
  }, [itemCount]);

  async function handleClearClick() {
    if (!confirmingClear) {
      setConfirmingClear(true);
      return;
    }

    await onClearData();
    setConfirmingClear(false);
  }

  return (
    <>
      <section className="settings-section">
        <div className="section-title">
          <h2>Theme color</h2>
          <span>{getTheme(themeId).label}</span>
        </div>
        <div className="settings-panel">
          <div className="theme-options" aria-label="Theme color">
            {THEME_OPTIONS.map((theme, index) => (
              <button
                key={theme.id}
                className={`theme-option ${theme.id === themeId ? "is-active" : ""}`}
                type="button"
                aria-pressed={theme.id === themeId}
                style={fadeDelayStyle(index * 40)}
                onClick={() => onTheme(theme.id)}
              >
                <span className="theme-swatch" style={{ background: theme.accent }} />
                <span>{theme.label}</span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="settings-section">
        <div className="section-title">
          <h2>Data</h2>
          <span>{itemCount} items</span>
        </div>
        <div className="danger-panel">
          <div className="setting-copy">
            <strong>Clear all data</strong>
            <span>Deletes habits, objectives, history, and proof photos.</span>
          </div>
          <button
            className={`danger-button ${confirmingClear ? "is-confirming" : ""}`}
            type="button"
            disabled={clearingData || itemCount === 0}
            onClick={handleClearClick}
          >
            {itemCount === 0 ? "No data" : clearingData ? "Clearing..." : confirmingClear ? "Confirm clear" : "Clear data"}
          </button>
        </div>
      </section>
    </>
  );
}

function BottomNav({ activeTab, onTab }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((tab, index) => (
        <button
          key={tab.id}
          className={`nav-btn ${activeTab === tab.id ? "is-active" : ""}`}
          style={fadeDelayStyle(index * 30)}
          onClick={() => onTab(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}

function useToast() {
  const [toast, setToastValue] = useState("");

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToastValue(""), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return [toast, setToastValue];
}

function getStoredThemeId() {
  if (typeof window === "undefined") return THEME_OPTIONS[0].id;

  try {
    return getTheme(window.localStorage.getItem(THEME_STORAGE_KEY)).id;
  } catch {
    return THEME_OPTIONS[0].id;
  }
}

function storeThemeId(themeId) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, themeId);
  } catch {
    // Theme persistence is a convenience; ignore storage failures.
  }
}

function getTheme(themeId) {
  return THEME_OPTIONS.find((theme) => theme.id === themeId) || THEME_OPTIONS[0];
}

function applyTheme(theme) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  root.style.setProperty("--accent", theme.accent);
  root.style.setProperty("--accent-rgb", theme.accentRgb);
  theme.levels.forEach((color, index) => {
    root.style.setProperty(`--activity-level-${index + 1}`, color);
  });
}

function fadeDelayStyle(delay = 0) {
  return { "--fade-delay": `${delay}ms` };
}

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, options);
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed with ${response.status}`);
  }
  return response.json();
}

function getTodayStats(items, today) {
  const total = items.length;
  const done = items.filter((item) => isDoneOn(item, today)).length;
  return {
    total,
    done,
    percent: total ? Math.round((done / total) * 100) : 0,
  };
}

function isDoneOn(item, key) {
  return Boolean(item.records[key]?.completed);
}

function getItemStreak(item) {
  let streak = 0;
  let cursor = new Date();
  while (isDoneOn(item, dateKey(cursor))) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function getWeekLog(item) {
  const today = new Date();
  const todayIndex = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const monday = addDays(today, -todayIndex);

  return DAY_LABELS.map((label, index) => {
    const key = dateKey(addDays(monday, index));
    return {
      label,
      isToday: index === todayIndex,
      isFuture: index > todayIndex,
      done: isDoneOn(item, key),
    };
  });
}

function getFrames(items, objectiveFilter) {
  const objectiveIds = items.filter((item) => item.type === "objective").map((item) => item.id);
  const selectedIds = objectiveFilter === "all" ? objectiveIds : [objectiveFilter];

  return items
    .filter((item) => item.type === "objective" && selectedIds.includes(item.id))
    .flatMap((item) =>
      Object.entries(item.records)
        .filter(([, record]) => record.completed && record.photo)
        .map(([key, record]) => ({
          itemId: item.id,
          itemName: item.name,
          key,
          photo: record.photo,
          at: record.at || key,
        })),
    )
    .sort((a, b) => a.key.localeCompare(b.key));
}

function getActivityCalendar(items, weekCount) {
  const today = startOfDay(new Date());
  const currentWeekStart = startOfWeek(today);
  const start = addDays(currentWeekStart, -((weekCount - 1) * DAY_LABELS.length));
  const weeks = [];
  const days = [];

  for (let weekIndex = 0; weekIndex < weekCount; weekIndex += 1) {
    const weekStart = addDays(start, weekIndex * DAY_LABELS.length);
    const weekDays = DAY_LABELS.map((_, dayIndex) => {
      const date = addDays(weekStart, dayIndex);
      const key = dateKey(date);
      const completion = completionForDate(items, key);
      const isFuture = date > today;
      const day = {
        key,
        label: formatActivityDate(key),
        done: isFuture ? 0 : completion.done,
        total: isFuture ? 0 : completion.total,
        level: isFuture ? 0 : contributionLevel(completion.ratio),
        isFuture,
        isToday: key === dateKey(today),
      };

      if (!isFuture) days.push(day);
      return day;
    });

    weeks.push({
      key: dateKey(weekStart),
      days: weekDays,
    });
  }

  return {
    weeks,
    days,
    months: getMonthMarkers(weeks),
    rangeLabel: `${formatShortDate(days[0]?.key || dateKey(today))} - ${formatShortDate(dateKey(today))}`,
  };
}

function startOfWeek(date) {
  const dayIndex = date.getDay() === 0 ? 6 : date.getDay() - 1;
  return addDays(date, -dayIndex);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function getMonthMarkers(weeks) {
  const markers = [];

  for (const [index, week] of weeks.entries()) {
    const monthStart = week.days.find((day) => parseKey(day.key).getDate() === 1);
    if (index === 0 || monthStart) {
      const markerDay = monthStart || week.days[0];
      markers.push({
        label: parseKey(markerDay.key).toLocaleDateString("en-US", { month: "short" }),
        start: index + 1,
      });
    }
  }

  return markers.map((marker, index) => ({
    ...marker,
    end: markers[index + 1]?.start || weeks.length + 1,
  }));
}

function formatActivityTitle(day) {
  if (day.isFuture) return `${day.label} - future`;
  if (day.total === 0) return `${day.label} - no tracked items`;
  return `${day.label} - ${day.done}/${day.total} complete`;
}

function completionForDate(items, key) {
  const date = parseKey(key);
  const eligible = items.filter((item) => parseKey(item.createdAt) <= date);
  const total = eligible.length;
  const done = eligible.filter((item) => isDoneOn(item, key)).length;
  const ratio = total ? done / total : 0;
  return { total, done, ratio };
}

function contributionLevel(ratio) {
  if (ratio >= 0.85) return 4;
  if (ratio >= 0.55) return 3;
  if (ratio >= 0.25) return 2;
  if (ratio > 0) return 1;
  return 0;
}

function getProgressStats(items, days) {
  let currentStreak = 0;
  for (let index = days.length - 1; index >= 0; index -= 1) {
    if (days[index].total > 0 && days[index].done === days[index].total) currentStreak += 1;
    else break;
  }

  const possibleCompletions = days.reduce((sum, day) => sum + day.total, 0);
  const actualCompletions = days.reduce((sum, day) => sum + day.done, 0);

  return {
    currentStreak,
    completeDays: days.filter((day) => day.total > 0 && day.done === day.total).length,
    averagePercent: possibleCompletions ? Math.round((actualCompletions / possibleCompletions) * 100) : 0,
    totalProofs: items
      .filter((item) => item.type === "objective")
      .reduce((sum, item) => sum + Object.values(item.records).filter((record) => record.completed && record.photo).length, 0),
  };
}

function getWeeklyProgress(weeks) {
  return weeks.map((week) => {
    const days = week.days.filter((day) => !day.isFuture);
    const total = days.reduce((sum, day) => sum + day.total, 0);
    const done = days.reduce((sum, day) => sum + day.done, 0);
    const firstDay = days[0] || week.days[0];
    const lastDay = days[days.length - 1] || firstDay;

    return {
      key: week.key,
      label: `${formatShortDate(firstDay.key)} - ${formatShortDate(lastDay.key)}`,
      shortLabel: formatTinyDate(firstDay.key),
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  });
}

function getWeekdayProgress(days) {
  return DAY_LABELS.map((label, index) => {
    const matchingDays = days.filter((day) => {
      const dayIndex = parseKey(day.key).getDay() === 0 ? 6 : parseKey(day.key).getDay() - 1;
      return dayIndex === index;
    });
    const total = matchingDays.reduce((sum, day) => sum + day.total, 0);
    const done = matchingDays.reduce((sum, day) => sum + day.done, 0);

    return {
      label,
      percent: total ? Math.round((done / total) * 100) : 0,
    };
  });
}

function getItemProgress(items, days) {
  return items
    .map((item) => {
      const createdAt = parseKey(item.createdAt);
      const eligibleDays = days.filter((day) => parseKey(day.key) >= createdAt);
      const done = eligibleDays.filter((day) => isDoneOn(item, day.key)).length;

      return {
        id: item.id,
        name: item.name,
        type: item.type,
        percent: eligibleDays.length ? Math.round((done / eligibleDays.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.percent - a.percent || a.name.localeCompare(b.name));
}

function todayKey() {
  return dateKey(new Date());
}

function dateKey(date) {
  const local = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, "0");
  const day = String(local.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function parseKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date) {
  return date.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
}

function formatShortDate(key) {
  return parseKey(key).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function formatTinyDate(key) {
  const date = parseKey(key);
  return `${date.getMonth() + 1}/${date.getDate()}`;
}

function formatActivityDate(key) {
  return parseKey(key).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function CheckIcon() {
  return (
    <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true">
      <polyline points="1,4.5 4.4,8 11,1" stroke="#0f0f0d" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CameraIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8.8 7.5 10.2 5h3.6l1.4 2.5H18a2 2 0 0 1 2 2v7.1a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V9.5a2 2 0 0 1 2-2h2.8Z"
        stroke="#706e68"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" stroke="#706e68" strokeWidth="1.5" />
    </svg>
  );
}

export default App;
