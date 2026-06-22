(function () {
    'use strict';

    // Master Engine Core State
    let engine = {
        runId: '',
        personality: {},
        levelSequence: [],
        currentStep: 0,
        startTime: null,
        levelTimer: null,
        totalLevelsCleared: 0,
        konamiProgress: 0,
        activeLevelInstance: null
    };

    // Configuration Archetypes Matrix
    const PERSONALITIES = {
        CALM: { id: 'CALM', delayMod: 1.0, fontStyle: 'normal', waitTxt: ["Patience.", "Stay steady.", "Almost there."] },
        CHAOTIC: { id: 'CHAOTIC', delayMod: 0.4, fontStyle: 'italic', waitTxt: ["HOLD ON!", "SYSTEM JUMPING!", "QUICKLY!"] },
        CREEPY: { id: 'CREEPY', delayMod: 1.7, fontStyle: 'normal', waitTxt: ["It watches.", "Do not breathe.", "Quiet now."] },
        FUNNY: { id: 'FUNNY', delayMod: 0.8, fontStyle: 'normal', waitTxt: ["Reticulating splines...", "Locating escape hatch...", "Generating micro-transactions..."] },
        SMART: { id: 'SMART', delayMod: 1.2, fontStyle: 'normal', waitTxt: ["Analyze the structural void.", "Quantum sequencing.", "Calculate node vectors."] }
    };

    const ENDINGS = [
        "You escaped.", "You almost escaped.", "Nobody escapes.",
        "Try tomorrow.", "Good enough.", "Again?", "You never entered."
    ];

    // Core Level Engine Definition Pool (30 Modular Micro-Levels with Pointer Event support)
    const LEVEL_POOL = {
        DOUBLE_CLICK: {
            prompt: "Proceed via alternative validation.",
            init: (box, s) => {
                const btn = createButton("CONTINUE");
                let clicks = 0;
                btn.onpointerdown = (e) => {
                    e.preventDefault();
                    clicks++;
                    if (clicks === 1) btn.innerText = s.id === 'FUNNY' ? "Rude. Retry." : "Verify link.";
                    if (clicks === 2) advanceRun();
                };
                box.appendChild(btn);
            }
        },
        WAIT: {
            prompt: "Stand completely still.",
            init: (box, s) => {
                const txt = document.createElement('p');
                txt.innerText = s.waitTxt[0];
                box.appendChild(txt);
                let step = 0;
                const ticker = setInterval(() => {
                    step++;
                    if (step === 1) txt.innerText = s.waitTxt[1] || s.waitTxt[0];
                    if (step === 2) txt.innerText = s.waitTxt[2] || s.waitTxt[0];
                    if (step >= 3) { clearInterval(ticker); advanceRun(); }
                }, 1300 * s.delayMod);
                engine.activeLevelInstance = { cleanup: () => clearInterval(ticker) };
            }
        },
        INVISIBLE: {
            prompt: "Drag across terminal to scan blind spots.",
            init: (box) => {
                const btn = createButton("EXIT INTERFACE");
                btn.style.opacity = '0';
                btn.style.position = 'absolute';
                box.appendChild(btn);

                // Proximity engine to allow detection via touch dragging / mouse moving
                const trackProximity = (e) => {
                    const rect = btn.getBoundingClientRect();
                    const bx = rect.left + rect.width / 2;
                    const by = rect.top + rect.height / 2;
                    const dist = Math.hypot(e.clientX - bx, e.clientY - by);
                    if (dist < 160) {
                        btn.style.opacity = ((160 - dist) / 160).toFixed(2);
                    } else {
                        btn.style.opacity = '0';
                    }
                };

                window.addEventListener('pointermove', trackProximity);
                btn.onpointerdown = () => advanceRun();
                
                engine.activeLevelInstance = { 
                    cleanup: () => window.removeEventListener('pointermove', trackProximity) 
                };
            }
        },
        FOLLOW: {
            prompt: "Let the interface guide you.",
            init: (box) => {
                const btn = createButton("TARGET NODE");
                btn.style.position = 'absolute';
                const pointerMoveHandler = (e) => {
                    const rect = box.getBoundingClientRect();
                    const mx = e.clientX - rect.left;
                    const my = e.clientY - rect.top;
                    if (mx > 0 && mx < rect.width && my > 0 && my < rect.height) {
                        btn.style.left = `${mx - btn.offsetWidth / 2}px`;
                        btn.style.top = `${my - btn.offsetHeight / 2}px`;
                    }
                };
                window.addEventListener('pointermove', pointerMoveHandler);
                btn.onpointerdown = () => advanceRun();
                box.appendChild(btn);
                engine.activeLevelInstance = { cleanup: () => window.removeEventListener('pointermove', pointerMoveHandler) };
            }
        },
        DONT_CLICK: {
            prompt: "Do absolutely nothing.",
            init: (box) => {
                const p = document.createElement('p');
                p.innerText = "Do not engage.";
                box.appendChild(p);
                let time = 0;
                const loop = setInterval(() => {
                    time++;
                    if (time >= 4) { clearInterval(loop); advanceRun(); }
                }, 1000);
                
                const penaltyReset = (e) => {
                    if (e.target.id === 'error-dismiss' || e.target.id === 'mobile-reset-anchor') return;
                    time = 0; 
                    p.innerText = "Interference detected. Reset.";
                    setTimeout(() => { p.innerText = "Do not engage."; }, 600);
                };
                window.addEventListener('pointerdown', penaltyReset);
                engine.activeLevelInstance = {
                    cleanup: () => { clearInterval(loop); window.removeEventListener('pointerdown', penaltyReset); }
                };
            }
        },
        WRONG: {
            prompt: "Select correct route.",
            init: (box) => {
                const wrapper = document.createElement('div');
                wrapper.className = "btn-row";
                let target = Math.floor(Math.random() * 3);
                for(let i=0; i<3; i++) {
                    const b = createButton(`PATH ${String.fromCharCode(65+i)}`);
                    b.onpointerdown = (e) => {
                        e.preventDefault();
                        if (i === target) advanceRun();
                        else {
                            e.target.style.borderColor = '#111';
                            e.target.style.color = '#222';
                            target = Math.floor(Math.random() * 3);
                        }
                    };
                    wrapper.appendChild(b);
                }
                box.appendChild(wrapper);
            }
        },
        SMALL: {
            prompt: "Focus completely.",
            init: (box) => {
                const btn = createButton("");
                btn.style.width = '8px'; btn.style.height = '8px'; btn.style.padding = '0';
                btn.style.background = '#fff'; btn.style.border = 'none';
                btn.onpointerdown = () => advanceRun();
                box.appendChild(btn);
            }
        },
        HUGE: {
            prompt: "Unmissable validation.",
            init: (box) => {
                const btn = createButton("SUBMIT DATA SEED");
                btn.style.width = '100%'; btn.style.height = '100%'; btn.style.fontSize = '1.5rem';
                btn.onpointerdown = () => advanceRun();
                box.appendChild(btn);
            }
        },
        MOVE: {
            prompt: "Tap to capture vector.",
            init: (box) => {
                const btn = createButton("EXIT HERE");
                btn.style.position = 'absolute';
                let escapes = 0;
                
                const shiftAway = (e) => {
                    e.preventDefault();
                    if (escapes < 4) {
                        btn.style.left = `${Math.random() * 60 + 10}%`;
                        btn.style.top = `${Math.random() * 60 + 10}%`;
                        escapes++;
                    } else {
                        advanceRun();
                    }
                };
                btn.onpointerdown = shiftAway;
                box.appendChild(btn);
            }
        },
        DARK: {
            prompt: "Commit coordinate to memory.",
            init: (box) => {
                const btn = createButton("CONFIRM EXIT LINK");
                box.appendChild(btn);
                btn.onpointerdown = () => advanceRun();
                const timeout = setTimeout(() => { box.style.opacity = '0'; }, 900);
                engine.activeLevelInstance = { cleanup: () => { clearTimeout(timeout); box.style.opacity = '1'; } };
            }
        },
        LOOK: {
            prompt: "Hold contact node to decrypt.",
            init: (box) => {
                const btn = createButton("ENGAGE SECURE HOLD");
                box.appendChild(btn);
                let count = 0, active = false, ticker = null;
                
                const startHold = (e) => {
                    e.preventDefault();
                    if (active) return;
                    active = true;
                    ticker = setInterval(() => {
                        count++;
                        btn.innerText = `DECRYPTING (${Math.floor(count * 33.4)}%)`;
                        if (count >= 3) { clearInterval(ticker); advanceRun(); }
                    }, 600);
                };
                
                const breakHold = () => { active = false; clearInterval(ticker); btn.innerText = "ENGAGE SECURE HOLD"; count = 0; };
                
                btn.onpointerdown = startHold;
                btn.onpointerup = breakHold;
                btn.onpointerleave = breakHold;
                engine.activeLevelInstance = { cleanup: () => clearInterval(ticker) };
            }
        },
        REVERSE: {
            prompt: "Invert processing guidelines.",
            init: (box) => {
                const btn = createButton("ABORT RUN ENVIRONMENT");
                btn.onpointerdown = () => advanceRun();
                box.appendChild(btn);
            }
        },
        COUNT: {
            prompt: "Strike exactly five times.",
            init: (box) => {
                const btn = createButton("0 HITS");
                let c = 0;
                btn.onpointerdown = (e) => {
                    e.preventDefault();
                    c++;
                    btn.innerText = `${c} HITS`;
                    if (c === 5) advanceRun();
                    else if (c > 5) { c = 0; btn.innerText = "0 HITS"; }
                };
                box.appendChild(btn);
            }
        },
        PATTERN: {
            prompt: "Mirror uniform rhythm gaps.",
            init: (box) => {
                const btn = createButton("TAP EQUAL CADENCE");
                box.appendChild(btn);
                let logs = [];
                btn.onpointerdown = (e) => {
                    e.preventDefault();
                    logs.push(Date.now());
                    if(logs.length === 3) {
                        let spanA = logs[1] - logs[0];
                        let spanB = logs[2] - logs[1];
                        if (Math.abs(spanA - spanB) < 280) advanceRun();
                        else { logs = []; btn.innerText = "DESYNC. RETRY."; }
                    }
                };
            }
        },
        NOTHING: {
            prompt: "Void block detected.",
            init: () => {
                const timer = setTimeout(() => advanceRun(), 2500);
                engine.activeLevelInstance = { cleanup: () => clearTimeout(timer) };
            }
        },
        BACK: {
            prompt: "Execute recursion pipeline.",
            init: (box) => {
                const btn = createButton("<-- RETREAT DIRECTIVE");
                btn.onpointerdown = () => advanceRun();
                box.appendChild(btn);
            }
        },
        TRUST: {
            prompt: "Bypass standard confirmation layers.",
            init: (box) => {
                const p = document.createElement('p');
                p.innerText = "System containment secure. No exits present.";
                p.style.cursor = 'pointer';
                p.style.padding = '20px';
                p.onpointerdown = () => advanceRun();
                box.appendChild(p);
            }
        },
        FAKE_WIN: {
            prompt: "",
            init: (box) => {
                const container = document.createElement('div');
                container.innerHTML = `<h2 style='margin-bottom:10px; font-weight:300;'>REALITY PURGED</h2><p class='text-muted' style='font-size:0.75rem; margin-bottom:20px;'>Execution complete.</p>`;
                const b = createButton("RELOAD APPARATUS");
                b.onpointerdown = () => advanceRun();
                container.appendChild(b);
                box.appendChild(container);
            }
        },
        CLOSE: {
            prompt: "Terminate operational interface layout.",
            init: (box) => {
                const frame = document.createElement('div');
                frame.style.position = 'absolute'; frame.style.top = '10px'; frame.style.right = '10px';
                const b = createButton("[X]");
                b.onpointerdown = () => advanceRun();
                frame.appendChild(b);
                box.appendChild(frame);
            }
        },
        SILENCE: {
            prompt: "Maintain structural stasis.",
            init: (box) => {
                const p = document.createElement('p'); p.innerText = "Frozen line..."; box.appendChild(p);
                let lockTimer;
                const updateStasis = () => {
                    clearTimeout(lockTimer);
                    lockTimer = setTimeout(() => advanceRun(), 2000);
                };
                window.addEventListener('pointermove', updateStasis);
                updateStasis();
                engine.activeLevelInstance = { cleanup: () => { clearTimeout(lockTimer); window.removeEventListener('pointermove', updateStasis); } };
            }
        },
        COPY: {
            prompt: "Input required target sequence.",
            init: (box) => {
                // Mobile Safe Version: Replaced pure hardware keyboard layout with dynamic sequence keys
                const wrapper = document.createElement('div');
                wrapper.className = "btn-row";
                const p = document.createElement('p'); p.innerText = "Tap Code Sequence: N -> O\n"; p.style.width="100%"; p.style.marginBottom="10px";
                box.appendChild(p);
                let chain = "";
                ['N', 'O'].forEach(char => {
                    const b = createButton(char);
                    b.onpointerdown = (e) => {
                        e.preventDefault();
                        chain += char;
                        if (chain === "NO") advanceRun();
                        else if (!"NO".startsWith(chain)) { chain = ""; p.innerText = "INVALID SEQUENCE. RESET."; }
                    };
                    wrapper.appendChild(b);
                });
                box.appendChild(wrapper);
            }
        },
        TIME: {
            prompt: "Temporal stability failure imminent.",
            init: (box) => {
                const b = createButton("DISARM IMMEDIATELY");
                box.appendChild(b);
                b.onpointerdown = () => advanceRun();
                let clockMetric = 100;
                const clockLoop = setInterval(() => {
                    clockMetric -= 5;
                    b.innerText = `DISARM (${clockMetric}ms)`;
                    if(clockMetric <= 0) {
                        clearInterval(clockLoop);
                        clockMetric = 100;
                        b.innerText = "EXPIRED. RECYCLING SYSTEM FRAME.";
                    }
                }, 100);
                engine.activeLevelInstance = { cleanup: () => clearInterval(clockLoop) };
            }
        },
        IGNORE: {
            prompt: "Isolate distraction parameters.",
            init: (box) => {
                const trap = createButton("CONFIRM ADVANCEMENT");
                trap.onpointerdown = () => { trap.innerText = "PROCESSING DENIED"; };
                box.appendChild(trap);

                const stealthTrigger = document.createElement('div');
                stealthTrigger.style.width = '15px'; stealthTrigger.style.height = '15px'; stealthTrigger.style.background = '#050505';
                stealthTrigger.style.position = 'absolute'; stealthTrigger.style.bottom = '5px'; stealthTrigger.style.left = '5px';
                stealthTrigger.onpointerdown = (e) => { e.stopPropagation(); advanceRun(); };
                box.appendChild(stealthTrigger);
            }
        },
        FAST: {
            prompt: "Await synchronization flash.",
            init: (box) => {
                const b = createButton("LOCKED LINK");
                b.style.borderColor = '#111'; b.style.color = '#222';
                box.appendChild(b);
                const randomizedDelay = Math.random() * 1400 + 1000;
                let activeTrigger = false;
                const atomicTimer = setTimeout(() => {
                    activeTrigger = true;
                    b.innerText = "ENGAGE NOW";
                    b.style.borderColor = '#fff'; b.style.color = '#fff';
                }, randomizedDelay);

                b.onpointerdown = () => { if (activeTrigger) advanceRun(); };
                engine.activeLevelInstance = { cleanup: () => clearTimeout(atomicTimer) };
            }
        },
        SLOW: {
            prompt: "Approach node at low velocity.",
            init: (box) => {
                const b = createButton("DEPRESS DELIBERATELY");
                box.appendChild(b);
                let trackingCoordinates = null, currentSpeed = 999;
                const monitorSpeed = (e) => {
                    if (trackingCoordinates) {
                        currentSpeed = Math.hypot(e.clientX - trackingCoordinates.x, e.clientY - trackingCoordinates.y);
                    }
                    trackingCoordinates = { x: e.clientX, y: e.clientY };
                };
                window.addEventListener('pointermove', monitorSpeed);
                b.onpointerdown = () => {
                    if (currentSpeed < 5) advanceRun();
                    else b.innerText = "VELOCITY OVER BOUNDS";
                };
                engine.activeLevelInstance = { cleanup: () => window.removeEventListener('pointermove', monitorSpeed) };
            }
        },
        GLITCH: {
            prompt: "Isolate structurally coherent data shards.",
            init: (box) => {
                const displayNode = document.createElement('div');
                displayNode.style.letterSpacing = '8px';
                displayNode.innerHTML = "<span>▜</span><span>▒</span><span id='exit-vector' style='cursor:pointer; color:#fff; font-weight:bold; padding:10px;'>X</span><span>▚</span><span>▓</span>";
                box.appendChild(displayNode);
                document.getElementById('exit-vector').onpointerdown = () => advanceRun();
            }
        },
        MIRROR: {
            prompt: "Map operational inverted balances.",
            init: (box) => {
                const wrapper = document.createElement('div');
                wrapper.className = "btn-row";
                const leftPivot = createButton("PORT SHARD");
                const rightPivot = createButton("STARBOARD SHARD");
                wrapper.appendChild(leftPivot); wrapper.appendChild(rightPivot); box.appendChild(wrapper);

                leftPivot.onpointerdown = () => { rightPivot.style.background = '#fff'; setTimeout(() => advanceRun(), 400); };
                rightPivot.onpointerdown = () => { leftPivot.style.background = '#fff'; rightPivot.style.background = 'none'; };
            }
        },
        HOLD: {
            prompt: "Maintain sustained interface pressure.",
            init: (box) => {
                const b = createButton("PRESS & HOLD (0s)");
                box.appendChild(b);
                let holdDuration = 0, operationalLoop = null;
                const activateLoad = (e) => {
                    e.preventDefault();
                    operationalLoop = setInterval(() => {
                        holdDuration++;
                        b.innerText = `PRESS & HOLD (${holdDuration}s)`;
                        if (holdDuration >= 3) { clearInterval(operationalLoop); advanceRun(); }
                    }, 1000);
                };
                const interruptLoad = () => { clearInterval(operationalLoop); holdDuration = 0; b.innerText = "PRESS & HOLD (0s)"; };
                b.onpointerdown = activateLoad; b.onpointerup = interruptLoad; b.onpointerleave = interruptLoad;
                engine.activeLevelInstance = { cleanup: () => clearInterval(operationalLoop) };
            }
        },
        SHIFT: {
            prompt: "Tap the background matrix to force stability updates.",
            init: (box) => {
                // Mobile Safe Version: Replaced hardware key detection with background taps
                const b = createButton("STABILIZE");
                b.style.position = 'absolute';
                box.appendChild(b);
                const shiftPosition = () => {
                    b.style.left = `${Math.random() * 50 + 15}%`;
                    b.style.top = `${Math.random() * 50 + 15}%`;
                };
                box.addEventListener('pointerdown', shiftPosition);
                b.onpointerdown = (e) => { e.stopPropagation(); advanceRun(); };
                engine.activeLevelInstance = { cleanup: () => box.removeEventListener('pointerdown', shiftPosition) };
            }
        },
        GRID: {
            prompt: "Identify execution discrepancy.",
            init: (box) => {
                const gridMatrix = document.createElement('div');
                gridMatrix.className = "grid-container";
                const varianceIndex = Math.floor(Math.random() * 9);
                for(let i=0; i<9; i++) {
                    const blockCell = document.createElement('div');
                    blockCell.className = "grid-cell";
                    if (i === varianceIndex) {
                        blockCell.style.backgroundColor = "#040404"; // Subtle visual offset shade
                        blockCell.onpointerdown = () => advanceRun();
                    } else {
                        blockCell.onpointerdown = () => { blockCell.style.borderColor = '#111'; };
                    }
                    gridMatrix.appendChild(blockCell);
                }
                box.appendChild(gridMatrix);
            }
        }
    };

    // --- Core Architecture Engine Methods ---

    function init() {
        setupGlobalEvents();
        generateContextRun();
    }

    function setupGlobalEvents() {
        document.getElementById('btn-enter').addEventListener('click', runIntroSequence);
        document.getElementById('btn-mutate').addEventListener('click', () => {
            generateContextRun();
            switchView('screen-game');
            runProceduralLoop();
        });
        document.getElementById('error-dismiss').addEventListener('click', hideFakeError);
        document.getElementById('mobile-reset-anchor').addEventListener('click', regenerateActiveReality);

        document.addEventListener('keydown', (e) => {
            const parsedKey = e.key.toLowerCase();
            if (parsedKey === 'r') {
                e.preventDefault();
                regenerateActiveReality();
            }
            
            // Konami code bypass sequence listener logic
            const targetTrack = ["arrowup", "arrowup", "arrowdown", "arrowdown", "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a"];
            if (parsedKey === targetTrack[engine.konamiProgress]) {
                engine.konamiProgress++;
                if (engine.konamiProgress === targetTrack.length) {
                    engine.konamiProgress = 0;
                    advanceRun();
                }
            } else {
                engine.konamiProgress = 0;
            }
        });
    }

    function generateContextRun() {
        const structuralSegments = [
            "SYS",
            Math.floor(Math.random() * 8999 + 1000),
            String.fromCharCode(65 + Math.floor(Math.random() * 26)) + String.fromCharCode(65 + Math.floor(Math.random() * 26))
        ];
        engine.runId = structuralSegments.join('-');

        const structuralKeys = Object.keys(PERSONALITIES);
        engine.personality = PERSONALITIES[structuralKeys[Math.floor(Math.random() * structuralKeys.length)]];

        const sequenceDepth = Math.floor(Math.random() * 5) + 8; // Random loop length from 8 to 12 variations
        const indexPool = Object.keys(LEVEL_POOL);
        const algorithmicSymmetryShuffle = indexPool.sort(() => 0.5 - Math.random());
        
        engine.levelSequence = algorithmicSymmetryShuffle.slice(0, sequenceDepth);
        engine.currentStep = 0;
        engine.totalLevelsCleared = 0;
        engine.startTime = Date.now();

        document.getElementById('run-id-display').innerText = `RUN: ${engine.runId}`;
        const identityTagNode = document.getElementById('personality-display');
        identityTagNode.innerText = engine.personality.id;
        identityTagNode.className = `tag ${engine.personality.id.toLowerCase()}`;

        buildHUDDots(sequenceDepth);
    }

    function buildHUDDots(totalElementsCount) {
        const HUDDotsBox = document.getElementById('level-dots');
        HUDDotsBox.innerHTML = '';
        for (let i = 0; i < totalElementsCount; i++) {
            const indicatorDot = document.createElement('div');
            indicatorDot.className = 'dot';
            HUDDotsBox.appendChild(indicatorDot);
        }
    }

    function updateHUDProgress() {
        const dotNodesCollection = document.getElementById('level-dots').children;
        for (let i = 0; i < dotNodesCollection.length; i++) {
            if (i < engine.currentStep) dotNodesCollection[i].className = 'dot passed';
            else if (i === engine.currentStep) dotNodesCollection[i].className = 'dot active';
            else dotNodesCollection[i].className = 'dot';
        }
    }

    function runIntroSequence() {
        const initializationTriggerButton = document.getElementById('btn-enter');
        const activeMicroSpinnerLoader = document.getElementById('intro-loader');
        initializationTriggerButton.classList.add('hidden');
        activeMicroSpinnerLoader.classList.remove('hidden');

        setTimeout(() => {
            activeMicroSpinnerLoader.classList.add('hidden');
            initializationTriggerButton.classList.remove('hidden');
            
            document.getElementById('hud').classList.remove('hidden');
            switchView('screen-game');
            runProceduralLoop();
        }, 1100);
    }

    function runProceduralLoop() {
        if (engine.activeLevelInstance && engine.activeLevelInstance.cleanup) {
            engine.activeLevelInstance.cleanup();
        }
        clearGlobalEnvironmentalEffects();

        if (engine.currentStep >= engine.levelSequence.length) {
            terminateActiveRunMatrix();
            return;
        }

        updateHUDProgress();

        const executionSandboxLayer = document.getElementById('sandbox');
        executionSandboxLayer.innerHTML = '';
        
        const runtimeActiveLevelKey = engine.levelSequence[engine.currentStep];
        const instantiatedLevelMetadata = LEVEL_POOL[runtimeActiveLevelKey];

        const textAnnouncerHeading = document.getElementById('level-announcer');
        textAnnouncerHeading.style.opacity = '0';
        
        setTimeout(() => {
            textAnnouncerHeading.innerText = instantiatedLevelMetadata.prompt;
            textAnnouncerHeading.style.fontStyle = engine.personality.fontStyle;
            textAnnouncerHeading.style.opacity = '1';
            
            instantiatedLevelMetadata.init(executionSandboxLayer, engine.personality);

            if (Math.random() < 0.20) { // 20% validation anomaly chance routing
                triggerProceduralAnomalousEvent();
            }
        }, 150);

        if (engine.levelTimer) clearInterval(engine.levelTimer);
        engine.levelTimer = setInterval(() => {
            const calculatedDurationSeconds = Math.floor((Date.now() - engine.startTime) / 1000);
            const formattingMinutes = Math.floor(calculatedDurationSeconds / 60).toString().padStart(2, '0');
            const formattingSeconds = (calculatedDurationSeconds % 60).toString().padStart(2, '0');
            document.getElementById('live-timer').innerText = `${formattingMinutes}:${formattingSeconds}`;
        }, 1000);
    }

    function advanceRun() {
        engine.totalLevelsCleared++;
        engine.currentStep++;
        runProceduralLoop();
    }

    function regenerateActiveReality() {
        if (engine.activeLevelInstance && engine.activeLevelInstance.cleanup) {
            engine.activeLevelInstance.cleanup();
        }
        generateContextRun();
        runProceduralLoop();
    }

    function triggerProceduralAnomalousEvent() {
        const collectionAnomalies = ['SHAKE', 'CORRUPT', 'INVERT', 'FAKE_ERR'];
        const chosenAnomalousModifier = collectionAnomalies[Math.floor(Math.random() * collectionAnomalies.length)];
        const systemRootContainer = document.body;

        if (chosenAnomalousModifier === 'SHAKE') systemRootContainer.classList.add('evt-shake');
        if (chosenAnomalousModifier === 'CORRUPT') systemRootContainer.classList.add('evt-corrupt');
        if (chosenAnomalousModifier === 'INVERT') systemRootContainer.classList.add('evt-invert');
        if (chosenAnomalousModifier === 'FAKE_ERR') triggerSystemDialogWarningModal();
    }

    function clearGlobalEnvironmentalEffects() {
        const systemRootContainer = document.body;
        systemRootContainer.classList.remove('evt-shake', 'evt-corrupt', 'evt-invert');
        hideFakeError();
    }

    function triggerSystemDialogWarningModal() {
        const modalFrameBox = document.getElementById('fake-error-box');
        const internalDynamicTextNode = document.getElementById('error-dynamic-text');
        const structuralDivergencesLogsPool = [
            "Containment failure inside procedural runtime generation loop.",
            "Memory address verification index returned structural discrepancy.",
            "Reality calculation metrics boundary overflow."
        ];
        internalDynamicTextNode.innerText = structuralDivergencesLogsPool[Math.floor(Math.random() * structuralDivergencesLogsPool.length)];
        
        modalFrameBox.style.left = `${Math.random() * 20 + 15}%`;
        modalFrameBox.style.top = `${Math.random() * 20 + 25}%`;
        modalFrameBox.classList.remove('hidden');
    }

    function hideFakeError() {
        document.getElementById('fake-error-box').classList.add('hidden');
    }

    function terminateActiveRunMatrix() {
        clearInterval(engine.levelTimer);
        document.getElementById('hud').classList.add('hidden');

        const finalDurationSeconds = Math.floor((Date.now() - engine.startTime) / 1000);
        const metricsFinalMinutes = Math.floor(finalDurationSeconds / 60).toString().padStart(2, '0');
        const metricsFinalSeconds = (finalDurationSeconds % 60).toString().padStart(2, '0');

        document.getElementById('outro-heading').innerText = ENDINGS[Math.floor(Math.random() * ENDINGS.length)].toUpperCase();
        
        document.getElementById('summary-id').innerText = engine.runId;
        document.getElementById('summary-trait').innerText = engine.personality.id;
        document.getElementById('summary-stages').innerText = engine.totalLevelsCleared;
        document.getElementById('summary-time').innerText = `${metricsFinalMinutes}:${metricsFinalSeconds}`;

        switchView('screen-outro');
    }

    // --- Helper Utilities Matrix Layout Handlers ---

    function createButton(textLabelString) {
        const buttonNode = document.createElement('button');
        buttonNode.className = "ui-btn";
        buttonNode.innerText = textLabelString;
        return buttonNode;
    }

    function switchView(targetScreenIdentifierString) {
        const collectionViews = document.querySelectorAll('.view');
        collectionViews.forEach(viewNode => viewNode.classList.remove('active'));
        document.getElementById(targetScreenIdentifierString).classList.add('active');
    }

    window.addEventListener('DOMContentLoaded', init);

})();