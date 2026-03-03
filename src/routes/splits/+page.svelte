<script>
    import { onMount } from 'svelte';
    import { db } from '$lib/db.js';
    import Card from '$lib/components/Card.svelte';

    // ── view stack ─────────────────────────────────────────────
    // 'splits' → 'days' → 'exercises'
    let view        = $state('splits');
    let activeSplit = $state(null); // { id, name }
    let activeDay   = $state(null); // { id, splitId, name, order }

    // ── data ───────────────────────────────────────────────────
    let splits    = $state([]);
    let days      = $state([]);
    let exercises = $state([]);

    // ── new-item inputs ────────────────────────────────────────
    let newSplitName = $state('');
    let newDayName   = $state('');
    let newExName    = $state('');
    let newExSets    = $state(3);

    onMount(loadSplits);

    async function loadSplits() {
        splits = await db.splits.toArray();
    }

    async function loadDays(split) {
        activeSplit = split;
        const rows = await db.days.where('splitId').equals(split.id).toArray();
        days = rows.sort((a, b) => a.order - b.order);
        view = 'days';
    }

    async function loadExercises(day) {
        activeDay = day;
        const rows = await db.exercises.where('dayId').equals(day.id).toArray();
        exercises = rows.sort((a, b) => a.order - b.order);
        view = 'exercises';
    }

    // ── splits CRUD ────────────────────────────────────────────
    async function addSplit() {
        const name = newSplitName.trim();
        if (!name) return;
        await db.splits.add({ name });
        newSplitName = '';
        await loadSplits();
    }

    async function renameSplit(split, name) {
        if (!name.trim()) return;
        await db.splits.update(split.id, { name: name.trim() });
        split.name = name.trim();
    }

    async function deleteSplit(split) {
        // cascade: remove exercises then days then split
        const splitDays = await db.days.where('splitId').equals(split.id).toArray();
        for (const d of splitDays) {
            await db.exercises.where('dayId').equals(d.id).delete();
        }
        await db.days.where('splitId').equals(split.id).delete();
        await db.splits.delete(split.id);
        await loadSplits();
    }

    // ── days CRUD ──────────────────────────────────────────────
    async function addDay() {
        const name = newDayName.trim();
        if (!name) return;
        await db.days.add({ splitId: activeSplit.id, name, order: days.length });
        newDayName = '';
        await loadDays(activeSplit);
    }

    async function renameDay(day, name) {
        if (!name.trim()) return;
        await db.days.update(day.id, { name: name.trim() });
        day.name = name.trim();
    }

    async function deleteDay(day) {
        await db.exercises.where('dayId').equals(day.id).delete();
        await db.days.delete(day.id);
        await loadDays(activeSplit);
    }

    // ── exercises CRUD ─────────────────────────────────────────
    async function addExercise() {
        const name = newExName.trim();
        if (!name) return;
        const sets = Math.max(1, Number(newExSets) || 3);
        await db.exercises.add({ dayId: activeDay.id, name, sets, order: exercises.length });
        newExName = '';
        newExSets = 3;
        await loadExercises(activeDay);
    }

    async function updateExercise(ex, field, value) {
        const update = { [field]: field === 'sets' ? Math.max(1, Number(value) || 1) : value.trim() };
        if (field === 'name' && !update.name) return;
        await db.exercises.update(ex.id, update);
        ex[field] = update[field];
    }

    async function deleteExercise(ex) {
        await db.exercises.delete(ex.id);
        await loadExercises(activeDay);
    }

    // ── keyboard helpers ───────────────────────────────────────
    function onEnter(fn) {
        return (e) => { if (e.key === 'Enter') fn(); };
    }
</script>

