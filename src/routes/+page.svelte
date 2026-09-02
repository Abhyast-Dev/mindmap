<script>
	import { onMount, tick } from 'svelte';
	import domtoimage from 'dom-to-image';

	let nodes = $state([]);
	let connections = $state([]);
	let selectedNodeId = $state(null);
	let nodeName = $state('');
	let nodeType = $state('type-central');
	let mapTitle = $state('');
	let studentName = $state('');
	
	let scale = $state(1);
	let offsetX = $state(2500);
	let offsetY = $state(2500);
	let isPanning = false;
	let startPanX, startPanY;

	let mapQuality = $derived.by(() => {
		if (nodes.length === 0) return 0;
		if (nodes.length === 1) return 1; 
		const allConnected = connections.length >= nodes.length - 1;
		if (allConnected && nodes.length > 1) return 3;
		return 2; 
	});

	let thinkingMessage = $derived.by(() => {
		if (nodes.length === 0) return "Ready to begin? Place your first Home Node to start mapping.";
		switch(mapQuality) {
			case 0: return "Initial Inquiry: You've started capturing thoughts. Now, try to expand on them.";
			case 1: return "Structuring Logic: You've identified key nodes. Can you connect them to show how they relate?";
			case 2: return "Establishing Cohesion: Most ideas are linked. You're building a clear mental model.";
			case 3: return "Deep Synthesis: You've created a complex, fully connected web. This is advanced thinking!";
			default: return "Keep mapping your thoughts to see your thinking level grow.";
		}
	});

	let history = [];
	let future = [];
	let showInfo = $state(false);

	function toggleInfo() {
		showInfo = !showInfo;
	}

	function saveHistory() {
		history.push({
			nodes: JSON.parse(JSON.stringify(nodes)),
			connections: JSON.parse(JSON.stringify(connections))
		});
		if (history.length > 50) history.shift();
		future = []; 
	}

	function undo() {
		if (history.length === 0) return;
		future.push({ nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)) });
		const prev = history.pop();
		nodes = prev.nodes; connections = prev.connections;
	}

	function redo() {
		if (future.length === 0) return;
		history.push({ nodes: JSON.parse(JSON.stringify(nodes)), connections: JSON.parse(JSON.stringify(connections)) });
		const next = future.pop();
		nodes = next.nodes; connections = next.connections;
	}

	function handleWheel(e) {
		e.preventDefault();
		const zoomFactor = 0.001;
		scale = Math.min(Math.max(0.2, scale - e.deltaY * zoomFactor), 3);
	}

	function addNewNode() {
		if (!nodeName.trim()) return alert('Enter concept name');
		
		if (nodeType === 'type-central' && nodes.some(n => n.type === 'type-central')) {
			return alert('Only one central root allowed.');
		}
		
		if (nodeType !== 'type-central' && !selectedNodeId) {
			return alert('Select a parent node (Root Concept or Major Branch) first.');
		}

		if (selectedNodeId) {
			const parent = nodes.find(n => n.id === selectedNodeId);
			if (parent && parent.type === 'type-leaf') {
				return alert('Leaf nodes are terminal details and cannot have sub-branches.');
			}
		}

		saveHistory();
		const id = Date.now();
		let x, y;

		if (nodeType === 'type-central') {
			x = 2500;
			y = 2500;
		} else {
			const parent = nodes.find(n => n.id === selectedNodeId);
			const siblings = connections.filter(c => c.parentId === selectedNodeId).length;
			const angle = (siblings * Math.PI) / 3; 
			const radius = 160;
			x = parent.x + Math.cos(angle) * radius;
			y = parent.y + Math.sin(angle) * radius;
		}

		nodes = [...nodes, { id, name: nodeName.trim(), type: nodeType, x, y }];
		if (selectedNodeId && nodeType !== 'type-central') {
			connections = [...connections, { id: `c-${selectedNodeId}-${id}`, parentId: selectedNodeId, childId: id }];
		}
		nodeName = ''; 
	}

	function cleanMap() {
		if (nodes.length === 0) return;
		if (confirm("Are you sure you want to clear the entire map? This cannot be undone.")) {
			saveHistory();
			nodes = [];
			connections = [];
			selectedNodeId = null;
			mapTitle = '';
			resetView();
		}
	}

	function deleteNode(id) {
		saveHistory();
		nodes = nodes.filter(n => n.id !== id);
		connections = connections.filter(c => c.parentId !== id && c.childId !== id);
		if (selectedNodeId === id) selectedNodeId = null;
	}

	function drag(nodeElement, nodeId) {
		let moving = false, moved = false, sX, sY, iX, iY;

		function move(e) {
			if (!moving) return;
			moved = true;
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;
			nodes = nodes.map(n => n.id === nodeId ? { ...n, x: iX + (clientX - sX) / scale, y: iY + (clientY - sY) / scale } : n);
		}

		function stop() {
			if (moved) saveHistory();
			moving = false; moved = false;
			window.removeEventListener('mousemove', move);
			window.removeEventListener('mouseup', stop);
			window.removeEventListener('touchmove', move);
			window.removeEventListener('touchend', stop);
		}

		function start(e) {
			if (e.target.closest('.delete-btn')) return;
			moving = true;
			const clientX = e.touches ? e.touches[0].clientX : e.clientX;
			const clientY = e.touches ? e.touches[0].clientY : e.clientY;
			const node = nodes.find(n => n.id === nodeId);
			sX = clientX; sY = clientY; iX = node.x; iY = node.y;
			window.addEventListener('mousemove', move);
			window.addEventListener('mouseup', stop);
			window.addEventListener('touchmove', move, { passive: false });
			window.addEventListener('touchend', stop);
		}

		nodeElement.addEventListener('mousedown', start);
		nodeElement.addEventListener('touchstart', start, { passive: false });
		return { destroy() {} };
	}

	async function exportPNG() {
		const target = document.querySelector("#canvas-inner");
		if (!target) return;

		await tick();
		domtoimage.toPng(target, {
			width: 5000,
			height: 5000,
			style: {
				transform: 'scale(1)',
				transformOrigin: 'top left'
			}
		})
		.then((dataUrl) => {
			const link = document.createElement('a');
			link.download = `ABLE_MindMap_${studentName || 'Student'}.png`;
			link.href = dataUrl;
			link.click();
			alert("Well done! Your mindmap analysis has been exported successfully.");
		})
		.catch((error) => {
			console.error('Export Error:', error);
			alert('Export failed. Please try again.');
		});
	}

	function saveToLocal() {
		if (!studentName.trim()) return alert("Please enter a student name before saving.");
		const key = `ABLE_Map_${studentName.trim().toLowerCase()}`;
		localStorage.setItem(key, JSON.stringify({ nodes, connections, mapTitle }));
		alert("Map Secured Locally!");
	}

	function loadFromLocal() {
		if (!studentName.trim()) return alert("Enter student name to load map.");
		const key = `ABLE_Map_${studentName.trim().toLowerCase()}`;
		const saved = localStorage.getItem(key);
		if (saved) {
			try {
				const data = JSON.parse(saved);
				nodes = data.nodes || [];
				connections = data.connections || [];
				mapTitle = data.mapTitle || '';
				alert("Map loaded successfully!");
			} catch { alert("Data Corrupted."); }
		} else alert("No saved map found for this name.");
	}

	function resetView() { 
		scale = 1; 
		offsetX = window.innerWidth / 2 - 2500; 
		offsetY = window.innerHeight / 2 - 2500; 
	}

	onMount(() => {
		resetView();
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && nodeName) { addNewNode(); }
			if (e.key === 'Delete' && selectedNodeId) deleteNode(selectedNodeId);
		});
		window.addEventListener('mouseup', () => isPanning = false);
		window.addEventListener('touchend', () => isPanning = false);
	});
