<script>
	import { onMount } from 'svelte';

	// --- State Management (Svelte 5 Runes) ---
	let nodes = $state([]); 
	let connections = $state([]);
	let selectedNodeId = $state(null);
	let nodeName = $state('');
	let nodeType = $state('type-central');
	let mapTitle = $state('');
	let studentName = $state('');

	// --- Features & Functions ---

	// 🚨 Refined Add Node with Single Root Enforcement & Radial Physics
function addNewNode() {
    if (!nodeName.trim()) return alert('Please enter a concept name!');

    // 1. Enforce Single Root
    if (nodeType === 'type-central' && nodes.some(n => n.type === 'type-central')) {
        return alert('Only one central root is allowed! Use branches to expand.');
    }

    const id = Date.now();
    let x, y;

    if (nodeType === 'type-central') {
        x = window.innerWidth / 2;
        y = window.innerHeight / 2.5; // Auto-centered
    } else if (selectedNodeId) {
        const parent = nodes.find((n) => n.id === selectedNodeId);
        // 2. Angle-based distribution (Point 5)
        const angle = Math.random() * Math.PI * 2;
        const radius = 160;
        x = parent.x + Math.cos(angle) * radius;
        y = parent.y + Math.sin(angle) * radius;
    } else {
        x = 100; y = 150;
    }

    const newNode = { id, name: nodeName, type: nodeType, x, y };
    nodes = [...nodes, newNode]; // Safer Reactivity (Point 3)

    if (selectedNodeId && nodeType !== 'type-central') {
        connections = [...connections, { id: `c-${selectedNodeId}-${id}`, parentId: selectedNodeId, childId: id }];
    }
    nodeName = ''; 
}
		const newNode = { id, name: nodeName, type: nodeType, x, y };
		
		// Reactive push for Svelte 5
		nodes.push(newNode);

		if (selectedNodeId && nodeType !== 'type-central') {
			connections.push({ id: `c-${id}`, parentId: selectedNodeId, childId: id });
		}

		nodeName = ''; // Reset input
	}

	function deleteNode(id) {
		// Filter using reassignment for reactivity
		connections = connections.filter((c) => c.parentId !== id && c.childId !== id);
		nodes = nodes.filter((n) => n.id !== id);
		if (selectedNodeId === id) selectedNodeId = null;
	}

	function selectNode(id) {
		selectedNodeId = id;
	}

	function clearSelection() {
		selectedNodeId = null;
	}

	function preparePrint() {
		window.print();
	}

	// --- Optimized Draggable Logic ---
	// --- Unified Touch & Mouse Draggable Logic ---
// 🚨 Safer Drag with Memory Cleanup (Point 2)
function drag(nodeElement, nodeId) {
    let moving = false;
    let startX, startY, initialNodeX, initialNodeY;

    function handleMove(e) {
        if (!moving) return;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const dx = clientX - startX;
        const dy = clientY - startY;

        // Immutable update for rock-solid reactivity
        nodes = nodes.map(n => n.id === nodeId ? { ...n, x: initialNodeX + dx, y: initialNodeY + dy } : n);
    }

    function handleEnd() {
        moving = false;
        window.removeEventListener('mousemove', handleMove);
        window.removeEventListener('mouseup', handleEnd);
        window.removeEventListener('touchmove', handleMove);
        window.removeEventListener('touchend', handleEnd);
    }

    function handleStart(e) {
        if (e.target.closest('.delete-btn')) return;
        moving = true;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const node = nodes.find(n => n.id === nodeId);
        if (node) {
            startX = clientX; startY = clientY;
            initialNodeX = node.x; initialNodeY = node.y;
        }

        window.addEventListener('mousemove', handleMove);
        window.addEventListener('mouseup', handleEnd);
        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('touchend', handleEnd);
        if (e.type === 'touchstart') e.preventDefault();
    }

    nodeElement.addEventListener('mousedown', handleStart);
    nodeElement.addEventListener('touchstart', handleStart, { passive: false });

    return {
        destroy() {
            nodeElement.removeEventListener('mousedown', handleStart);
            nodeElement.removeEventListener('touchstart', handleStart);
        }
    };
}

onMount(() => {
		if ('serviceWorker' in navigator) {
			navigator.serviceWorker
				.register('/sw.js')
				.then(() => console.log('ABLE™ PWA: Ready!'))
				.catch((err) => console.log('PWA Error:', err));
		}
	});
</script>

