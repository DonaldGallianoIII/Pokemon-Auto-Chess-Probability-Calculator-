/**
 * PAC Analytics Voice Control System
 * Single unified voice interface - top right placement
 * 
 * v5 PATCHES:
 * - CHUNK-BASED PARSING: Order doesn't matter, "pve on scouting 4 copy 2" all works
 * - Added "wild target" / "target wild" / "target is wild"
 * - Fixed "copy 4" (was only "copies")
 * - Expanded ditto/pve patterns (include, exclude, use, no)
 * - All previous fixes included
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
        confidenceThreshold: 0.35,
        pushToTalkKey: ' '
    };
    
    // State
    let recognition = null;
    let isListening = false;
    let startTime = 0;
    let timerInterval = null;
    let commandHistory = [];
    let fullTranscript = '';
    let lastConfidence = 0.9;
    
    // UI Elements
    let container, button, timer, status, transcript;
    
    /**
     * Word to Number Conversion
     */
    const wordToNum = {
        'zero': '0', 'one': '1', 'two': '2', 'three': '3', 'four': '4',
        'five': '5', 'six': '6', 'seven': '7', 'eight': '8', 'nine': '9',
        'ten': '10', 'eleven': '11', 'twelve': '12', 'thirteen': '13',
        'fourteen': '14', 'fifteen': '15', 'sixteen': '16', 'seventeen': '17',
        'eighteen': '18', 'nineteen': '19', 'twenty': '20',
        'to': '2', 'too': '2'
    };
    
    function convertWordsToNumbers(text) {
        let result = text.toLowerCase();
        const sortedWords = Object.keys(wordToNum).sort((a, b) => b.length - a.length);
        for (const word of sortedWords) {
            result = result.replace(new RegExp(`\\b${word}\\b`, 'g'), wordToNum[word]);
        }
        return result;
    }
    
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
        
        console.log('🎤 Voice Control v5 ready - Press SPACE to speak');
    }
    
    /**
     * Setup Recognition
     */
    function setupRecognition() {
        recognition = new SpeechRecognition();
        recognition.lang = config.language;
        recognition.continuous = true;
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
        
        container = document.createElement('div');
        container.id = 'voice-container';
        
        const card = document.createElement('div');
        card.id = 'voice-card';
        
        button = document.createElement('button');
        button.id = 'voice-btn';
        button.innerHTML = '🎤 HOLD TO SPEAK';
        
        timer = document.createElement('div');
        timer.id = 'voice-timer';
        timer.textContent = '0:00';
        
        status = document.createElement('div');
        status.id = 'voice-status';
        status.textContent = 'Ready';
        
        transcript = document.createElement('div');
        transcript.id = 'voice-transcript';
        
        const help = document.createElement('div');
        help.id = 'voice-help';
        help.innerHTML = `
            <div style="color: #ef4444; font-weight: 700; margin-bottom: 0.5rem;">QUICK COMMANDS:</div>
            <div>• "level 7 rare copy 3"</div>
            <div>• "scouted 4 bench 5"</div>
            <div>• "ditto on pve round"</div>
            <div>• "wild target"</div>
            <div style="margin-top: 0.5rem;">Hold SPACE or hold button</div>
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
        
        window.addEventListener('keydown', (e) => {
            if (e.key === ' ' && !isInputFocused()) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (!e.repeat && !isListening) {
                    startListening();
                }
            }
        }, { capture: true });
        
        window.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                if (isListening) {
                    stopListening();
                }
            }
        }, { capture: true });
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
            fullTranscript = '';
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
        let interimTranscript = '';
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const result = event.results[i];
            const text = result[0].transcript;
            
            if (result.isFinal) {
                finalTranscript += text + ' ';
                lastConfidence = result[0].confidence;
            } else {
                interimTranscript += text;
            }
        }
        
        if (finalTranscript) {
            fullTranscript += finalTranscript;
        }
        
        const display = (fullTranscript + interimTranscript).trim();
        transcript.textContent = display + (interimTranscript ? '...' : '');
        
        console.log(`🎤 Accumulated: "${fullTranscript.trim()}" | Interim: "${interimTranscript}"`);
    }
    
    function onError(event) {
        console.error('Recognition error:', event.error);
        
        if (event.error === 'no-speech') {
            status.textContent = 'No speech detected';
            return;
        }
        
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
        
        const finalText = fullTranscript.trim();
        if (finalText) {
            status.textContent = 'Processing...';
            processCommand(finalText, lastConfidence);
        } else {
            status.textContent = 'No input';
        }
        
        fullTranscript = '';
        
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
        const converted = convertWordsToNumbers(text);
        console.log(`🎤 Original: "${text}" → Converted: "${converted}" (${(confidence * 100).toFixed(1)}%)`);
        
        if (confidence < config.confidenceThreshold) {
            transcript.innerHTML = `<span style="color: #f59e0b;">⚠️ Low confidence: "${text}"</span>`;
            status.textContent = 'Try again?';
            return;
        }
        
        const commands = parseCommand(converted);
        
        if (commands.length === 0) {
            transcript.innerHTML = `<span style="color: #ef4444;">❌ Unknown: "${text}"</span>`;
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
     * CHUNK-BASED PARSER v5
     * Tokenizes input and processes chunks independently
     */
    function parseCommand(text) {
        const commands = [];
        const original = text.toLowerCase().trim();
        const tokens = original.split(/\s+/);
        
        console.log(`📝 Parsing tokens: [${tokens.join(', ')}]`);
        
        // Track which tokens have been consumed
        const consumed = new Array(tokens.length).fill(false);
        
        // === TOGGLE COMMANDS (keyword + on/off) ===
        const toggles = {
            'ditto': { 
                onWords: ['on', 'enable', 'enabled', 'add', 'include', 'use', 'with', 'yes'],
                offWords: ['off', 'disable', 'disabled', 'remove', 'exclude', 'no', 'without'],
                type: 'ditto'
            },
            'pve': {
                onWords: ['on', 'enable', 'enabled', 'add', 'include', 'use', 'round', 'yes'],
                offWords: ['off', 'disable', 'disabled', 'remove', 'exclude', 'no'],
                type: 'pve'
            }
        };
        
        for (let i = 0; i < tokens.length; i++) {
            if (consumed[i]) continue;
            const token = tokens[i];
            
            for (const [keyword, config] of Object.entries(toggles)) {
                if (token === keyword) {
                    // Check word before
                    if (i > 0 && !consumed[i-1]) {
                        if (config.onWords.includes(tokens[i-1])) {
                            commands.push({ type: config.type, value: true, feedback: `${keyword} on` });
                            consumed[i] = consumed[i-1] = true;
                            break;
                        }
                        if (config.offWords.includes(tokens[i-1])) {
                            commands.push({ type: config.type, value: false, feedback: `${keyword} off` });
                            consumed[i] = consumed[i-1] = true;
                            break;
                        }
                    }
                    // Check word after
                    if (i < tokens.length - 1 && !consumed[i+1]) {
                        if (config.onWords.includes(tokens[i+1])) {
                            commands.push({ type: config.type, value: true, feedback: `${keyword} on` });
                            consumed[i] = consumed[i+1] = true;
                            break;
                        }
                        if (config.offWords.includes(tokens[i+1])) {
                            commands.push({ type: config.type, value: false, feedback: `${keyword} off` });
                            consumed[i] = consumed[i+1] = true;
                            break;
                        }
                    }
                }
            }
        }
        
        // === WILD TARGET ===
        for (let i = 0; i < tokens.length; i++) {
            if (consumed[i]) continue;
            
            // "wild target" or "target wild" or "wild"
            if (tokens[i] === 'wild') {
                commands.push({ type: 'wild', value: true, feedback: 'Wild target' });
                consumed[i] = true;
                // Also consume "target" if adjacent
                if (i > 0 && tokens[i-1] === 'target' && !consumed[i-1]) consumed[i-1] = true;
                if (i < tokens.length - 1 && tokens[i+1] === 'target' && !consumed[i+1]) consumed[i+1] = true;
            }
            // "target is wild"
            if (tokens[i] === 'target' && tokens[i+1] === 'is' && tokens[i+2] === 'wild') {
                commands.push({ type: 'wild', value: true, feedback: 'Wild target' });
                consumed[i] = consumed[i+1] = consumed[i+2] = true;
            }
        }
        
        // === KEYWORD + NUMBER COMMANDS ===
        const numberCommands = {
            'level': { type: 'level', feedback: n => `Level ${n}`, validate: n => n >= 1 && n <= 9 },
            'lvl': { type: 'level', feedback: n => `Level ${n}`, validate: n => n >= 1 && n <= 9 },
            'lv': { type: 'level', feedback: n => `Level ${n}`, validate: n => n >= 1 && n <= 9 },
            'scout': { type: 'scouting', feedback: n => `Scout ${n}` },
            'scouted': { type: 'scouting', feedback: n => `Scout ${n}` },
            'scouting': { type: 'scouting', feedback: n => `Scout ${n}` },
            'seen': { type: 'scouting', feedback: n => `Scout ${n}` },
            'taken': { type: 'scouting', feedback: n => `Scout ${n}` },
            'opponent': { type: 'scouting', feedback: n => `Scout ${n}` },
            'bench': { type: 'bench', feedback: n => `Bench ${n}` },
            'benched': { type: 'bench', feedback: n => `Bench ${n}` },
            'copy': { type: 'copies', feedback: n => `Own ${n}` },
            'copies': { type: 'copies', feedback: n => `Own ${n}` },
            'have': { type: 'copies', feedback: n => `Own ${n}` },
            'own': { type: 'copies', feedback: n => `Own ${n}` },
            'got': { type: 'copies', feedback: n => `Own ${n}` },
            'holding': { type: 'copies', feedback: n => `Own ${n}` },
            'refresh': { type: 'refreshes', feedback: n => `${n} refreshes` },
            'refreshes': { type: 'refreshes', feedback: n => `${n} refreshes` },
            'roll': { type: 'refreshes', feedback: n => `${n} refreshes` },
            'rolls': { type: 'refreshes', feedback: n => `${n} refreshes` }
        };
        
        for (let i = 0; i < tokens.length; i++) {
            if (consumed[i]) continue;
            const token = tokens[i];
            
            if (numberCommands[token]) {
                const cmd = numberCommands[token];
                let num = null;
                let numIndex = -1;
                
                // Look for number AFTER keyword first (preferred)
                for (let j = i + 1; j < Math.min(i + 3, tokens.length); j++) {
                    if (consumed[j]) continue;
                    const n = parseInt(tokens[j]);
                    if (!isNaN(n)) {
                        num = n;
                        numIndex = j;
                        break;
                    }
                }
                
                // Fall back to number BEFORE keyword
                if (num === null && i > 0) {
                    for (let j = i - 1; j >= Math.max(0, i - 2); j--) {
                        if (consumed[j]) continue;
                        const n = parseInt(tokens[j]);
                        if (!isNaN(n)) {
                            num = n;
                            numIndex = j;
                            break;
                        }
                    }
                }
                
                if (num !== null) {
                    // Validate if needed
                    if (!cmd.validate || cmd.validate(num)) {
                        commands.push({ type: cmd.type, value: num, feedback: cmd.feedback(num) });
                        consumed[i] = true;
                        consumed[numIndex] = true;
                    }
                }
            }
        }
        
        // === RARITY (standalone keywords) ===
        const rarities = {
            'common': 'common',
            'uncommon': 'uncommon', 'uc': 'uncommon', 'green': 'uncommon',
            'rare': 'rare', 'blue': 'rare',
            'epic': 'epic', 'purple': 'epic',
            'ultra': 'ultra', 'legendary': 'ultra', 'red': 'ultra'
        };
        
        for (let i = 0; i < tokens.length; i++) {
            if (consumed[i]) continue;
            if (rarities[tokens[i]]) {
                commands.push({ type: 'rarity', value: rarities[tokens[i]], feedback: rarities[tokens[i]] });
                consumed[i] = true;
                break; // Only one rarity
            }
        }
        
        // === EVOLUTION (N star) ===
        for (let i = 0; i < tokens.length - 1; i++) {
            if (consumed[i] || consumed[i+1]) continue;
            const n = parseInt(tokens[i]);
            if ((n === 2 || n === 3) && (tokens[i+1] === 'star' || tokens[i+1] === 'stars')) {
                const evo = n === 2 ? 'twoStar' : 'threeStar';
                commands.push({ type: 'evolution', value: evo, feedback: `${n}★` });
                consumed[i] = consumed[i+1] = true;
            }
        }
        
        // === LEVEL UP/DOWN ===
        if (/level\s*up/i.test(original)) {
            commands.push({ type: 'level', value: 'up', feedback: 'Level up' });
        }
        if (/level\s*down/i.test(original)) {
            commands.push({ type: 'level', value: 'down', feedback: 'Level down' });
        }
        
        // === CLEAR/RESET ===
        for (let i = 0; i < tokens.length; i++) {
            if (consumed[i]) continue;
            if (tokens[i] === 'clear' || tokens[i] === 'reset') {
                commands.push({ type: 'clear', feedback: 'Cleared' });
                consumed[i] = true;
                break;
            }
        }
        
        // === ORPHAN NUMBER = LEVEL (if nothing else matched) ===
        if (commands.length === 0) {
            for (let i = 0; i < tokens.length; i++) {
                const n = parseInt(tokens[i]);
                if (!isNaN(n) && n >= 1 && n <= 9) {
                    commands.push({ type: 'level', value: n, feedback: `Level ${n}` });
                    break;
                }
            }
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
        
        console.log(`⚡ Executing: ${cmd.type} = ${cmd.value}`);
        
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
            case 'pve':
                simCheckbox('pve', cmd.value);
                break;
            case 'wild':
                simCheckbox('wild', cmd.value);
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
            console.log(`📋 Select[${index}] → ${value}`);
        }
    }
    
    function simInput(hint, value) {
        const inputs = document.querySelectorAll('input[type="number"]');
        let target = null;
        
        if (hint === 'copies owned') {
            target = Array.from(inputs).find(i => {
                const label = i.closest('div')?.querySelector('label')?.textContent || '';
                return /copies|have|own/i.test(label);
            });
        } else if (hint === 'scouting') {
            target = Array.from(inputs).find(i => {
                const section = i.closest('.bg-gradient-to-br')?.querySelector('h2')?.textContent || '';
                const label = i.closest('div')?.querySelector('label')?.textContent || '';
                return /scout/i.test(section) || /scout|seen|taken/i.test(label);
            });
        } else if (hint === 'bench') {
            target = Array.from(inputs).find(i => {
                const section = i.closest('.bg-gradient-to-br')?.querySelector('h2')?.textContent || '';
                const label = i.closest('div')?.querySelector('label')?.textContent || '';
                return /bench/i.test(section) || /bench/i.test(label);
            });
        } else if (hint === 'refreshes') {
            target = Array.from(inputs).find(i => {
                const label = i.closest('div')?.querySelector('label')?.textContent || '';
                return /refresh|roll/i.test(label);
            });
        }
        
        if (target) {
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
            nativeInputValueSetter.call(target, value);
            target.dispatchEvent(new Event('input', { bubbles: true }));
            target.dispatchEvent(new Event('change', { bubbles: true }));
            console.log(`📝 Input[${hint}] → ${value}`);
        } else {
            console.warn(`⚠️ Input not found: ${hint}`);
        }
    }
    
    function simCheckbox(hint, checked) {
        const cbs = document.querySelectorAll('input[type="checkbox"]');
        const target = Array.from(cbs).find(cb => {
            const text = cb.closest('label')?.textContent?.toLowerCase() || 
                        cb.parentElement?.textContent?.toLowerCase() || '';
            return text.includes(hint);
        });
        
        if (target) {
            if (target.checked !== checked) {
                target.click();
                console.log(`☑️ Checkbox[${hint}] → ${checked}`);
            } else {
                console.log(`☑️ Checkbox[${hint}] already ${checked}`);
            }
        } else {
            console.warn(`⚠️ Checkbox not found: ${hint}`);
        }
    }
    
    // Expose API
    window.voiceControl = {
        startListening,
        stopListening,
        isListening: () => isListening,
        getHistory: () => commandHistory,
        test: (text) => {
            const converted = convertWordsToNumbers(text);
            console.log(`Test: "${text}" → "${converted}"`);
            const cmds = parseCommand(converted);
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
    
    console.log('✓ Voice Control v5 loaded');
})();
