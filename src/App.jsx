import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";
const DAY_LABELS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const ACTIVITY_WEEK_COUNT = 14;
const TABS = [
  { id: "today", label: "Today" },
  { id: "timelapse", label: "Timelapse" },
  { id: "progress", label: "Progress" },
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
  const [toast, setToast] = useToast();

  const today = todayKey();
  const stats = getTodayStats(items, today);
  const frames = getFrames(items, objectiveFilter);

  useEffect(() => {
    loadState();
  }, []);

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

  return (
    <>
      <main className="shell" aria-live="polite">
        <Header stats={stats} />
        <ProgressLine stats={stats} />

        {loading && <div className="empty">Loading your habit data...</div>}
        {!loading && error && (
          <div className="empty">
            {error}
            <button className="retry" onClick={loadState}>
              Retry
            </button>
          </div>
        )}

        {!loading && !error && activeTab === "today" && (
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

        {!loading && !error && activeTab === "timelapse" && (
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

        {!loading && !error && activeTab === "progress" && <ProgressView items={items} />}
      </main>

      <BottomNav activeTab={activeTab} onTab={switchTab} />
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
        {habits.map((item) => (
          <HabitRow key={item.id} item={item} today={today} onToggle={onToggleHabit} />
        ))}
      </ItemSection>

      <ItemSection title="Objectives" count={`${objectives.filter((item) => isDoneOn(item, today)).length}/${objectives.length}`}>
        {objectives.map((item) => (
          <ObjectiveRow key={item.id} item={item} today={today} onSaveProof={onSaveProof} />
        ))}
      </ItemSection>

      {showAdd ? (
        <AddForm
          draftType={draftType}
          draftName={draftName}
          onDraftType={onDraftType}
          onDraftName={onDraftName}
          onSubmit={onAddItem}
          onCancel={onCloseAdd}
        />
      ) : (
        <button className="add-pill" onClick={onShowAdd}>
          <span>+</span> New habit or objective
        </button>
      )}
    </>
  );
}

function ItemSection({ title, count, children }) {
  const childArray = Array.isArray(children) ? children : [children];
  const hasItems = childArray.some(Boolean);

  return (
    <section>
      <div className="section-title">
        <h2>{title}</h2>
        <span>{count}</span>
      </div>
      {hasItems ? <div className="list">{children}</div> : <div className="empty">No {title.toLowerCase()} yet.</div>}
    </section>
  );
}

function HabitRow({ item, today, onToggle }) {
  const done = isDoneOn(item, today);
  const week = getWeekLog(item);

  return (
    <article className={`item ${done ? "is-done" : ""}`}>
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

function ObjectiveRow({ item, today, onSaveProof }) {
  const record = item.records[today];
  const done = Boolean(record?.completed);
  const inputId = `proof-${item.id}`;

  return (
    <article className={`item ${done ? "is-done" : ""}`}>
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
    <section>
      <div className="section-title">
        <h2>Daily timelapse</h2>
        <span>{frames.length} frames</span>
      </div>

      <div className="filter-row">
        <button className={`chip ${filter === "all" ? "is-active" : ""}`} onClick={() => onFilter("all")}>
          All proof
        </button>
        {objectives.map((item) => (
          <button key={item.id} className={`chip ${filter === item.id ? "is-active" : ""}`} onClick={() => onFilter(item.id)}>
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

  return (
    <section>
      <div className="section-title">
        <h2>Progress map</h2>
        <span>{calendar.rangeLabel}</span>
      </div>
      <div className="grid-card">
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
              {calendar.weeks.map((week) => (
                <div className="heatmap-week" key={week.key}>
                  {week.days.map((day) => (
                    <span
                      key={day.key}
                      className={`day-cell level-${day.level} ${day.isToday ? "is-today" : ""} ${day.isFuture ? "is-future" : ""}`}
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
            <span key={level} className={`legend-dot day-cell level-${level}`} />
          ))}
          <span>More</span>
        </div>
        <div className="stats">
          <Stat value={stats.currentStreak} label="day streak" />
          <Stat value={stats.completeDays} label="complete days" />
          <Stat value={stats.totalProofs} label="proofs" />
        </div>
      </div>
    </section>
  );
}

function Stat({ value, label }) {
  return (
    <div className="stat">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function BottomNav({ activeTab, onTab }) {
  return (
    <nav className="bottom-nav" aria-label="Main navigation">
      {TABS.map((tab) => (
        <button key={tab.id} className={`nav-btn ${activeTab === tab.id ? "is-active" : ""}`} onClick={() => onTab(tab.id)}>
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

  return {
    currentStreak,
    completeDays: days.filter((day) => day.total > 0 && day.done === day.total).length,
    totalProofs: items
      .filter((item) => item.type === "objective")
      .reduce((sum, item) => sum + Object.values(item.records).filter((record) => record.completed && record.photo).length, 0),
  };
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
