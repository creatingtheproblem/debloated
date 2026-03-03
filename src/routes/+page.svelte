<script>
    import { onMount } from 'svelte';
    import { db } from '$lib/db.js';

    import { base } from '$app/paths';

    let loading     = $state(true);
    let splits      = $state([]);
    let activeSplit = $state(null);
    let days        = $state([]);
    let activeDay   = $state(null);

    // exerciseRows: [{ id, name, sets: [{ reps, weight, prefilled }] }]
    let exerciseRows = $state([]);
    let saving       = $state(false);
    let saved        = $state(false);

    const today = new Date().toLocaleDateString('en-GB', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });

    onMount(async () => {
        splits  = await db.splits.toArray();
        loading = false;
    });

    async function pickSplit(split) {
        activeSplit = split;
        activeDay   = null;
        exerciseRows = [];
        const rows = await db.days.where('splitId').equals(split.id).toArray();
        days = rows.sort((a, b) => a.order - b.order);
    }

    async function pickDay(day) {
        activeDay    = day;
        exerciseRows = [];

        // load template exercises
        const exRows = await db.exercises.where('dayId').equals(day.id).toArray();
        exRows.sort((a, b) => a.order - b.order);

        // find last session for this split+day (by name, not id)
        const pastSessions = await db.sessions
            .where('date').above('')
            .filter(s => s.splitName === activeSplit.name && s.dayName === day.name)
            .toArray();

        let lastSets = {};
        if (pastSessions.length) {
            const last = pastSessions.reduce((a, b) => a.date > b.date ? a : b);
            const sets = await db.loggedSets.where('sessionId').equals(last.id).toArray();
            for (const s of sets) {
                if (!lastSets[s.exerciseName]) lastSets[s.exerciseName] = [];
                lastSets[s.exerciseName][s.setNumber - 1] = { reps: s.reps, weight: s.weight };
            }
        }

        exerciseRows = exRows.map(ex => {
            const prev = lastSets[ex.name] || [];
            return {
                id:   ex.id,
                name: ex.name,
                sets: Array.from({ length: ex.sets }, (_, i) => ({
                    reps:      prev[i]?.reps  ?? '',
                    weight:    prev[i]?.weight ?? '',
                    prefilled: prev[i] != null
                }))
            };
        });
    }

    function touch(exIdx, setIdx) {
        exerciseRows[exIdx].sets[setIdx].prefilled = false;
    }

    async function finish() {
        saving = true;
        const todayPrefix = new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'

        // delete any existing session for the same split+day today
        const existing = await db.sessions
            .where('date').between(todayPrefix, todayPrefix + '\uffff')
            .filter(s => s.splitName === activeSplit.name && s.dayName === activeDay.name)
            .toArray();

        for (const s of existing) {
            await db.loggedSets.where('sessionId').equals(s.id).delete();
            await db.sessions.delete(s.id);
        }

        const sessionId = await db.sessions.add({
            splitName: activeSplit.name,
            dayName:   activeDay.name,
            date:      new Date().toISOString()
        });
        for (const ex of exerciseRows) {
            for (let i = 0; i < ex.sets.length; i++) {
                const s = ex.sets[i];
                await db.loggedSets.add({
                    sessionId,
                    exerciseName: ex.name,
                    setNumber:    i + 1,
                    reps:         Number(s.reps)   || 0,
                    weight:       Number(s.weight) || 0
                });
            }
        }
        saving = false;
        saved  = true;
        // reset for next workout
        setTimeout(() => {
            activeSplit  = null;
            activeDay    = null;
            exerciseRows = [];
            saved        = false;
        }, 1200);
    }
</script>

