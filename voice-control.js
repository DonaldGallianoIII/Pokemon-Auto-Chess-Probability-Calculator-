/**
 * PAC Analytics Voice Control System
 * Single unified voice interface - top right placement
 */

(function() {
    'use strict';
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('⚠️ Speech recognition not supported');
        return;
    }
    
    // Config
    const config = {
        language: 'en-US',
        continuous: false,
        interimResults: true,
        confidenceThreshold: 0.6,
        pushToTalkKey: ' '
    };
    
    // State
    let recognition = null;
    let isListening = false;
    let startTime = 0;
    let timerInterval = null;
    let commandHistory = [];
    
    // UI Elements
    let container, button, timer, status, transcript;
    
    /**
     * Initialize
     */
    function init() {
        if (!window.calculatorState) {
            setTimeout(init, 500);
            return;
        }
        
        setupRecognition();
        createUI();
        setupEvents();
        
        console.log('🎤 Voice Control ready - Press SPACE to speak');
    }
    
    /**
     * Setup Recognition
     */
    function setupRecognition() {
        recognition = new SpeechRecognition();
        recognition.lang = config.language;
        recognition.continuous = false;
        recognition.interimResults = true;
        
        recognition.onstart = onStart;
        recognition.onresult = onResult;
        recognition.onerror = onError;
        recognition.onend = onEnd;
    }
    
    /**
     * Create UI
     */
    function createUI() {
        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            #voice-container {
                position: fixed;
                top: 80px;
                right: 2rem;
                z-index: 999;
                width: 280px;
            }
            
            #voice-card {
                background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98));
                border: 1px solid rgba(239, 68, 68, 0.3);
                border-radius: 1.5rem;
                padding: 1.5rem;
                backdrop-filter: blur(10px);
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            }
            
            #voice-btn {
                width: 100%;
                padding: 1.25rem;
                background: linear-gradient(135deg, #ef4444, #dc2626);
                border: 3px solid #991b1b;
                border-radius: 1rem;
                color: white;
                font-weight: 800;
                font-size: 1.125rem;
                cursor: pointer;
                transition: all 0.15s;
                box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4);
            }
            
            #voice-btn:hover {
                background: linear-gradient(135deg, #f87171, #ef4444);
                transform: translateY(-2px);
            }
            
            #voice-btn.listening {
                background: linear-gradient(135deg, #22c55e, #16a34a);
                border-color: #166534;
                animation: pulse 1.5s infinite;
            }
            
            @keyframes pulse {
                0%, 100% { box-shadow: 0 4px 20px rgba(34, 197, 94, 0.6); }
                50% { box-shadow: 0 4px 32px rgba(34, 197, 94, 1), 0 0 40px rgba(34, 197, 94, 0.4); }
            }
            
            #voice-timer {
                text-align: center;
                margin-top: 0.75rem;
                font-size: 1.5rem;
                font-weight: 700;
                color: #38bdf8;
                font-variant-numeric: tabular-nums;
            }
            
            #voice-timer.active {
                color: #22c55e;
            }
            
            #voice-status {
                text-align: center;
                margin-top: 0.5rem;
                font-size: 0.875rem;
                color: #64748b;
                font-weight: 600;
            }
            
            #voice-status.active { color: #22c55e; }
            #voice-status.error { color: #ef4444; }
            
            #voice-transcript {
                margin-top: 1rem;
                padding: 0.75rem;
                background: rgba(0, 0, 0, 0.3);
                border-radius: 0.75rem;
                font-size: 0.875rem;
                color: #94a3b8;
                min-height: 2rem;
                max-height: 0;
                overflow: hidden;
                opacity: 0;
                transition: all 0.3s;
            }
            
            #voice-transcript.visible {
                max-height: 200px;
                opacity: 1;
            }
            
            #voice-help {
                margin-top: 1rem;
                padding-top: 1rem;
                border-top: 1px solid rgba(239, 68, 68, 0.2);
                font-size: 0.75rem;
                color: #64748b;
                line-height: 1.5;
            }
            
            @media (max-width: 768px) {
                #voice-container {
                    position: relative;
                    top: auto;
                    right: auto;
                    width: 100%;
                    margin-bottom: 1rem;
                }
            }
        `;
        document.head.appendChild(style);
        
        // Create container
        container = document.createElement('div');
        container.id = 'voice-container';
        
        const card = document.createElement('div');
        card.id = 'voice-card';
        
        // Button
        button = document.createElement('button');
        button.id = 'voice-btn';
        button.innerHTML = '🎤 VOICE ACTIVATION';
        
        // Timer
        timer = document.createElement('div');
        timer.id = 'voice-timer';
        timer.textContent = '0:00';
        
        // Status
        status = document.createElement('div');
        status.id = 'voice-status';
        status.textContent = 'Ready';
        
        // Transcript
        transcript = document.createElement('div');
        transcript.id = 'voice-transcript';
        
        // Help
        const help = document.createElement('div');
        help.id = 'voice-help';
        help.innerHTML = `
            <div style="color: #ef4444; font-weight: 700; margin-bottom: 0.5rem;">QUICK COMMANDS:</div>
            <div>• "level 7 rare have 3"</div>
            <div>• "scouted 4"</div>
            <div>• "bench 5"</div>
            <div style="margin-top: 0.5rem;">Hold SPACE or click button</div>
        `;
        
        card.appendChild(button);
        card.appendChild(timer);
        card.appendChild(status);
        card.appendChild(transcript);
        card.appendChild(help);
        container.appendChild(card);
        document.body.appendChild(container);
    }
    
    /**
     * Setup Events
     */
    function setupEvents() {
        button.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startListening();
        });
        
        button.addEventListener('mouseup', stopListening);
        button.addEventListener('mouseleave', () => {
            if (isListening) stopListening();
        });
        
        document.addEventListener('keydown', (e) => {
            if (e.key === ' ' && !e.repeat && !isInputFocused()) {
                e.preventDefault();
                startListening();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === ' ' && isListening) {
                e.preventDefault();
                stopListening();
            }
        });
    }
    
    function isInputFocused() {
        const el = document.activeElement;
        return el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT');
    }
    
    /**
     * Start/Stop
     */
    function startListening() {
        if (isListening) return;
        try {
            recognition.start();
            isListening = true;
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 100);
        } catch (err) {
            console.error('Start failed:', err);
        }
    }
    
    function stopListening() {
        if (!isListening) return;
        try {
            recognition.stop();
            clearInterval(timerInterval);
        } catch (err) {
            console.error('Stop failed:', err);
        }
    }
    
    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Recognition Handlers
     */
    function onStart() {
        button.classList.add('listening');
        timer.classList.add('active');
        status.classList.add('active');
        status.textContent = '🔴 Listening...';
        transcript.classList.add('visible');
        transcript.textContent = 'Listening...';
    }
    
    function onResult(event) {
        const result = event.results[event.results.length - 1];
        const text = result[0].transcript.trim();
        const isFinal = result.isFinal;
        const confidence = result[0].confidence;
        
        transcript.textContent = text + (isFinal ? '' : '...');
        
        if (isFinal) {
            button.classList.remove('listening');
            status.textContent = 'Processing...';
            processCommand(text, confidence);
        }
    }
    
    function onError(event) {
        console.error('Recognition error:', event.error);
        status.classList.add('error');
        status.textContent = 'Error: ' + event.error;
        setTimeout(resetUI, 2000);
    }
    
    function onEnd() {
        isListening = false;
        button.classList.remove('listening');
        timer.classList.remove('active');
        status.classList.remove('active');
        clearInterval(timerInterval);
        timer.textContent = '0:00';
        setTimeout(() => {
            if (!isListening) {
                transcript.classList.remove('visible');
                resetUI();
            }
        }, 3000);
    }
    
    function resetUI() {
        status.classList.remove('error');
        status.textContent = 'Ready';
    }
    
    /**
     * Process Command
     */
    function processCommand(text, confidence) {
        console.log(`🎤 "${text}" (${(confidence * 100).toFixed(1)}%)`);
        
        if (confidence < config.confidenceThreshold) {
            transcript.innerHTML = '<span style="color: #f59e0b;">⚠️ Low confidence</span>';
            status.textContent = 'Try again?';
            return;
        }
        
        const commands = parseCommand(text);
        
        if (commands.length === 0) {
            transcript.innerHTML = '<span style="color: #ef4444;">❌ Unknown command</span>';
            status.textContent = 'Unknown';
            return;
        }
        
        commands.forEach(cmd => executeCommand(cmd));
        
        commandHistory.unshift({ text, commands, time: Date.now() });
        if (commandHistory.length > 10) commandHistory.pop();
        
        const feedback = commands.map(c => c.feedback).join(', ');
        transcript.innerHTML = `<span style="color: #22c55e;">✓ ${feedback}</span>`;
        status.textContent = 'Done';
        status.style.color = '#22c55e';
    }
    
    /**
     * Parse Command - Natural Language
     */
    function parseCommand(text) {
        const commands = [];
        const original = text.toLowerCase();
        const allNumbers = original.match(/\d+/g)?.map(n => parseInt(n)) || [];
        let availableNumbers = [...allNumbers];
        
        console.log(`📝 "${original}" → Numbers: [${availableNumbers}]`);
        
        // LEVEL
        if (/level|lvl|lv\b/i.test(original)) {
            if (/up/i.test(original)) {
                commands.push({ type: 'level', value: 'up', feedback: 'Level up' });
            } else if (/down/i.test(original)) {
                commands.push({ type: 'level', value: 'down', feedback: 'Level down' });
            } else {
                const levelMatch = original.match(/(?:level|lvl|lv)\s*(\d+)|(\d+)\s*(?:level|lvl)/i);
                const levelNum = levelMatch ? parseInt(levelMatch[1] || levelMatch[2]) : availableNumbers.find(n => n >= 1 && n <= 9);
                
                if (levelNum && levelNum >= 1 && levelNum <= 9) {
                    commands.push({ type: 'level', value: levelNum, feedback: `Level ${levelNum}` });
                    const idx = availableNumbers.indexOf(levelNum);
                    if (idx !== -1) availableNumbers.splice(idx, 1);
                }
            }
        } else if (availableNumbers.length === 1 && availableNumbers[0] >= 1 && availableNumbers[0] <= 9) {
            if (!/(own|have|got|scout|bench|refresh|star|copies)/i.test(original)) {
                commands.push({ type: 'level', value: availableNumbers[0], feedback: `Level ${availableNumbers[0]}` });
                availableNumbers = [];
            }
        } else if (availableNumbers.length > 0 && availableNumbers[0] >= 1 && availableNumbers[0] <= 9) {
            const beforeNum = original.split(availableNumbers[0])[0];
            if (!/(own|have|got|scout|bench|refresh)/i.test(beforeNum)) {
                commands.push({ type: 'level', value: availableNumbers[0], feedback: `Level ${availableNumbers[0]}` });
                availableNumbers.shift();
            }
        }
        
        // RARITY
        const rarities = {
            'common': 'common', 'uncommon': 'uncommon', 'uc': 'uncommon', 'green': 'uncommon',
            'rare': 'rare', 'blue': 'rare',
            'epic': 'epic', 'purple': 'epic',
            'ultra': 'ultra', 'legendary': 'ultra', 'red': 'ultra'
        };
        for (const [key, val] of Object.entries(rarities)) {
            if (new RegExp(`\\b${key}\\b`, 'i').test(original)) {
                commands.push({ type: 'rarity', value: val, feedback: val });
                break;
            }
        }
        
        // EVOLUTION
        if (/(two|2)\s*(star|\*)/i.test(original)) {
            commands.push({ type: 'evolution', value: 'twoStar', feedback: '2★' });
        } else if (/(three|3)\s*(star|\*)/i.test(original)) {
            commands.push({ type: 'evolution', value: 'threeStar', feedback: '3★' });
        }
        
        // COPIES OWNED
        const ownMatch = original.match(/(own|have|got|holding)\s*(\d+)|(\d+)\s*(own|have|got|copies|owned)/i);
        if (ownMatch && !/(scout|bench|seen|taken)/i.test(original)) {
            const num = parseInt(ownMatch[2] || ownMatch[3]);
            commands.push({ type: 'copies', value: num, feedback: `Own ${num}` });
            const idx = availableNumbers.indexOf(num);
            if (idx !== -1) availableNumbers.splice(idx, 1);
        }
        
        // SCOUTING
        const scoutMatch = original.match(/(scout|scouted|seen|taken|opponent)\s*(\d+)|(\d+)\s*(scout|scouted|seen|taken)/i);
        if (scoutMatch) {
            const num = parseInt(scoutMatch[2] || scoutMatch[3]);
            commands.push({ type: 'scouting', value: num, feedback: `Scout ${num}` });
            const idx = availableNumbers.indexOf(num);
            if (idx !== -1) availableNumbers.splice(idx, 1);
        }
        
        // BENCH
        const benchMatch = original.match(/bench\w*\s*(\d+)|(\d+)\s*(?:on\s*)?bench/i);
        if (benchMatch) {
            const num = parseInt(benchMatch[1] || benchMatch[2]);
            commands.push({ type: 'bench', value: num, feedback: `Bench ${num}` });
            const idx = availableNumbers.indexOf(num);
            if (idx !== -1) availableNumbers.splice(idx, 1);
        }
        
        // DITTO
        if (/(add|enable|with)\s*ditto/i.test(original)) {
            commands.push({ type: 'ditto', value: true, feedback: 'Ditto on' });
        } else if (/(remove|disable|without)\s*ditto/i.test(original)) {
            commands.push({ type: 'ditto', value: false, feedback: 'Ditto off' });
        }
        
        // REFRESHES
        const refreshMatch = original.match(/(\d+)\s*(?:refresh|roll|check)|(?:refresh|check)\s*(\d+)/i);
        if (refreshMatch) {
            const num = parseInt(refreshMatch[1] || refreshMatch[2]);
            commands.push({ type: 'refreshes', value: num, feedback: `${num} refreshes` });
        }
        
        // QUERY
        if (/(what|tell|read).*(odd|probability)/i.test(original)) {
            commands.push({ type: 'query', feedback: 'Reading odds' });
        }
        
        // CLEAR
        if (/(clear|reset)/i.test(original)) {
            commands.push({ type: 'clear', feedback: 'Cleared' });
        }
        
        console.log(`✅ Commands: ${commands.map(c => c.feedback).join(', ') || 'none'}`);
        return commands;
    }
    
    /**
     * Execute Command
     */
    function executeCommand(cmd) {
        const state = window.calculatorState;
        if (!state) return;
        
        switch (cmd.type) {
            case 'level':
                const lvl = cmd.value === 'up' ? Math.min(9, state.level + 1) :
                           cmd.value === 'down' ? Math.max(1, state.level - 1) : cmd.value;
                simSelect(0, lvl);
                break;
            case 'rarity':
                simSelect(1, cmd.value);
                break;
            case 'evolution':
                simSelect(2, cmd.value);
                break;
            case 'copies':
                simInput('copies owned', cmd.value);
                break;
            case 'scouting':
                simInput('scouting', cmd.value);
                break;
            case 'bench':
                simInput('bench', cmd.value);
                break;
            case 'ditto':
                simCheckbox('ditto', cmd.value);
                break;
            case 'refreshes':
                simInput('refreshes', cmd.value);
                break;
            case 'clear':
                const btn = Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Clear All'));
                if (btn) btn.click();
                break;
        }
    }
    
    function simSelect(index, value) {
        const sel = document.querySelectorAll('select')[index];
        if (sel) {
            sel.value = value;
            sel.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    
    function simInput(hint, value) {
        const inputs = document.querySelectorAll('input[type="number"]');
        let target = null;
        
        if (hint === 'copies owned') {
            target = Array.from(inputs).find(i => i.closest('div')?.querySelector('label')?.textContent.includes('Copies You Have'));
        } else if (hint === 'scouting') {
            target = Array.from(inputs).find(i => i.closest('.bg-gradient-to-br')?.querySelector('h2')?.textContent.includes('Scouting'));
        } else if (hint === 'bench') {
            target = Array.from(inputs).find(i => i.closest('.bg-gradient-to-br')?.querySelector('h2')?.textContent.includes('Bench'));
        } else if (hint === 'refreshes') {
            target = Array.from(inputs).find(i => i.closest('div')?.querySelector('label')?.textContent.includes('Refreshes'));
        }
        
        if (target) {
            target.value = value;
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    
    function simCheckbox(hint, checked) {
        const cbs = document.querySelectorAll('input[type="checkbox"]');
        const target = Array.from(cbs).find(cb => cb.parentElement?.textContent.toLowerCase().includes(hint));
        if (target && target.checked !== checked) target.click();
    }
    
    // Expose API
    window.voiceControl = {
        startListening,
        stopListening,
        isListening: () => isListening,
        getHistory: () => commandHistory,
        test: (text) => {
            const cmds = parseCommand(text);
            cmds.forEach(executeCommand);
            return cmds;
        }
    };
    
    // Init
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }
    
    console.log('✓ Voice Control loaded');
})();
