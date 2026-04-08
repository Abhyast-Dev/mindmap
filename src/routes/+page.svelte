

<script>
	import { onMount, tick } from 'svelte';

	/** --- 1. STATE & CORE RUNES --- */
	let nodes = $state([]);
	let connections = $state([]);
	let selectedNodeId = $state(null);
	let nodeName = $state('');
	let nodeType = $state('type-central');
	let mapTitle = $state('');
	let studentName = $state('');
	
	// Navigation (Zoom/Pan)
	let scale = $state(1);
	let offsetX = $state(0);
	let offsetY = $state(0);
	let isPanning = false;
	let startPanX, startPanY;

	/** --- 2. THE COGNITIVE ENGINE (The ABLE™ Moat) --- */
	
	// 🏆 Deep Thinking Score: Differentiates ABLE™ from a simple drawing tool
let mapQuality = $derived.by(() => {
		// No work done yet
		if (nodes.length === 0) return 0;
		
		// Level 1: They have started (Step 1: Think)
		if (nodes.length === 1) return 1; 
		
		// Level 3: Everything on the canvas is connected (Step 5: Organize)
		// We check if the number of connections matches the "logic" of the nodes
		const allConnected = connections.length >= nodes.length - 1;
		if (allConnected && nodes.length > 1) return 3;
		
		// Level 2: They are in the middle of branching out
		return 2; 
	});

	let coachPrompt = $derived.by(() => {
		if (nodes.length === 0) return "The journey of autonomy begins with a Central Root.";
		if (nodes.length > 6 && connections.length < nodes.length - 1) return "I see isolated ideas. Are all thoughts logically connected?";
		if (mapQuality === 3) return "Exceptional! You've built a deep, cohesive cognitive network.";
		return "Think. Organize. Create. What's the next layer of this concept?";
	});

	/** --- 3. HISTORY ENGINE (Undo/Redo) --- */
	let history = [];
	let future = [];

	// 🧠 Custom Thinking Feedback
	let thinkingMessage = $derived.by(() => {
		if (nodes.length === 0) return "Ready to begin? Place your first Home Node to start mapping.";
		
		switch(mapQuality) {
			case 0: 
				return "Initial Inquiry: You've started capturing thoughts. Now, try to expand on them.";
			case 1: 
				return "Structuring Logic: You've identified key nodes. Can you connect them to show how they relate?";
			case 2: 
				return "Establishing Cohesion: Most ideas are linked. You're building a clear mental model.";
			case 3: 
				return "Deep Synthesis: You've created a complex, fully connected web. This is advanced thinking!";
			default: 
				return "Keep mapping your thoughts to see your thinking level grow.";
		}
	});



	// --- Info Modal State ---
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

	/** --- 4. CORE MAPPING & NAVIGATION LOGIC --- */

	function handleWheel(e) {
		e.preventDefault();
		scale = Math.min(Math.max(0.3, scale - e.deltaY * 0.001), 2.5);
	}

	function addNewNode() {
		if (!nodeName.trim()) return alert('Enter concept name');
		if (nodeType === 'type-central' && nodes.some(n => n.type === 'type-central')) {
			return alert('Only one central root allowed.');
		}
		if (nodeType !== 'type-central' && !selectedNodeId) {
			return alert('Select a parent node (Root Concept) first.');
		}

		saveHistory();
		const id = Date.now();
		let x, y;

		if (nodeType === 'type-central') {
			x = window.innerWidth / 2;
			y = window.innerHeight / 2.5;
		} else {
			const parent = nodes.find(n => n.id === selectedNodeId);
			const siblings = connections.filter(c => c.parentId === selectedNodeId).length;
			const angle = (siblings * Math.PI) / 4; 
			const radius = 180;
			x = parent.x + Math.cos(angle) * radius;
			y = parent.y + Math.sin(angle) * radius;
		}

		nodes = [...nodes, { id, name: nodeName, type: nodeType, x, y }];
		if (selectedNodeId && nodeType !== 'type-central') {
			connections = [...connections, { id: `c-${selectedNodeId}-${id}`, parentId: selectedNodeId, childId: id }];
		}
		nodeName = ''; 
	}

	// 🧹 The "Fresh Start" Logic
	function cleanMap() {
		if (nodes.length === 0) return; // Nothing to clear

		// Step 1: Confirmation (Crucial for Agency/Autonomy)
		const confirmClear = confirm("Are you sure you want to clear the entire map? This cannot be undone.");
		
		if (confirmClear) {
			// Step 2: Save to History first (just in case they regret it!)
			saveHistory();

			// Step 3: Reset all reactive states
			nodes = [];
			connections = [];
			selectedNodeId = null;
			mapTitle = ''; // Optional: clear the title too
			
			// Step 4: Reset View (Zoom/Pan)
			scale = 1;
			offsetX = 0;
			offsetY = 0;

			console.log("ABLE™ Lab: Canvas Reset Successful.");
		}
	}

	function deleteNode(id) {
		saveHistory();
		nodes = nodes.filter(n => n.id !== id);
		connections = connections.filter(c => c.parentId !== id && c.childId !== id);
		if (selectedNodeId === id) selectedNodeId = null;
	}

	/** --- 6. DRAG & TOUCH (High-Fidelity) --- */
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

	/** --- 7. PERSISTENCE & EXPORT --- */
	async function exportPNG() {
    const target = document.querySelector("#canvas-wrapper");
    const oldScale = scale; 
    const oldX = offsetX; 
    const oldY = offsetY;

    // Reset view for a clean capture
    scale = 1; offsetX = 0; offsetY = 0;

    await tick(); // Let Svelte sync the DOM

    // We use a small delay to ensure the browser has repainted
    setTimeout(() => {
        domtoimage.toPng(target, {
            width: target.clientWidth * 2, // Scale 2x for high-res
            height: target.clientHeight * 2,
            style: {
                transform: 'scale(2)',
                transformOrigin: 'top left',
                width: target.clientWidth + 'px',
                height: target.clientHeight + 'px'
            }
        })
        .then((dataUrl) => {
            const link = document.createElement('a');
            link.download = `ABLE_Analysis_${studentName || 'Map'}.png`;
            link.href = dataUrl;
            link.click();

            // Restore view
            scale = oldScale; offsetX = oldX; offsetY = oldY;
            alert("Well done! You've created a meaningful map of your ideas. Every connection you’ve made strengthens your understanding.");
        })

        .catch((error) => {
            console.error('Export Error:', error);
            scale = oldScale; offsetX = oldX; offsetY = oldY;
        });
    }, 200);
}

	function saveToLocal() {
		if (!studentName.trim()) return alert("Enter name.");
		localStorage.setItem(`ABLE_Map_${studentName.trim()}`, JSON.stringify({ nodes, connections, mapTitle }));
		alert("Map Secured!");
	}

	function loadFromLocal() {
		const saved = localStorage.getItem(`ABLE_Map_${studentName.trim()}`);
		if (saved) {
			try {
				const data = JSON.parse(saved);
				nodes = data.nodes; connections = data.connections; mapTitle = data.mapTitle;
			} catch { alert("Data Corrupted."); }
		} else alert("Map Not Found.");
	}

	function resetView() { scale = 1; offsetX = 0; offsetY = 0; }

	onMount(() => {
		window.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' && nodeName) { saveHistory(); addNewNode(); }
			if (e.key === 'Delete' && selectedNodeId) deleteNode(selectedNodeId);
		});
		window.addEventListener('mouseup', () => isPanning = false);
		window.addEventListener('touchend', () => isPanning = false);
	});