{#if loading}
    <!-- loading -->

{:else if splits.length === 0}
    <div class="locked">
        <p class="locked-msg">No splits set up yet.</p>
        <p class="locked-sub">Head to the <a href="{base}/splits">Splits</a> tab to create your first split.</p>
    </div>

{:else}
    <!-- DATE -->
    <p class="date">{today}</p>

    <!-- SPLIT PICKER -->
    {#if !activeSplit}
        <p class="label">Select split</p>
        <div class="pill-row">
            {#each splits as s (s.id)}
                <button class="pill" onclick={() => pickSplit(s)}>{s.name}</button>
            {/each}
        </div>

    <!-- DAY PICKER -->
    {:else if !activeDay}
        <button class="back" onclick={() => { activeSplit = null; days = []; }}>← {activeSplit.name}</button>
        <p class="label">Select day</p>
        <div class="pill-row">
            {#each days as d (d.id)}
                <button class="pill" onclick={() => pickDay(d)}>{d.name}</button>
            {/each}
        </div>

    <!-- EXERCISE LOG -->
    {:else}
        <div class="log-header">
            <button class="back" onclick={() => { activeDay = null; exerciseRows = []; }}>← {activeSplit.name} / {activeDay.name}</button>
        </div>

        <div class="exercise-list">
            {#each exerciseRows as ex, ei (ex.id)}
                <div class="ex-block">
                    <p class="ex-name">{ex.name}</p>
                    <div class="set-header">
                        <span>SET</span><span>KG</span><span>REPS</span>
                    </div>
                    {#each ex.sets as set, si}
                        <div class="set-row">
                            <span class="set-num">{si + 1}</span>
                            <input
                                type="number"
                                inputmode="decimal"
                                class:prefilled={set.prefilled}
                                value={set.weight}
                                placeholder="—"
                                oninput={(e) => { set.weight = e.target.value; touch(ei, si); }}
                            />
                            <input
                                type="number"
                                inputmode="numeric"
                                class:prefilled={set.prefilled}
                                value={set.reps}
                                placeholder="—"
                                oninput={(e) => { set.reps = e.target.value; touch(ei, si); }}
                            />
                        </div>
                    {/each}
                </div>
            {/each}
        </div>

        <div class="footer">
            <button class="btn-done" onclick={finish} disabled={saving}>
                {#if saved}✓{:else if saving}…{:else}Done{/if}
            </button>
        </div>
    {/if}
{/if}

<style>
    .date {
        font-size: 0.85rem;
        color: var(--text-muted);
        margin-bottom: 24px;
    }

    .label {
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        margin-bottom: 12px;
    }

    .pill-row {
        display: flex;
        flex-wrap: wrap;
        gap: 10px;
    }

    .pill {
        border: 1px solid var(--border);
        border-radius: 999px;
        padding: 8px 20px;
        font-size: 0.95rem;
        color: var(--text-main);
        cursor: pointer;
        transition: background 0.15s, border-color 0.15s;
    }

    .pill:hover {
        background: var(--bg-card);
        border-color: var(--accent);
    }

    .back {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        color: var(--text-muted);
        font-size: 0.9rem;
        cursor: pointer;
        margin-bottom: 24px;
        transition: color 0.15s;
    }

    .back:hover { color: var(--text-main); }

    /* ── exercise log ── */
    .log-header { margin-bottom: 4px; }

    .exercise-list {
        display: flex;
        flex-direction: column;
        gap: 28px;
        padding-bottom: 100px;
    }

    .ex-block {}

    .ex-name {
        font-size: 1rem;
        font-weight: 600;
        margin-bottom: 10px;
    }

    .set-header {
        display: grid;
        grid-template-columns: 28px 1fr 1fr;
        gap: 12px;
        font-size: 0.7rem;
        letter-spacing: 0.08em;
        color: var(--text-muted);
        padding: 0 2px 4px;
        border-bottom: 1px solid var(--border);
        margin-bottom: 6px;
    }

    .set-row {
        display: grid;
        grid-template-columns: 28px 1fr 1fr;
        gap: 12px;
        align-items: center;
        padding: 6px 2px;
        border-bottom: 1px solid var(--border);
    }

    .set-num {
        font-size: 0.85rem;
        color: var(--text-muted);
        text-align: center;
    }

    .set-row input {
        width: 100%;
        background: transparent;
        border: none;
        color: var(--text-main);
        font-size: 1.1rem;
        text-align: center;
        padding: 4px 0;
        outline: none;
        -moz-appearance: textfield;
    }

    .set-row input::-webkit-outer-spin-button,
    .set-row input::-webkit-inner-spin-button { -webkit-appearance: none; }

    .set-row input.prefilled {
        color: var(--text-muted);
    }

    .set-row input::placeholder { color: var(--border); }

    /* ── done button ── */
    .footer {
        position: fixed;
        bottom: calc(var(--nav-height) + 16px);
        right: 20px;
    }

    .btn-done {
        background: var(--accent);
        color: var(--bg-main);
        font-size: 1rem;
        font-weight: 600;
        padding: 12px 28px;
        border-radius: 999px;
        cursor: pointer;
        min-width: 90px;
        transition: opacity 0.15s;
    }

    .btn-done:disabled { opacity: 0.5; cursor: default; }

    /* ── locked ── */
    .locked {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 12px;
        min-height: 60vh;
        text-align: center;
        padding: 24px;
    }

    .locked-msg {
        font-size: 1.2rem;
        font-weight: 600;
    }

    .locked-sub {
        color: var(--text-muted);
        font-size: 0.95rem;
        max-width: 280px;
        line-height: 1.6;
    }

    .locked-sub a {
        color: var(--accent);
        text-decoration: underline;
    }
</style>