<div class="flex h-screen flex-col overflow-hidden bg-[#272b6a] font-sans text-white">
	
	<div class="hidden print:block border-b-4 border-[#272b6a] bg-white p-5 text-left text-[#272b6a]">
		<h1 class="m-0 text-2xl font-bold">{mapTitle || 'Cognitive Map'}</h1>
		<p class="mt-1 font-bold text-[#ee4977]">{studentName ? `By: ${studentName}` : ''}</p>
	</div>

	<header class="z-[1001] flex items-center justify-between border-b-4 border-[#ee4977] bg-white px-5 py-2 text-[#272b6a] print:hidden">
		<div class="flex items-center gap-4">
			<img src="/Logo.png" alt="Abhyast Logo" class="h-12 w-auto" />
			<div class="text-left">
				<div class="text-2xl font-extrabold tracking-wider">ABLE<span class="text-[#ee4977]">™</span></div>
				<div class="text-[0.75em] font-bold text-gray-500 uppercase">Autonomy Building Learning Environment</div>
			</div>
		</div>
		<div class="text-[0.9em] font-bold">Mind Mapping Made ABLE™</div>
	</header>

	<div class="z-[1000] flex items-center gap-2 border-b border-[#4bc2c4] bg-white/10 p-2 overflow-x-auto no-scrollbar print:hidden">
    <input type="text" bind:value={nodeName} placeholder="Concept..." class="w-32 shrink-0 rounded border border-[#4bc2c4] bg-[#1a1d4a] p-2 text-sm text-white outline-none" />
    
    <select bind:value={nodeType} class="w-24 shrink-0 rounded border border-[#4bc2c4] bg-[#1a1d4a] p-2 text-sm text-white outline-none">
        <option value="type-central">Root</option>
        <option value="type-branch">Branch</option>
        <option value="type-leaf">Leaf</option>
    </select>
    
    <button on:click={addNewNode} class="shrink-0 rounded bg-[#4bc2c4] px-3 py-2 text-sm font-bold text-[#272b6a]">+ Node</button>
    
    <button on:click={clearSelection} class="shrink-0 rounded bg-white/20 px-3 py-2 text-sm text-white">Deselect</button>
    
    <input type="text" bind:value={mapTitle} placeholder="Title..." class="w-28 shrink-0 rounded border border-[#4bc2c4] bg-[#1a1d4a] p-2 text-sm text-white outline-none" />
    
    <button on:click={preparePrint} class="shrink-0 rounded bg-[#fde32d] px-3 py-2 text-sm font-bold text-[#272b6a]">PDF</button>
</div>
	<div id="canvas-wrapper" class="relative flex-grow overflow-hidden">
		<svg class="pointer-events-none absolute left-0 top-0 h-full w-full">
			{#each connections as conn (conn.id)}
				{@const parent = nodes.find((n) => n.id === conn.parentId)}
				{@const child = nodes.find((n) => n.id === conn.childId)}
				{#if parent && child}
					<line
						x1={parent.x + 60}
						y1={parent.y + 25}
						x2={child.x + 60}
						y2={child.y + 25}
						class="stroke-white/50 stroke-[3] print:stroke-gray-400 print:stroke-[2]"
					/>
				{/if}
			{/each}
		</svg>

		<div id="canvas" class="relative h-full w-full">
			{#if nodes.length === 0}
				<p class="pointer-events-none absolute top-[40%] w-full text-center opacity-70">
					Select a parent node, type a name, and click + Node <br />
					(Hint: Start with a Central Idea - Root!)<br />
					Only one root is allowed <br/>
					Click a node to select it<br/>
					Branch or leaf nodes are added to the selected parent <br/>
				
				</p>
			{/if}

			{#each nodes as node (node.id)}
				<div
					use:drag={node.id}
					on:click|stopPropagation={() => selectNode(node.id)}
					on:touchend|stopPropagation={() => selectNode(node.id)}
					style="left: {node.x}px; top: {node.y}px;"
					class="absolute z-10 cursor-grab select-none whitespace-nowrap rounded-[30px] border-2 border-white px-6 py-3 font-bold shadow-[0_4px_15px_rgba(0,0,0,0.4)] transition-all
					{node.type === 'type-central' ? 'bg-[#fde32d] text-[#272b6a] scale-110' : ''}
					{node.type === 'type-branch' ? 'bg-[#ee4977]' : ''}
					{node.type === 'type-leaf' ? 'bg-[#2ecc71] text-[0.9em]' : ''}
					{selectedNodeId === node.id ? 'ring-4 ring-[#fde32d] shadow-[0_0_20px_#fde32d]' : ''}
					print:shadow-none print:border print:border-black print:text-black"
				>
					{node.name}
					<span
						on:click|stopPropagation={() => deleteNode(node.id)}
						class="delete-btn ml-2 cursor-pointer text-xs opacity-60 hover:opacity-100 print:hidden"
					>×</span>
				</div>
			{/each}
		</div>
	</div>

	<footer class="z-[1001] border-t border-white/10 bg-black/30 p-4 text-[0.85em] print:hidden">
		<div class="mb-2 flex justify-center gap-4">
			<span>📧 <a href="mailto:contact@abhyast.in" class="font-bold text-[#4bc2c4] no-underline hover:text-[#fde32d] hover:underline">contact@abhyast.in</a></span>
			<span>💬 <a href="https://wa.me/+919910686080" class="font-bold text-[#4bc2c4] no-underline hover:text-[#fde32d] hover:underline">WhatsApp Support</a></span>
		</div>
		<div class="opacity-80 text-center">
			© 2026 Abhyast Private Limited. ABLE™ (Autonomy Building Learning Environment) and TAKECARE™ are registered cognitive frameworks.
		</div>
	</footer>
</div>

<style>
	@media print {
		:global(body) {
			background: white !important;
		}
		:global(*) {
			-webkit-print-color-adjust: exact !important;
			print-color-adjust: exact !important;
		}
	}
</style>
