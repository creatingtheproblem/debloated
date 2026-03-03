<script>
    import { onMount } from 'svelte';
    import { db } from '$lib/db.js';

    // ── calendar state ─────────────────────────────────────────
    const today   = new Date();
    let year      = $state(today.getFullYear());
    let month     = $state(today.getMonth()); // 0-indexed

    // sessions indexed by 'YYYY-MM-DD' → [session, ...]
    let sessionMap = $state({});

    // detail drawer
    let selected   = $state(null); // { date, sessions: [{ session, sets }] }
    let loadingDay = $state(false);

    onMount(loadMonth);

    // reload whenever month/year changes
    $effect(() => {
        year; month;
        loadMonth();
    });

    async function loadMonth() {
        const start = new Date(year, month, 1).toISOString();
        const end   = new Date(year, month + 1, 1).toISOString();
        const rows  = await db.sessions
            .where('date').between(start, end)
            .toArray();

        const map = {};
        for (const s of rows) {
            const key = s.date.slice(0, 10);
            if (!map[key]) map[key] = [];
            map[key].push(s);
        }
        sessionMap = map;
    }

    async function openDay(dateStr) {
        if (!sessionMap[dateStr]) return;
        loadingDay = true;
        selected = null;

        const sessions = sessionMap[dateStr];
        const enriched = await Promise.all(sessions.map(async (s) => {
            const sets = await db.loggedSets.where('sessionId').equals(s.id).toArray();
            // group sets by exercise
            const exercises = {};
            for (const set of sets) {
                if (!exercises[set.exerciseName]) exercises[set.exerciseName] = [];
                exercises[set.exerciseName][set.setNumber - 1] = set;
            }
            return { session: s, exercises };
        }));

        selected   = { dateStr, enriched };
        loadingDay = false;
    }

    function prevMonth() {
        if (month === 0) { month = 11; year--; }
        else month--;
    }

    function nextMonth() {
        if (month === 11) { month = 0; year++; }
        else month++;
    }

    // ── calendar grid helpers ──────────────────────────────────
    const DAYS = ['Mo','Tu','We','Th','Fr','Sa','Su'];

    function calendarCells(y, m) {
        const firstDay  = new Date(y, m, 1).getDay(); // 0=Sun
        const daysInMon = new Date(y, m + 1, 0).getDate();
        // shift so week starts Monday: Sun(0)→6, Mon(1)→0 ...
        const offset = (firstDay + 6) % 7;
        const cells = [];
        for (let i = 0; i < offset; i++) cells.push(null);
        for (let d = 1; d <= daysInMon; d++) cells.push(d);
        return cells;
    }

    function dateStr(d) {
        return `${year}-${String(month + 1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }

    function isToday(d) {
        return year === today.getFullYear() && month === today.getMonth() && d === today.getDate();
    }

    const MONTH_NAMES = ['January','February','March','April','May','June',
                         'July','August','September','October','November','December'];
</script>

<!-- ── HEADER ──────────────────────────────────────────────── -->
<div class="cal-header">
    <button class="nav-btn" onclick={prevMonth}>‹</button>
    <span class="month-label">{MONTH_NAMES[month]} {year}</span>
    <button class="nav-btn" onclick={nextMonth}>›</button>
</div>

<!-- ── WEEKDAY ROW ─────────────────────────────────────────── -->
<div class="grid">
    {#each DAYS as d}
        <div class="cell weekday">{d}</div>
    {/each}

    <!-- ── DAY CELLS ──────────────────────────────────────────── -->
    {#each calendarCells(year, month) as d}
        {#if d === null}
            <div class="cell empty"></div>
        {:else}
            {@const key     = dateStr(d)}
            {@const sessions = sessionMap[key]}
            <button
                class="cell day"
                class:has-session={sessions}
                class:is-today={isToday(d)}
                onclick={() => openDay(key)}
            >
                <span class="day-num">{d}</span>
                {#if sessions}
                    <span class="session-tag">
                        {sessions.map(s => s.splitName).join(', ')}
                    </span>
                {/if}
            </button>
        {/if}
    {/each}
</div>

<!-- ── DETAIL DRAWER ──────────────────────────────────────── -->
{#if selected}
    <!-- backdrop -->
    <button class="backdrop" onclick={() => selected = null}></button>

    <div class="drawer">
        <div class="drawer-handle"></div>

        {#each selected.enriched as { session, exercises }}
            <p class="drawer-title">
                {session.splitName} — {session.dayName}
                <span class="drawer-date">{new Date(session.date).toLocaleDateString('en-GB',{day:'numeric',month:'short'})}</span>
            </p>

            {#each Object.entries(exercises) as [exName, sets]}
                <div class="ex-block">
                    <p class="ex-name">{exName}</p>
                    <div class="set-header"><span>SET</span><span>KG</span><span>REPS</span></div>
                    {#each sets as set, i}
                        {#if set}
                            <div class="set-row">
                                <span class="set-num">{i + 1}</span>
                                <span>{set.weight || '—'}</span>
                                <span>{set.reps   || '—'}</span>
                            </div>
                        {/if}
                    {/each}
                </div>
            {/each}
        {/each}
    </div>
{/if}

<style>
    /* ── header ── */
    .cal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 16px;
    }

    .month-label {
        font-weight: 600;
        font-size: 1rem;
    }

    .nav-btn {
        font-size: 1.4rem;
        color: var(--text-muted);
        cursor: pointer;
        padding: 4px 10px;
        border-radius: 6px;
        transition: color 0.15s;
    }

    .nav-btn:hover { color: var(--text-main); }

    /* ── grid ── */
    .grid {
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 4px;
    }

    .cell {
        aspect-ratio: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-start;
        padding-top: 6px;
        border-radius: 8px;
        font-size: 0.85rem;
        overflow: hidden;
        position: relative;
    }

    .weekday {
        font-size: 0.7rem;
        color: var(--text-muted);
        aspect-ratio: unset;
        padding: 0 0 6px;
        justify-content: center;
    }

    .empty { background: transparent; }

    .day {
        background: var(--bg-card);
        border: 1px solid transparent;
        cursor: default;
        gap: 3px;
    }

    .day.has-session {
        border-color: var(--border);
        cursor: pointer;
    }

    .day.has-session:hover {
        border-color: var(--accent);
    }

    .day.is-today .day-num {
        background: var(--accent);
        color: var(--bg-main);
        border-radius: 999px;
        width: 22px;
        height: 22px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 700;
        font-size: 0.8rem;
    }

    .session-tag {
        font-size: 0.55rem;
        color: var(--text-muted);
        text-align: center;
        line-height: 1.2;
        padding: 0 3px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 100%;
    }

    /* ── drawer ── */
    .backdrop {
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.5);
        z-index: 10;
    }

    .drawer {
        position: fixed;
        bottom: var(--nav-height);
        left: 50%;
        transform: translateX(-50%);
        width: min(480px, 100vw);
        max-height: 70vh;
        overflow-y: auto;
        background: var(--bg-card);
        border: 1px solid var(--border);
        border-bottom: none;
        border-radius: 16px 16px 0 0;
        z-index: 11;
        padding: 12px 20px 32px;
    }

    .drawer-handle {
        width: 36px;
        height: 4px;
        background: var(--border);
        border-radius: 2px;
        margin: 0 auto 20px;
    }

    .drawer-title {
        font-weight: 600;
        font-size: 1rem;
        margin-bottom: 16px;
        display: flex;
        align-items: baseline;
        gap: 10px;
    }

    .drawer-date {
        font-size: 0.8rem;
        color: var(--text-muted);
        font-weight: 400;
    }

    .ex-block { margin-bottom: 20px; }

    .ex-name {
        font-size: 0.9rem;
        font-weight: 600;
        margin-bottom: 6px;
    }

    .set-header {
        display: grid;
        grid-template-columns: 28px 1fr 1fr;
        gap: 12px;
        font-size: 0.65rem;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        padding-bottom: 4px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 4px;
    }

    .set-row {
        display: grid;
        grid-template-columns: 28px 1fr 1fr;
        gap: 12px;
        padding: 5px 0;
        border-bottom: 1px solid var(--border);
        font-size: 0.95rem;
    }

    .set-num { color: var(--text-muted); text-align: center; }
</style>
