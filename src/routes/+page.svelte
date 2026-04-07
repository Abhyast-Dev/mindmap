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

	function addNewNode() {
		if (!nodeName.trim()) return alert('Please enter a concept name!');

		const id = Date.now();
		let x, y;

		if (nodeType === 'type-central') {
			x = window.innerWidth / 2.5;
			y = window.innerHeight / 3;
		} else if (selectedNodeId) {
			const parent = nodes.find((n) => n.id === selectedNodeId);
			// Offset from parent
			x = parent.x + 180;
			y = parent.y + (Math.random() * 120 - 60);
		} else {
			x = 50;
			y = 100;
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
	function drag(nodeElement, nodeId) {
		let moving = false;

		function handleMousedown(e) {
			// Don't trigger drag if clicking the delete 'x'
			if (e.target.closest('.delete-btn')) return;
			moving = true;
			e.preventDefault();
		}

		function handleMousemove(e) {
			if (!moving) return;
			// Direct mutation of the state proxy for maximum performance in Svelte 5
			const node = nodes.find(n => n.id === nodeId);
			if (node) {
				node.x += e.movementX;
				node.y += e.movementY;
			}
		}

		function handleMouseup() {
			moving = false;
		}

		nodeElement.addEventListener('mousedown', handleMousedown);
		window.addEventListener('mousemove', handleMousemove);
		window.addEventListener('mouseup', handleMouseup);

		return {
			destroy() {
				nodeElement.removeEventListener('mousedown', handleMousedown);
				window.removeEventListener('mousemove', handleMousemove);
				window.removeEventListener('mouseup', handleMouseup);
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
		<div class="text-[0.9em] font-bold">Cognitive Framework by Abhyast</div>
	</header>

	<div class="z-[1000] flex flex-wrap items-center justify-center gap-2 border-b border-[#4bc2c4] bg-white/10 p-3 print:hidden">
		<input
			type="text"
			bind:value={nodeName}
			placeholder="Concept Name..."
			class="rounded border border-[#4bc2c4] bg-[#1a1d4a] p-2 text-white outline-none placeholder:text-white"
		/>
		<select 
			bind:value={nodeType} 
			class="rounded border border-[#4bc2c4] bg-[#1a1d4a] p-2 text-white outline-none cursor-pointer"
		>
			<option value="type-central" class="bg-[#272b6a]">Central Root</option>
			<option value="type-branch" class="bg-[#272b6a]">Branch</option>
			<option value="type-leaf" class="bg-[#272b6a]">Detail/Leaf</option>
		</select>
		
		<button
			on:click={addNewNode}
			class="rounded bg-[#4bc2c4] px-4 py-2 font-bold text-[#272b6a] hover:brightness-110 transition active:scale-95"
		>+ Add Node</button>
		
		<button
			on:click={clearSelection}
			class="rounded bg-white px-4 py-2 text-[#272b6a] hover:bg-gray-200 transition"
		>Deselect</button>
		
		<input
			type="text"
			bind:value={mapTitle}
			placeholder="Map Title..."
			class="rounded border border-[#4bc2c4] bg-[#1a1d4a] p-2 text-white outline-none placeholder:text-white"
		/>
		
		<input
			type="text"
			bind:value={studentName}
			placeholder="Your Name..."
			class="rounded border border-[#4bc2c4] bg-[#1a1d4a] p-2 text-white outline-none placeholder:text-white"
		/>
		
		<button
			on:click={preparePrint}
			class="rounded bg-[#fde32d] px-4 py-2 font-bold text-[#272b6a] hover:brightness-110 transition"
		>Print / 💾 Save PDF</button>
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
					Select a Parent node, type a name, and click '+ Add Node'<br />
					(Hint: Start with a Central Root!)
				</p>
			{/if}

			{#each nodes as node (node.id)}
				<div
					use:drag={node.id}
					on:click|stopPropagation={() => selectNode(node.id)}
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