<script>
    export let value;
    export let placeholder = "";
    export let type = "text";
</script>

<input {type} bind:value {placeholder} />

<style>
    input {
        width: 100%;
        background: transparent;
        border-bottom: 1px solid var(--border);
        color: var(--text-main);
        padding: 8px 0;
        font-size: 1rem;
        transition: border-color 0.2s;
    }

    input:focus {
        border-color: var(--accent);
    }
</style>