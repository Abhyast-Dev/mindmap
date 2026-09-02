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

	// Context menu & Modals
	let contextMenu = $state({ visible: false, x: 0, y: 0, nodeId: null });
	let connectModal = $state({ visible: false, sourceId: null, targetId: '' });
	let manageModal = $state({ visible: false, nodeId: null });

	let mapQuality = $derived.by(() => {
		if (nodes.length === 0) return 0;
		if (nodes.length === 1) return 1; 
		const allConnected = connections.length >= nodes.length - 1;
		if (allConnected && nodes.length > 1) return 3;
		return 2; 
	});

	let thinkingMessage = $derived.by(() => {
		if (nodes.length === 0) return "Ready to begin? Place your first Root Concept to start mapping.";
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
		const oldScale = scale;
		const newScale = Math.min(Math.max(0.2, scale - e.deltaY * zoomFactor), 3);
		
		const container = document.querySelector("#canvas-container");
		if (!container) return;
		const rect = container.getBoundingClientRect();
		const mouseX = e.clientX - rect.left;
		const mouseY = e.clientY - rect.top;

		offsetX = mouseX - (mouseX - offsetX) * (newScale / oldScale);
		offsetY = mouseY - (mouseY - offsetY) * (newScale / oldScale);
		scale = newScale;
	}

	function addNewNode() {
		if (!nodeName.trim()) return alert('Enter concept name');

		if (nodeType === 'type-central' && nodes.some(n => n.type === 'type-central')) {
			return alert('Only one central root allowed.');
		}

		if (nodeType !== 'type-central' && !selectedNodeId) {
			return alert('Select a parent node on the canvas first to attach this branch.');
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
			const radius = 180;
			x = parent ? parent.x + Math.cos(angle) * radius : 2500;
			y = parent ? parent.y + Math.sin(angle) * radius : 2500;
		}

		nodes = [...nodes, { id, name: nodeName.trim(), type: nodeType, x, y }];
		if (selectedNodeId && nodeType !== 'type-central') {
			connections = [...connections, { id: `c-${selectedNodeId}-${id}`, parentId: selectedNodeId, childId: id }];
		}
		nodeName = ''; 
	}

	function convertToLeaf(id) {
		saveHistory();
		nodes = nodes.map(n => n.id === id ? { ...n, type: 'type-leaf' } : n);
		contextMenu.visible = false;
	}

	function openConnectModal(id) {
		contextMenu.visible = false;
		connectModal = { visible: true, sourceId: id, targetId: '' };
	}

	function openManageModal(id) {
		contextMenu.visible = false;
		manageModal = { visible: true, nodeId: id };
	}

	function executeConnection() {
		if (!connectModal.targetId) return alert("Please select a target node to connect.");
		if (connectModal.sourceId === Number(connectModal.targetId)) return alert("A node cannot connect to itself.");

		const exists = connections.some(c => 
			(c.parentId === connectModal.sourceId && c.childId === Number(connectModal.targetId)) ||
			(c.parentId === Number(connectModal.targetId) && c.childId === connectModal.sourceId)
		);

		if (exists) {
			alert("A connection between these nodes already exists.");
			return;
		}

		saveHistory();
		connections = [...connections, {
			id: `c-${connectModal.sourceId}-${connectModal.targetId}`,
			parentId: connectModal.sourceId,
			childId: Number(connectModal.targetId)
		}];
		connectModal.visible = false;
	}

	function removeConnection(connId) {
		saveHistory();
		connections = connections.filter(c => c.id !== connId);
	}

	function removeAllConnectionsForNode(nodeId) {
		saveHistory();
		connections = connections.filter(c => c.parentId !== nodeId && c.childId !== nodeId);
		manageModal.visible = false;
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
			sX = clientX; sY = clientY; iX = node ? node.x : 0; iY = node ? node.y : 0;
			window.addEventListener('mousemove', move);
			window.addEventListener('mouseup', stop);
			window.addEventListener('touchmove', move, { passive: false });
			window.addEventListener('touchend', stop);
		}

		nodeElement.addEventListener('mousedown', start);
		nodeElement.addEventListener('touchstart', start, { passive: false });
		return { destroy() {} };
	}

	// Optimized Dynamic Bounding Box Export
	async function exportPNG() {
		const target = document.querySelector("#canvas-inner");
		if (!target || nodes.length === 0) return alert("Add some nodes to export a mind map!");

		await tick();

		let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
		nodes.forEach(n => {
			if (n.x < minX) minX = n.x;
			if (n.y < minY) minY = n.y;
			if (n.x + 180 > maxX) maxX = n.x + 180;
			if (n.y + 60 > maxY) maxY = n.y + 60;
		});

		const padding = 150;
		const boxX = Math.max(0, minX - padding);
		const boxY = Math.max(0, minY - padding);
		const boxWidth = (maxX - minX) + (padding * 2);
		const boxHeight = (maxY - minY) + (padding * 2);

		domtoimage.toPng(target, {
			width: 5000,
			height: 5000,
			style: {
				transform: 'scale(1)',
				transformOrigin: 'top left',
				backgroundColor: '#fcfcfd',
				left: `-${boxX}px`,
				top: `-${boxY}px`,
				width: `${boxWidth}px`,
				height: `${boxHeight}px`
			}
		})
		.then((dataUrl) => {
			const link = document.createElement('a');
			link.download = `ABLE_${mapTitle || 'MindMap'}_${studentName || 'Student'}.png`;
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
		if (!mapTitle.trim()) return alert("Please enter a Mind Map name before saving.");
		if (!studentName.trim()) return alert("Please enter a student name before saving.");
		
		const key = `ABLE_${mapTitle.trim().toLowerCase()}_${studentName.trim().toLowerCase()}`;
		try {
			localStorage.setItem(key, JSON.stringify({ nodes, connections, mapTitle, studentName }));
			alert("Map Secured Locally!");
		} catch (e) {
			alert("Storage failed. Your browser might be blocking local storage or running out of space.");
			console.error(e);
		}
	}

	function loadFromLocal() {
		if (!mapTitle.trim() || !studentName.trim()) return alert("Enter both Mind Map name and Student Name to load.");
		const key = `ABLE_${mapTitle.trim().toLowerCase()}_${studentName.trim().toLowerCase()}`;
		const saved = localStorage.getItem(key);
		if (saved) {
			try {
				const data = JSON.parse(saved);
				nodes = data.nodes || [];
				connections = data.connections || [];
				alert("Map loaded successfully!");
			} catch { alert("Data Corrupted."); }
		} else alert("No saved map found for this combination.");
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

<div class="flex h-screen flex-col overflow-hidden bg-[#f8fafc] font-sans text-[#272b6a] select-none" on:click={() => { contextMenu.visible = false; }}>

	<!-- Top Navbar -->
	<header class="z-[1001] flex items-center justify-between border-b-4 border-[#ee4977] bg-[#272b6a] px-6 py-3 text-white shrink-0 shadow-xl">
		<div class="flex items-center gap-3">
			<img src="/Logo.png" alt="Abhyast Logo" class="h-9 w-auto object-contain bg-white p-1 rounded-lg shadow-sm" />
			<div class="text-xl font-black tracking-wide text-white flex items-center gap-2">
				<span>ABLE™</span> 
				<span class="text-sm font-bold text-[#4bc2c4] px-2.5 py-1 rounded-lg bg-white/10 border border-white/10">Mind-map Lab</span>
			</div>
		</div>

		<div class="hidden md:flex gap-2 text-base cursor-help items-center bg-[#161942] px-4 py-1.5 rounded-full border border-white/10 shadow-inner" title={thinkingMessage}>
			{#each Array(3) as _, i}
				<span>{i < mapQuality ? '⭐' : '🔘'}</span>
			{/each}
			<span class="text-[0.65em] uppercase font-black ml-2 text-slate-300 tracking-wider">Thinking Level</span>
		</div>

		<div class="flex items-center gap-2">
			<div class="flex bg-[#161942] p-1 rounded-xl border border-white/10">
				<button on:click={undo} class="px-3 py-1 bg-white text-[#272b6a] rounded-lg text-xs font-bold shadow-sm hover:bg-[#ee4977] hover:text-white transition-all">Undo</button>
				<button on:click={redo} class="ml-1 px-3 py-1 bg-white text-[#272b6a] rounded-lg text-xs font-bold shadow-sm hover:bg-[#ee4977] hover:text-white transition-all">Redo</button>
			</div>
			<button on:click={resetView} class="px-3.5 py-1.5 bg-gradient-to-r from-[#272b6a] to-[#4bc2c4] text-white rounded-xl text-xs font-bold shadow-md hover:opacity-95 border border-white/20 transition-all">🎯 Recenter</button>	
			<button on:click={toggleInfo} class="w-7 h-7 flex items-center justify-center bg-white/10 text-white rounded-full border border-white/20 font-serif italic font-bold hover:bg-[#4bc2c4] hover:text-[#272b6a]">i</button>
		</div>
	</header>

	<!-- Action Toolbar -->
	<div class="z-[1000] flex items-center gap-2.5 border-b border-[#4bc2c4]/30 bg-gradient-to-r from-[#272b6a] via-[#1a1d4a] to-[#272b6a] p-3 overflow-x-auto no-scrollbar shrink-0 text-sm shadow-inner text-white">
		<input type="text" bind:value={nodeName} placeholder="Concept name..." class="w-36 bg-[#272b6a]/80 border border-[#4bc2c4]/50 px-3.5 py-2 rounded-xl text-white placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#4bc2c4]" />

		<select bind:value={nodeType} class="bg-[#272b6a]/80 border border-[#4bc2c4]/50 px-3.5 py-2 rounded-xl text-white outline-none focus:ring-2 focus:ring-[#4bc2c4]">
			<option value="type-central">🟡 Root Concept</option>
			<option value="type-branch">🌸 Major Branch</option>
			<option value="type-leaf">🟢 Leaf (Terminal)</option>
		</select>

		<button on:click={addNewNode} class="bg-gradient-to-r from-[#4bc2c4] to-[#272b6a] text-white px-4 py-2 font-bold rounded-xl shadow-md hover:brightness-110 active:scale-95 transition-all">
			+ Add to {selectedNodeId ? nodes.find(n => n.id === selectedNodeId)?.name || 'Parent' : 'Canvas'}
		</button>

		<div class="h-6 w-[1px] bg-white/20 mx-2"></div>

		<input type="text" bind:value={mapTitle} placeholder="Mind Map Name..." class="w-32 bg-[#272b6a]/80 border border-[#4bc2c4]/50 px-3.5 py-2 rounded-xl text-white placeholder-slate-400 outline-none" />
		<input type="text" bind:value={studentName} placeholder="Student Name..." class="w-32 bg-[#272b6a]/80 border border-[#4bc2c4]/50 px-3.5 py-2 rounded-xl text-white placeholder-slate-400 outline-none" />
		<button on:click={saveToLocal} class="bg-gradient-to-r from-[#2ecc71] to-[#272b6a] text-white px-4 py-2 font-bold rounded-xl shadow hover:brightness-105 transition-all">Save</button>
		<button on:click={loadFromLocal} class="bg-white/10 border border-white/20 px-4 py-2 font-bold rounded-xl hover:bg-white/20 transition-all text-white">Load</button>

		<div class="h-6 w-[1px] bg-white/20 mx-2"></div>

		<button on:click={cleanMap} class="bg-gradient-to-r from-[#ee4977]/80 to-red-600 text-white px-3.5 py-2 text-xs font-bold rounded-xl shadow hover:brightness-110 transition-all">Clean Map</button>
		<button on:click={exportPNG} class="bg-gradient-to-r from-[#fde32d] to-amber-400 text-[#272b6a] px-4 py-2 font-black rounded-xl shadow-lg hover:brightness-105 transition-all">PNG Export</button>
	</div>

	<!-- Canvas Area -->
	<div id="canvas-container" 
		class="relative flex-grow overflow-hidden bg-[radial-gradient(#94a3b8_1.5px,transparent_1.5px)] [background-size:35px_35px] cursor-grab active:cursor-grabbing bg-[#fcfcfd]"
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
			class="absolute w-[5000px] h-[5000px] pointer-events-auto bg-[#fcfcfd]"
		>
			<svg id="svg-canvas" class="absolute inset-0 pointer-events-none w-full h-full">
				{#each connections as conn (conn.id)}
					{@const p = nodes.find(n => n.id === conn.parentId)}
					{@const c = nodes.find(n => n.id === conn.childId)}
					{#if p && c}
						{@const isConnectedToActive = (selectedNodeId && (p.id === selectedNodeId || c.id === selectedNodeId))}
						<line 
							x1={p.x + 80} 
							y1={p.y + 25} 
							x2={c.x + 80} 
							y2={c.y + 25} 
							class="stroke-[3.5] transition-all duration-300 {isConnectedToActive ? 'stroke-[#ee4977] opacity-100 stroke-[5]' : 'stroke-[#272b6a] opacity-60'}" 
						/>
					{/if}
				{/each}
			</svg>

			{#each nodes as node (node.id)}
				<div
					use:drag={node.id}
					on:click|stopPropagation={() => selectedNodeId = node.id}
					on:contextmenu|stopPropagation={(e) => {
						e.preventDefault();
						selectedNodeId = node.id;
						contextMenu = { visible: true, x: e.clientX, y: e.clientY, nodeId: node.id };
					}}
					style="left: {node.x}px; top: {node.y}px;"
					class="node-base absolute z-10 whitespace-nowrap rounded-[2rem] border-2 px-6 py-3 font-extrabold shadow-xl transition-all duration-200 cursor-pointer flex items-center gap-3
					{node.type === 'type-central' ? 'bg-gradient-to-r from-[#fde32d] to-amber-300 text-[#272b6a] border-[#272b6a] text-base shadow-[0_10px_25px_rgba(253,227,45,0.5)]' : ''}
					{node.type === 'type-branch' ? 'bg-gradient-to-r from-[#ee4977] to-pink-500 text-white border-[#272b6a]/30 text-sm shadow-[0_10px_25px_rgba(238,73,119,0.4)]' : ''}
					{node.type === 'type-leaf' ? 'bg-gradient-to-r from-[#4bc2c4] to-emerald-400 text-[#272b6a] border-[#272b6a]/30 text-xs shadow-[0_10px_25px_rgba(75,194,196,0.4)]' : ''}
					{selectedNodeId === node.id ? 'ring-4 ring-[#272b6a] ring-offset-2 ring-offset-white scale-105' : ''}"
				>
					<span class="flex flex-col">
						<span class="drop-shadow-sm">{node.name}</span>
						{#if selectedNodeId === node.id}
							<span class="text-[9px] text-[#272b6a] font-black uppercase tracking-wider">Active Parent 🎯</span>
						{/if}
					</span>

					<button on:click|stopPropagation={() => deleteNode(node.id)} class="opacity-70 hover:opacity-100 text-sm font-black px-1.5 py-0.5 rounded-full bg-black/10 hover:bg-black/20 transition-all text-[#272b6a]">×</button>
				</div>
			{/each}
		</div>
	</div>

	<!-- Custom Right-Click Context Menu -->
	{#if contextMenu.visible}
	<div style="top: {contextMenu.y}px; left: {contextMenu.x}px;" class="fixed z-[3000] bg-white border border-slate-200 rounded-2xl shadow-2xl p-2 min-w-[190px] text-[#272b6a]">
		<button on:click={() => openConnectModal(contextMenu.nodeId)} class="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2">
			🔗 Connect to...
		</button>
		<button on:click={() => openManageModal(contextMenu.nodeId)} class="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 text-amber-600">
			✂️ Manage / Remove Links
		</button>
		<button on:click={() => convertToLeaf(contextMenu.nodeId)} class="w-full text-left px-3 py-2 text-xs font-bold rounded-xl hover:bg-slate-100 transition-all flex items-center gap-2 text-[#ee4977]">
			🟢 Convert to Leaf
		</button>
	</div>
	{/if}

	<!-- Connect Modal -->
	{#if connectModal.visible}
	<div class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm" on:click={() => connectModal.visible = false}>
		<div class="bg-white w-[90%] max-w-sm rounded-[2rem] p-6 text-[#272b6a] shadow-2xl" on:click|stopPropagation>
			<h3 class="text-base font-black uppercase mb-4 text-[#272b6a]">Connect Node</h3>
			<p class="text-xs text-slate-500 mb-3">Select another node to connect this concept to:</p>
			
			<select bind:value={connectModal.targetId} class="w-full bg-slate-100 border border-slate-300 p-2.5 text-xs rounded-xl outline-none mb-4 font-semibold">
				<option value="" disabled>Choose target node...</option>
				{#each nodes.filter(n => n.id !== connectModal.sourceId) as n}
					<option value={n.id}>{n.name} ({n.type.replace('type-', '')})</option>
				{/each}
			</select>

			<div class="flex gap-2">
				<button on:click={executeConnection} class="flex-1 py-2.5 bg-[#272b6a] text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md hover:brightness-110">Link Nodes</button>
				<button on:click={() => connectModal.visible = false} class="px-4 py-2.5 bg-slate-200 text-[#272b6a] font-bold rounded-xl text-xs">Cancel</button>
			</div>
		</div>
	</div>
	{/if}

	<!-- Manage Links Modal -->
	{#if manageModal.visible}
	<div class="fixed inset-0 z-[3000] flex items-center justify-center bg-black/70 backdrop-blur-sm" on:click={() => manageModal.visible = false}>
		<div class="bg-white w-[90%] max-w-md rounded-[2.5rem] p-6 text-[#272b6a] shadow-2xl" on:click|stopPropagation>
			<h3 class="text-base font-black uppercase mb-2 text-[#272b6a]">Manage Connections</h3>
			<p class="text-xs text-slate-500 mb-4">Remove individual links or clear all connections for this node:</p>
			
			<div class="max-h-48 overflow-y-auto space-y-2 mb-4">
				{#each connections.filter(c => c.parentId === manageModal.nodeId || c.childId === manageModal.nodeId) as conn}
					{@const otherId = conn.parentId === manageModal.nodeId ? conn.childId : conn.parentId}
					{@const otherNode = nodes.find(n => n.id === otherId)}
					<div class="flex items-center justify-between bg-slate-100 px-3 py-2 rounded-xl text-xs">
						<span class="font-bold">{otherNode ? otherNode.name : 'Unknown Node'}</span>
						<button on:click={() => removeConnection(conn.id)} class="text-red-500 font-bold px-2 py-1 bg-white rounded-lg shadow-sm hover:bg-red-500 hover:text-white transition-all">Remove</button>
					</div>
				{:else}
					<p class="text-xs text-slate-400 italic text-center py-4">No active connections found for this node.</p>
				{/each}
			</div>

			<div class="flex flex-col gap-2">
				<button on:click={() => removeAllConnectionsForNode(manageModal.nodeId)} class="w-full py-2.5 bg-red-600 text-white font-black rounded-xl text-xs uppercase tracking-wider shadow-md hover:brightness-110">
					Disconnect All Links
				</button>
				<button on:click={() => manageModal.visible = false} class="w-full py-2.5 bg-slate-200 text-[#272b6a] font-bold rounded-xl text-xs">Close</button>
			</div>
		</div>
	</div>
	{/if}

	<!-- Info Modal -->
	{#if showInfo}
	<div class="fixed inset-0 z-[2000] flex items-center justify-center bg-black/70 backdrop-blur-sm" on:click={toggleInfo}>
		<div class="bg-white w-[90%] max-w-md rounded-[2.5rem] p-8 text-[#272b6a] shadow-2xl border-4 border-[#ee4977]/20" on:click|stopPropagation>
			<div class="flex justify-between items-center mb-4">
				<h2 class="text-xl font-black uppercase tracking-tight text-[#272b6a]">ABLE™ Mind-map Guide</h2>
				<button on:click={toggleInfo} class="text-2xl opacity-50 hover:opacity-100 text-[#ee4977]">×</button>
			</div>

			<div class="space-y-3 text-left text-xs leading-relaxed text-slate-600">
				<p><strong>1. Right-Click Context Menu:</strong> Right-click any node to open options for connecting, managing links, or converting it to a leaf.</p>
				<p><strong>2. Manage/Remove Links:</strong> Select "Manage / Remove Links" to selectively delete individual connecting pathways or click "Disconnect All Links" to clear everything attached to that node.</p>
				<p><strong>3. PWA Naming:</strong> Save and load your mind maps seamlessly using both the Map Name and Student Name combination.</p>
			</div>

			<button on:click={toggleInfo} class="mt-6 w-full py-3.5 bg-gradient-to-r from-[#272b6a] to-[#4bc2c4] text-white font-black rounded-2xl active:scale-95 transition-all text-xs uppercase tracking-wider shadow-lg">
				Got it, let's map! ✨
			</button>
		</div>
	</div>
	{/if}

	<!-- Footer -->
	<footer class="z-[1001] border-t-2 border-[#4bc2c4]/40 bg-[#1e2254] p-3.5 text-[0.8em] print:hidden flex flex-col sm:flex-row justify-between items-center px-6 gap-2 text-white font-semibold">
		<div class="flex gap-6 items-center">
			<span>📧 <a href="mailto:contact@abhyast.in" class="font-bold text-[#4bc2c4] hover:text-[#fde32d] no-underline hover:underline transition-colors">contact@abhyast.in</a></span>
			<span>💬 <a href="https://wa.me/+919910686080" class="font-bold text-[#4bc2c4] hover:text-[#fde32d] no-underline hover:underline transition-colors">WhatsApp Support</a></span>
		</div>
		<div class="text-white text-center tracking-wide font-bold">
			© 2026 Abhyast Private Limited. ABLE™ Mind-map Lab.
		</div>
	</footer>
</div>

<style>
	:global(body) { margin: 0; overflow: hidden; background: #fcfcfd; }
	.no-scrollbar::-webkit-scrollbar { display: none; }
	.node-base { cursor: grab; }
	.node-base:active { cursor: grabbing; }
</style>