<!-- ── BREADCRUMB ─────────────────────────────────────────── -->
<div class="breadcrumb">
    <button onclick={() => { view = 'splits'; activeSplit = null; activeDay = null; }}
            class:active={view === 'splits'}>Splits</button>
    {#if activeSplit}
        <span class="sep">›</span>
        <button onclick={() => { view = 'days'; activeDay = null; loadDays(activeSplit); }}
                class:active={view === 'days'}>{activeSplit.name}</button>
    {/if}
    {#if activeDay}
        <span class="sep">›</span>
        <button class:active={view === 'exercises'}>{activeDay.name}</button>
    {/if}
</div>

<!-- ── SPLITS VIEW ────────────────────────────────────────── -->
{#if view === 'splits'}
    {#each splits as split (split.id)}
        <Card>
            <div class="row">
                <input class="inline-input"
                       value={split.name}
                       onblur={(e) => renameSplit(split, e.target.value)}
                       onkeydown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                <div class="actions">
                    <button class="btn-text" onclick={() => loadDays(split)}>Edit days →</button>
                    <button class="btn-danger" onclick={() => deleteSplit(split)}>✕</button>
                </div>
            </div>
        </Card>
    {/each}

    <div class="add-row">
        <input class="inline-input new-input"
               bind:value={newSplitName}
               placeholder="New split name…"
               onkeydown={onEnter(addSplit)} />
        <button class="btn-add" onclick={addSplit}>Add</button>
    </div>

<!-- ── DAYS VIEW ─────────────────────────────────────────── -->
{:else if view === 'days'}
    {#each days as day (day.id)}
        <Card>
            <div class="row">
                <input class="inline-input"
                       value={day.name}
                       onblur={(e) => renameDay(day, e.target.value)}
                       onkeydown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                <div class="actions">
                    <button class="btn-text" onclick={() => loadExercises(day)}>Exercises →</button>
                    <button class="btn-danger" onclick={() => deleteDay(day)}>✕</button>
                </div>
            </div>
        </Card>
    {/each}

    <div class="add-row">
        <input class="inline-input new-input"
               bind:value={newDayName}
               placeholder="New day name…"
               onkeydown={onEnter(addDay)} />
        <button class="btn-add" onclick={addDay}>Add</button>
    </div>

<!-- ── EXERCISES VIEW ────────────────────────────────────── -->
{:else if view === 'exercises'}
    {#each exercises as ex (ex.id)}
        <Card>
            <div class="row ex-row">
                <input class="inline-input"
                       value={ex.name}
                       onblur={(e) => updateExercise(ex, 'name', e.target.value)}
                       onkeydown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                <div class="sets-field">
                    <label>sets</label>
                    <input type="number" min="1" max="20"
                           class="inline-input sets-input"
                           value={ex.sets}
                           onblur={(e) => updateExercise(ex, 'sets', e.target.value)}
                           onkeydown={(e) => { if (e.key === 'Enter') e.target.blur(); }} />
                </div>
                <button class="btn-danger" onclick={() => deleteExercise(ex)}>✕</button>
            </div>
        </Card>
    {/each}

    <div class="add-row">
        <input class="inline-input new-input"
               bind:value={newExName}
               placeholder="Exercise name…"
               onkeydown={onEnter(addExercise)} />
        <input type="number" min="1" max="20"
               class="inline-input sets-input"
               bind:value={newExSets} />
        <button class="btn-add" onclick={addExercise}>Add</button>
    </div>
{/if}

<style>
    .breadcrumb {
        display: flex;
        align-items: center;
        gap: 4px;
        margin-bottom: 20px;
        font-size: 0.9rem;
    }

    .breadcrumb button {
        color: var(--text-muted);
        cursor: pointer;
        padding: 2px 4px;
        border-radius: 4px;
        transition: color 0.15s;
    }

    .breadcrumb button.active,
    .breadcrumb button:hover {
        color: var(--text-main);
    }

    .sep {
        color: var(--border);
    }

    .row {
        display: flex;
        align-items: center;
        gap: 8px;
    }

    .inline-input {
        flex: 1;
        background: transparent;
        border: none;
        border-bottom: 1px solid transparent;
        color: var(--text-main);
        font-size: 1rem;
        padding: 4px 0;
        transition: border-color 0.15s;
        min-width: 0;
    }

    .inline-input:focus {
        border-bottom-color: var(--accent);
        outline: none;
    }

    .actions {
        display: flex;
        align-items: center;
        gap: 8px;
        flex-shrink: 0;
    }

    .ex-row {
        gap: 12px;
    }

    .sets-field {
        display: flex;
        align-items: center;
        gap: 6px;
        flex-shrink: 0;
    }

    .sets-field label {
        font-size: 0.75rem;
        color: var(--text-muted);
        white-space: nowrap;
    }

    .sets-input {
        width: 44px;
        flex: none;
        text-align: center;
    }

    .add-row {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 8px 0;
        border-top: 1px solid var(--border);
        margin-top: 8px;
    }

    .new-input {
        border-bottom-color: var(--border) !important;
    }

    .new-input:focus {
        border-bottom-color: var(--accent) !important;
    }

    .new-input::placeholder {
        color: var(--text-muted);
        opacity: 1;
    }

    .btn-text {
        color: var(--accent);
        font-size: 0.85rem;
        cursor: pointer;
        white-space: nowrap;
        padding: 4px 0;
        opacity: 0.8;
        transition: opacity 0.15s;
    }

    .btn-text:hover { opacity: 1; }

    .btn-danger {
        color: var(--danger);
        cursor: pointer;
        font-size: 0.85rem;
        padding: 4px;
        opacity: 0.6;
        transition: opacity 0.15s;
    }

    .btn-danger:hover { opacity: 1; }

    .btn-add {
        color: var(--accent);
        border: 1px solid var(--border);
        padding: 6px 14px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 0.9rem;
        white-space: nowrap;
        transition: opacity 0.15s;
    }

    .btn-add:hover {
        background: var(--bg-card);
    }
</style>
