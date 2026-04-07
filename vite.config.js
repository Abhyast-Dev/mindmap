import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite'; 

export default defineConfig({
    plugins: [
        sveltekit(),    // 1. SvelteKit first
        tailwindcss()   // 2. Tailwind second
    ]
});