</script>

<div class="flex h-screen flex-col overflow-hidden bg-[#1e2254] font-sans text-white select-none">
	
	<header class="z-[1001] flex items-center justify-between border-b-4 border-[#ee4977] bg-white px-5 py-2 text-[#272b6a] shrink-0 shadow-2xl">
		<div class="flex items-center gap-4">
			<div class="text-xl font-black italic">ABLE™ <span class="text-xs font-bold text-slate-400 not-italic">Mind-map Lab</span></div>
		</div>
		
		<div class="hidden md:flex gap-1 text-lg cursor-help items-center" title={thinkingMessage}>
			{#each Array(3) as _, i}
				<span>{i < mapQuality ? '⭐' : '🔘'}</span>
			{/each}
			<span class="text-[0.6em] uppercase font-black ml-2 text-slate-400">Thinking Level</span>
		</div>

		<div class="flex items-center gap-2">
			<div class="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
				<button on:click={undo} class="px-3 py-1 bg-white text-[#272b6a] rounded-md text-xs font-bold shadow-sm hover:bg-[#ee4977] hover:text-white transition-all">Undo</button>
				<button on:click={redo} class="ml-1 px-3 py-1 bg-white text-[#272b6a] rounded-md text-xs font-bold shadow-sm hover:bg-[#ee4977] hover:text-white transition-all">Redo</button>
			</div>
			<button on:click={resetView} class="px-3 py-1.5 bg-[#272b6a] text-white rounded-lg text-xs font-bold shadow-md hover:brightness-110">🎯 Recenter</button>	
			<button on:click={toggleInfo} class="w-7 h-7 flex items-center justify-center bg-slate-100 text-[#272b6a] rounded-full border border-slate-300 font-serif italic font-bold hover:bg-[#4bc2c4] hover:text-white">i</button>
		</div>
	</header>

	<div class="z-[1000] flex items-center gap-2 border-b border-[#4bc2c4]/30 bg-[#161942] p-2.5 overflow-x-auto no-scrollbar shrink-0 text-sm">
		<input type="text" bind:value={nodeName} placeholder="Concept name..." class="w-36 bg-[#272b6a] border border-[#4bc2c4] px-3 py-1.5 rounded text-white outline-none focus:ring-1 focus:ring-[#4bc2c4]" />
		
		<select bind:value={nodeType} class="bg-[#272b6a] border border-[#4bc2c4] px-3 py-1.5 rounded text-white outline-none">
			<option value="type-central">🟡 Root Concept</option>
			<option value="type-branch">🌸 Major Branch</option>
			<option value="type-leaf">🟢 Leaf (Terminal)</option>
		</select>

		<button on:click={addNewNode} class="bg-[#4bc2c4] px-4 py-1.5 font-bold text-[#272b6a] rounded shadow hover:brightness-105 active:scale-95">+ Add Node</button>
		
		<div class="h-6 w-[1px] bg-white/20 mx-2"></div>
		
		<input type="text" bind:value={studentName} placeholder="Student Name..." class="w-32 bg-[#272b6a] border border-[#4bc2c4] px-3 py-1.5 rounded text-white outline-none" />
		<button on:click={saveToLocal} class="bg-[#2ecc71] text-[#1e2254] px-3 py-1.5 font-bold rounded shadow hover:brightness-105">Save</button>
		<button on:click={loadFromLocal} class="bg-white/20 px-3 py-1.5 font-bold rounded hover:bg-white/30">Load</button>
		
		<div class="h-6 w-[1px] bg-white/20 mx-2"></div>
		
		<button on:click={cleanMap} class="bg-red-500/20 text-red-300 border border-red-500/40 px-3 py-1.5 text-xs font-bold rounded hover:bg-red-500 hover:text-white">Clean Map</button>
		<button on:click={exportPNG} class="bg-[#fde32d] text-[#272b6a] px-3 py-1.5 font-bold rounded shadow hover:brightness-105">PNG Export</button>
	</div>

	<div id="canvas-container" 
		class="relative flex-grow overflow-hidden bg-[radial-gradient(#ffffff10_1px,transparent_1px)] [background-size:30px_30px] cursor-grab active:cursor-grabbing"
		on:wheel={handleWheel}
		on:mousedown={(e) => { 
			if(e.target.closest('.node-base')) return; 
			isPanning = true; 
			startPanX = e.clientX - offsetX; 
			startPanY = e.clientY - offsetY; 
		}}
		on:mousemove={(e) => { 
			if(isPanning) { 
				offsetX = e.clientX - startPanX; 
				offsetY = e.clientY - startPanY; 
			}
		}}
		on:click={() => selectedNodeId = null}
	>
		<div id="canvas-inner" 
			style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transform-origin: 0 0;" 
			class="absolute w-[5000px] h-[5000px] pointer-events-auto"
		>
			<svg id="svg-canvas" class="absolute inset-0 pointer-events-none w-full h-full">
				{#each connections as conn (conn.id)}
					{@const p = nodes.find(n => n.id === conn.parentId)}
					{@const c = nodes.find(n => n.id === conn.childId)}
					{#if p && c}
						<line x1={p.x + 70} y1={p.y + 25} x2={c.x + 70} y2={c.y + 25} class="stroke-[#4bc2c4] stroke-[3] opacity-60" />
					{/if}
				{/each}
			</svg>

			{#each nodes as node (node.id)}
				<div
					use:drag={node.id}
					on:click|stopPropagation={() => selectedNodeId = node.id}
					style="left: {node.x}px; top: {node.y}px;"
					class="node-base absolute z-10 whitespace-nowrap rounded-[2rem] border-2 px-6 py-3 font-bold shadow-2xl transition-shadow duration-200 cursor-pointer flex items-center gap-3
					{node.type === 'type-central' ? 'bg-[#fde32d] text-[#272b6a] border-white text-base shadow-[0_0_25px_rgba(253,227,45,0.4)]' : ''}
					{node.type === 'type-branch' ? 'bg-[#ee4977] text-white border-white text-sm shadow-[0_0_20px_rgba(238,73,119,0.3)]' : ''}
					{node.type === 'type-leaf' ? 'bg-[#2ecc71] text-[#1e2254] border-white text-xs shadow-[0_0_15px_rgba(46,204,113,0.3)]' : ''}
					{selectedNodeId === node.id ? 'ring-4 ring-white ring-offset-2 ring-offset-[#1e2254]' : ''}"
				>
					<span>{node.name}</span>
					{#if node.type === 'type-leaf'}
						<span class="text-[10px] bg-black/20 px-1.5 py-0.5 rounded text-white uppercase tracking-wider">Leaf</span>
					{/if}
					<button on:click|stopPropagation={() => deleteNode(node.id)} class="opacity-40 hover:opacity-100 text-sm font-black px-1">×</button>
				</div>
			{/each}
		</div>
	</div>

	{#if showInfo}
	<div class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm" on:click={toggleInfo}>
		<div class="bg-white w-[90%] max-w-md rounded-3xl p-6 text-[#272b6a] shadow-2xl" on:click|stopPropagation>
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-black uppercase tracking-tight">ABLE™ Mind-map Guide</h2>
				<button on:click={toggleInfo} class="text-2xl opacity-50 hover:opacity-100">×</button>
			</div>
			
			<div class="space-y-3 text-left text-xs leading-relaxed text-slate-600">
				<p><strong>1. Infinite Workspace:</strong> Drag anywhere on the background canvas to pan, and use your mouse wheel to zoom in and out smoothly.</p>
				<p><strong>2. Distinct Tiers:</strong> Root Concepts (Yellow), Major Branches (Pink), and Leaf Details (Green) are visually distinct.</p>
				<p><strong>3. Leaf Terminal Rule:</strong> Leaf nodes are final details and cannot act as parents for sub-branches.</p>
				<p><strong>4. Building:</strong> Select a parent node, choose your node type, type a concept name, and click <strong>+ Add Node</strong>.</p>
				<p><strong>5. Persistence:</strong> Enter a student name and click <strong>Save</strong> to store your map locally on this device.</p>
			</div>
			
			<button on:click={toggleInfo} class="mt-6 w-full py-3 bg-[#272b6a] text-white font-bold rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider">
				Got it, let's map!
			</button>
		</div>
	</div>
	{/if}

	<footer class="z-[1001] border-t border-white/10 bg-black/40 p-3 text-[0.75em] print:hidden flex flex-col sm:flex-row justify-between items-center px-6 gap-2">
		<div class="flex gap-4">
			<span>📧 <a href="mailto:contact@abhyast.in" class="font-bold text-[#4bc2c4] no-underline hover:underline">contact@abhyast.in</a></span>
			<span>💬 <a href="https://wa.me/+919910686080" class="font-bold text-[#4bc2c4] no-underline hover:underline">WhatsApp Support</a></span>
		</div>
		<div class="opacity-70 text-center">
			© 2026 Abhyast Private Limited. ABLE™ Mind-map Lab.
		</div>
	</footer>
</div>

<style>
	:global(body) { margin: 0; overflow: hidden; background: #1e2254; }
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.node-base { cursor: grab; }
	.node-base:active { cursor: grabbing; }
</style> 

