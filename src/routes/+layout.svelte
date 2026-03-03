<script>
    import '../app.css';
    import { page } from '$app/state';
    import { icons } from '$lib/icons.js';
    import { onMount } from 'svelte';

    onMount(() => {
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('/debloated/sw.js');
        }
    });

    const navItems = [
        { href: '/',        label: 'Log',     paths: icons.barbell   },
        { href: '/history', label: 'History', paths: icons.lineChart },
        { href: '/splits',  label: 'Splits',  paths: icons.sliders   },
    ];
</script>

<div class="app-container">
    <main>
        <slot />
    </main>

    <nav>
        {#each navItems as { href, label, paths }}
            <a {href} class:active={page.url.pathname === href}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    {#each paths as d}
                        <path {d} />
                    {/each}
                </svg>
                <span>{label}</span>
            </a>
        {/each}
    </nav>
</div>

<style>
    .app-container {
        display: flex;
        flex-direction: column;
        min-height: 100vh;
        margin: 0 auto;
        position: relative;
        border-left: 1px solid var(--border);
        border-right: 1px solid var(--border);
    }

    main {
        flex: 1;
        padding: 20px;
        padding-bottom: calc(var(--nav-height) + 20px);
    }

    nav {
        position: fixed;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);
        width: 100%;
        height: var(--nav-height);
        background-color: var(--bg-card);
        border-top: 1px solid var(--border);
        display: flex;
        justify-content: space-around;
        align-items: center;
        z-index: 10;
    }

    nav a {
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 4px;
        text-decoration: none;
        color: var(--text-muted);
        font-size: 0.75rem;
        transition: color 0.2s;
    }

    nav svg {
        width: 24px;
        height: 24px;
    }

    nav a.active {
        color: var(--accent);
    }
</style>