</script>

<div class="flex h-screen flex-col overflow-hidden bg-[#272b6a] font-sans text-white select-none">
	
	<header class="z-[1001] flex items-center justify-between border-b-4 border-[#ee4977] bg-white px-5 py-2 text-[#272b6a] shrink-0 shadow-2xl">
		<div class="flex items-center gap-4">
			<img src="/Logo.png" alt="Abhyast" class="h-10 w-auto" />
			<div class="hidden sm:block text-left">
				<div class="text-xl font-black italic">ABLE™ <span class="text-xs font-bold text-white-400 not-italic">Mindmap Lab</span></div>
	
			</div>
		</div>
		
		<div class="hidden md:flex gap-1 text-[#ee4977] text-lg cursor-help group relative" title={thinkingMessage}
>
			{#each Array(3) as _, i}
				<span>{i < mapQuality ? '⭐' : '🔘'}</span>
			{/each}
			<span class="text-[0.5em] uppercase font-black ml-2 text-gray-400 self-center">Thinking Level</span>
		</div>

		<div class="flex items-center gap-2">
        <div class="flex bg-slate-100 p-1 rounded-lg border border-slate-200">
            <button 
                on:click={undo} 
                class="px-4 py-1.5 bg-white text-[#272b6a] rounded-md text-xs font-bold shadow-sm hover:bg-[#ee4977] hover:text-white transition-all active:scale-95"
            >
                Undo
            </button>
            <button 
                on:click={redo} 
                class="ml-1 px-4 py-1.5 bg-white text-[#272b6a] rounded-md text-xs font-bold shadow-sm hover:bg-[#ee4977] hover:text-white transition-all active:scale-95"
            >
                Redo
            </button>
        </div>

        <button 
            on:click={resetView} 
			title="Get back to the map"
            class="px-4 py-2 bg-[#272b6a] text-white rounded-lg text-xs font-bold shadow-lg hover:brightness-110 transition-all active:scale-95"
        >
            🎯 Recenter View
        </button>	
    </div>
	<button 
    on:click={toggleInfo} 
		class="ml-2 w-8 h-8 flex items-center justify-center bg-slate-100 text-[#272b6a] rounded-full border border-slate-300 font-serif italic font-bold hover:bg-[#4bc2c4] hover:text-white transition-all shadow-sm"
	>
		i
	</button>

</header>

	<div class="z-[1000] flex items-center gap-2 border-b border-[#4bc2c4] bg-white/10 p-2 overflow-x-auto no-scrollbar shrink-0">
		<input type="text" bind:value={nodeName} placeholder="New Concept..." class="w-32 bg-[#1a1d4a] border border-[#4bc2c4] p-2 text-sm rounded outline-none" />
		<select bind:value={nodeType} class="bg-[#1a1d4a] border border-[#4bc2c4] p-2 text-sm rounded outline-none">
			<option value="type-central">Root Concept</option>
			<option value="type-branch">Major Branch</option>
			<option value="type-leaf">Leaf/Detail</option>
		</select>
		<button on:click={() => {addNewNode();}} class="bg-[#4bc2c4] px-4 py-2 text-sm font-bold text-[#272b6a] rounded active:scale-95 shadow-md">+ Add</button>
		
		<div class="h-6 w-[1px] bg-white/20 mx-2"></div>
		
		<input type="text" bind:value={studentName} placeholder="Student Name..." class="w-32 bg-[#1a1d4a] border border-[#4bc2c4] p-2 text-sm rounded outline-none" />
		<button on:click={saveToLocal} class="bg-[#2ecc71] px-4 py-2 text-sm font-bold rounded">Save Map</button>
		<button on:click={loadFromLocal} class="bg-white/20 px-4 py-2 text-sm font-bold rounded">Load</button>
		
		<div class="h-6 w-[1px] bg-white/20 mx-2"></div>
		
		<button on:click={cleanMap} class="bg-white/10 px-3 py-2 text-xs rounded border border-white/20 hover:bg-[#ee4977]">Clean Map</button>
		<button on:click={exportPNG} class="bg-[#fde32d] px-4 py-2 text-sm font-bold text-[#272b6a] rounded shadow-lg">PNG Export</button>
	</div>

	<div id="canvas-wrapper" 
		class="relative flex-grow overflow-hidden bg-[radial-gradient(#ffffff08_1px,transparent_1px)] [background-size:40px_40px]"
		on:wheel={handleWheel}
		on:mousedown={(e) => { if(e.target.closest('.node-base')) return; isPanning = true; startPanX = e.clientX - offsetX; startPanY = e.clientY - offsetY; }}
		on:mousemove={(e) => { if(isPanning) { offsetX = e.clientX - startPanX; offsetY = e.clientY - startPanY; }}}
		on:click={() => selectedNodeId = null}
	>
		<div style="transform: translate({offsetX}px, {offsetY}px) scale({scale}); transform-origin: 0 0;" class="relative w-full h-full">
			<svg id="svg-canvas" class="absolute inset-0 pointer-events-none w-[5000px] h-[5000px]">
				{#each connections as conn (conn.id)}
					{@const p = nodes.find(n => n.id === conn.parentId)}
					{@const c = nodes.find(n => n.id === conn.childId)}
					{#if p && c}
						<line x1={p.x + 60} y1={p.y + 25} x2={c.x + 60} y2={c.y + 25} class="stroke-[#4bc2c4]/40 stroke-[3]" />
					{/if}
				{/each}
			</svg>

			{#each nodes as node (node.id)}
				<div
					use:drag={node.id}
					on:click|stopPropagation={() => selectedNodeId = node.id}
					style="left: {node.x}px; top: {node.y}px;"
					class="node-base absolute z-10 whitespace-nowrap rounded-[40px] border-2 border-white px-8 py-4 font-bold shadow-2xl transition-all duration-300
					{node.type === 'type-central' ? 'bg-[#fde32d] text-[#272b6a] scale-110 border-[#272b6a]' : ''}
					{node.type === 'type-branch' ? 'bg-[#ee4977] text-white' : ''}
					{node.type === 'type-leaf' ? 'bg-[#2ecc71] text-white text-[0.8em]' : ''}
					{selectedNodeId === node.id ? 'ring-8 ring-[#4bc2c4]/50' : ''}"
				>
					{node.name}
					<span on:click|stopPropagation={() => deleteNode(node.id)} class="ml-3 opacity-30 hover:opacity-100 cursor-pointer text-xs">×</span>
				</div>
			{/each}
		</div>
	</div>
	{#if showInfo}
	<div class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/60 backdrop-blur-sm" on:click={toggleInfo}>
		<div class="bg-white w-[90%] max-w-md rounded-2xl p-6 text-[#272b6a] shadow-2xl" on:click|stopPropagation>
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-black uppercase tracking-tighter">How to use ABLE™ Lab</h2>
				<button on:click={toggleInfo} class="text-2xl opacity-50 hover:opacity-100">×</button>
			</div>
			
			<div class="space-y-4 text-left text-sm leading-relaxed">
				<p><strong>1. Think:</strong> Type a concept in the input box and select a type.</p>
				<p><strong>2. Organize:</strong> Click <strong>+ Add</strong> or press <code>Enter</code> to place it on the canvas.</p>
				<p><strong>3. Connect:</strong> Click a node to select it, then add a new node to create a branch.</p>
				<p><strong>4. Navigate:</strong> Use your mouse wheel to <strong>Zoom</strong> and drag the background to <strong>Pan</strong>.</p>
				<p><strong>5. Refine:</strong> Use <code>Delete</code> to remove a node or <strong>Undo</strong> to fix a mistake.</p>
				<div class="pt-2 border-t border-slate-100">
					<p class="mb-3">
						<strong>6. Save:</strong> You can type your name and click <strong>Save</strong> to keep a file of your map on this device for later review.
					</p>
					
					<p>
						<strong>7. Load:</strong> Click <strong>Load</strong> and select your saved file to pick up exactly where you left off!
					</p>
				</div>
			
			</div>
			
			<button on:click={toggleInfo} class="mt-6 w-full py-3 bg-[#272b6a] text-white font-bold rounded-xl active:scale-95 transition-all">
				Let's Map!
			</button>
		</div>
	</div>
	{/if}

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
	:global(body) { margin: 0; overflow: hidden; background: #272b6a; }
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.node-base { cursor: grab; }
	.node-base:active { cursor: grabbing; }
</style>
