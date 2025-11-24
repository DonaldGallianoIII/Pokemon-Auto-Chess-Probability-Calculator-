/**
 * PAC Analytics Voice Control System
 * Enables hands-free calculator operation during gameplay
 * 
 * Usage: Press and hold spacebar (or click mic button) to speak commands
 */

(function() {
    'use strict';
    
    // Check for browser support
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.warn('⚠️ Speech recognition not supported in this browser');
        return;
    }
    
    // Configuration
    const config = {
        language: 'en-US',
        continuous: false,
        interimResults: true,
        maxAlternatives: 1,
        pushToTalkKey: ' ', // Spacebar
        audioFeedback: false,
        confidenceThreshold: 0.6
    };
    
    // State
    let recognition = null;
    let isListening = false;
    let isPushToTalkActive = false;
    let commandHistory = [];
    let startTime = 0;
    let timerInterval = null;
    
    // UI Elements
    let container = null;
    let voiceButton = null;
    let timerDisplay = null;
    let statusDisplay = null;
    let transcriptDisplay = null;
    
    /**
     * Initialize voice control system
     */
    function init() {
        if (!window.calculatorState) {
            console.log('⏳ Waiting for calculator to initialize...');
            setTimeout(init, 500);
            return;
        }
        
        setupRecognition();
        createUI();
        setupEventListeners();
        
        console.log('🎤 Voice Control initialized');
        console.log('   → Press and hold SPACEBAR to speak');
        console.log('   → Or click/hold the microphone button');
    }
    
    /**
     * Setup Speech Recognition
     */
    function setupRecognition() {
        recognition = new SpeechRecognition();
        recognition.lang = config.language;
        recognition.continuous = config.continuous;
        recognition.interimResults = config.interimResults;
        recognition.maxAlternatives = config.maxAlternatives;
        
        recognition.onstart = handleRecognitionStart;
        recognition.onresult = handleRecognitionResult;
        recognition.onerror = handleRecognitionError;
        recognition.onend = handleRecognitionEnd;
    }
    
    /**
     * Create Voice Control UI - TOP RIGHT
     */
    function createUI() {
        // Main container - TOP RIGHT
        container = document.createElement('div');
        container.id = 'voice-control-container';
        container.style.cssText = `
            position: fixed;
            top: 80px;
            right: 2rem;
            z-index: 999;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 0.75rem;
            width: 280px;
        `;
        
        // Voice button with timer/status overlay
        const buttonCard = document.createElement('div');
        buttonCard.style.cssText = `
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98));
            border: 1px solid rgba(239, 68, 68, 0.3);
            border-radius: 1.5rem;
            padding: 1.5rem;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            width: 100%;
        `;
        
        // Button
        voiceButton = document.createElement('button');
        voiceButton.innerHTML = '🎤 VOICE ACTIVATION';
        voiceButton.style.cssText = `
            width: 100%;
            padding: 1.25rem;
            background: linear-gradient(135deg, #ef4444, #dc2626);
            border: 3px solid #991b1b;
            border-radius: 1rem;
            color: white;
            font-weight: 800;
            font-size: 1.125rem;
            letter-spacing: 0.05em;
            cursor: pointer;
            transition: all 0.15s;
            box-shadow: 0 4px 20px rgba(239, 68, 68, 0.4),
                        inset 0 2px 4px rgba(255, 255, 255, 0.2);
            text-shadow: 0 2px 4px rgba(0, 0, 0, 0.5);
        `;
        
        // Timer
        timerDisplay = document.createElement('div');
        timerDisplay.textContent = '0:00';
        timerDisplay.style.cssText = `
            text-align: center;
            margin-top: 0.75rem;
            font-size: 1.5rem;
            font-weight: 700;
            color: #38bdf8;
            font-variant-numeric: tabular-nums;
            letter-spacing: 0.1em;
            text-shadow: 0 0 10px rgba(56, 189, 248, 0.5);
        `;
        
        // Status
        statusDisplay = document.createElement('div');
        statusDisplay.textContent = 'Ready';
        statusDisplay.style.cssText = `
            text-align: center;
            margin-top: 0.5rem;
            font-size: 0.875rem;
            color: #64748b;
            font-weight: 600;
        `;
        
        // Transcript (collapsible)
        transcriptDisplay = document.createElement('div');
        transcriptDisplay.style.cssText = `
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
        `;
        
        // Quick help
        const helpText = document.createElement('div');
        helpText.style.cssText = `
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid rgba(239, 68, 68, 0.2);
            font-size: 0.75rem;
            color: #64748b;
            line-height: 1.4;
        `;
        helpText.innerHTML = `
            <div style="color: #ef4444; font-weight: 700; margin-bottom: 0.5rem;">QUICK COMMANDS:</div>
            <div>• "level 7 rare have 3"</div>
            <div>• "scouted 4"</div>
            <div>• "bench 5"</div>
            <div>• "add ditto"</div>
            <div style="margin-top: 0.5rem; color: #475569;">
                Hold <span style="background: rgba(239,68,68,0.2); padding: 0.125rem 0.375rem; border-radius: 0.25rem; font-family: monospace; color: #fca5a5;">SPACE</span> or click button
            </div>
        `;
        
        buttonCard.appendChild(voiceButton);
        buttonCard.appendChild(timerDisplay);
        buttonCard.appendChild(statusDisplay);
        buttonCard.appendChild(transcriptDisplay);
        buttonCard.appendChild(helpText);
        container.appendChild(buttonCard);
        document.body.appendChild(container);
        
        // Styles
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse-glow {
                0%, 100% {
                    box-shadow: 0 4px 20px rgba(34, 197, 94, 0.6),
                                inset 0 2px 4px rgba(255, 255, 255, 0.2);
                }
                50% {
                    box-shadow: 0 4px 32px rgba(34, 197, 94, 1),
                                0 0 40px rgba(34, 197, 94, 0.4),
                                inset 0 2px 4px rgba(255, 255, 255, 0.2);
                }
            }
            
            .voice-listening {
                background: linear-gradient(135deg, #22c55e, #16a34a) !important;
                border-color: #166534 !important;
                animation: pulse-glow 1.5s ease-in-out infinite;
            }
            
            .voice-processing {
                background: linear-gradient(135deg, #f59e0b, #d97706) !important;
                border-color: #b45309 !important;
            }
            
            .timer-active {
                color: #22c55e !important;
                text-shadow: 0 0 10px rgba(34, 197, 94, 0.5) !important;
            }
            
            .status-active {
                color: #22c55e !important;
            }
            
            .transcript-visible {
                max-height: 200px !important;
                opacity: 1 !important;
            }
            
            @media (max-width: 1024px) {
                #voice-control-container {
                    right: 1rem;
                    width: 240px;
                }
            }
            
            @media (max-width: 768px) {
                #voice-control-container {
                    position: relative;
                    top: auto;
                    right: auto;
                    width: 100%;
                    margin-bottom: 1rem;
                }
            }
        `;
        document.head.appendChild(style);
    }
    
    /**
     * Setup Event Listeners
     */
    function setupEventListeners() {
        // Button events
        voiceButton.addEventListener('mousedown', (e) => {
            e.preventDefault();
            startListening();
        });
        
        voiceButton.addEventListener('mouseup', () => {
            stopListening();
        });
        
        voiceButton.addEventListener('mouseleave', () => {
            if (isListening) stopListening();
        });
        
        // Spacebar events
        document.addEventListener('keydown', (e) => {
            if (e.key === config.pushToTalkKey && !e.repeat && !isInputFocused()) {
                e.preventDefault();
                isPushToTalkActive = true;
                startListening();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === config.pushToTalkKey && isPushToTalkActive) {
                e.preventDefault();
                isPushToTalkActive = false;
                stopListening();
            }
        });
    }
    
    /**
     * Check if an input element is focused
     */
    function isInputFocused() {
        const active = document.activeElement;
        return active && (
            active.tagName === 'INPUT' ||
            active.tagName === 'TEXTAREA' ||
            active.tagName === 'SELECT' ||
            active.isContentEditable
        );
    }
    
    /**
     * Start listening
     */
    function startListening() {
        if (isListening) return;
        
        try {
            recognition.start();
            isListening = true;
            startTime = Date.now();
            timerInterval = setInterval(updateTimer, 100);
        } catch (error) {
            console.error('Failed to start recognition:', error);
        }
    }
    
    /**
     * Stop listening
     */
    function stopListening() {
        if (!isListening) return;
        
        try {
            recognition.stop();
            clearInterval(timerInterval);
        } catch (error) {
            console.error('Failed to stop recognition:', error);
        }
    }
    
    /**
     * Update timer display
     */
    function updateTimer() {
        const elapsed = Math.floor((Date.now() - startTime) / 1000);
        const mins = Math.floor(elapsed / 60);
        const secs = elapsed % 60;
        timerDisplay.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    /**
     * Recognition Started
     */
    function handleRecognitionStart() {
        voiceButton.classList.add('voice-listening');
        timerDisplay.classList.add('timer-active');
        statusDisplay.classList.add('status-active');
        statusDisplay.textContent = '🔴 Listening...';
        transcriptDisplay.classList.add('transcript-visible');
        transcriptDisplay.textContent = 'Listening...';
    }
    
    /**
     * Recognition Result
     */
    function handleRecognitionResult(event) {
        const result = event.results[event.results.length - 1];
        const transcript = result[0].transcript.trim();
        const isFinal = result.isFinal;
        const confidence = result[0].confidence;
        
        // Update transcript display
        transcriptDisplay.textContent = transcript + (isFinal ? '' : '...');
        
        if (isFinal) {
            voiceButton.classList.remove('voice-listening');
            voiceButton.classList.add('voice-processing');
            statusDisplay.textContent = 'Processing...';
            
            // Process command
            processCommand(transcript, confidence);
        }
    }
    
    /**
     * Recognition Error
     */
    function handleRecognitionError(event) {
        console.error('Recognition error:', event.error);
        voiceButton.classList.remove('voice-listening', 'voice-processing');
        statusDisplay.textContent = 'Error: ' + event.error;
        statusDisplay.style.color = '#ef4444';
        
        setTimeout(() => {
            resetUI();
        }, 2000);
    }
    
    /**
     * Recognition Ended
     */
    function handleRecognitionEnd() {
        isListening = false;
        voiceButton.classList.remove('voice-listening', 'voice-processing');
        timerDisplay.classList.remove('timer-active');
        statusDisplay.classList.remove('status-active');
        
        clearInterval(timerInterval);
        timerDisplay.textContent = '0:00';
        
        setTimeout(() => {
            if (!isListening) {
                transcriptDisplay.classList.remove('transcript-visible');
                resetUI();
            }
        }, 3000);
    }
    
    /**
     * Reset UI to default state
     */
    function resetUI() {
        statusDisplay.textContent = 'Ready';
        statusDisplay.style.color = '#64748b';
    }
    
    /**
     * Process Voice Command
     */
    function processCommand(transcript, confidence) {
        console.log(`🎤 Command: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
        
        if (confidence < config.confidenceThreshold) {
            transcriptDisplay.innerHTML = `<span style="color: #f59e0b;">⚠️ Low confidence</span>`;
            statusDisplay.textContent = 'Try again?';
            statusDisplay.style.color = '#f59e0b';
            return;
        }
        
        const commands = parseCommand(transcript.toLowerCase());
        
        if (commands.length === 0) {
            transcriptDisplay.innerHTML = `<span style="color: #ef4444;">❌ Unknown command</span>`;
            statusDisplay.textContent = 'Unknown command';
            statusDisplay.style.color = '#ef4444';
            return;
        }
        
        // Execute all parsed commands
        commands.forEach(cmd => executeCommand(cmd));
        
        // Add to history
        commandHistory.unshift({
            transcript,
            commands,
            timestamp: Date.now()
        });
        if (commandHistory.length > 10) commandHistory.pop();
        
        // Success feedback
        const feedback = commands.map(c => c.feedback).join(', ');
        transcriptDisplay.innerHTML = `<span style="color: #22c55e;">✓ ${feedback}</span>`;
        statusDisplay.textContent = 'Executed';
        statusDisplay.style.color = '#22c55e';
        
        // Audio feedback if query
        if (config.audioFeedback && commands.some(c => c.type === 'query')) {
            speakResults();
        }
    }
    
    /**
     * Parse Command from Transcript - supports chaining
     */
    /**
 * Parse Command from Transcript - Natural Language Understanding
 * Handles conversational inputs like "I'm level 7 looking for rare"
 */
/**
 * Parse Command from Transcript - Natural Language Understanding
 * Handles conversational inputs like "I'm level 7 looking for rare"
 */
function parseCommand(text) {
    const commands = [];
    const original = text.toLowerCase();
    
    // Extract all numbers first (before normalization removes context)
    const allNumbers = original.match(/\d+/g)?.map(n => parseInt(n)) || [];
    let availableNumbers = [...allNumbers]; // Keep a working copy
    
    console.log(`📝 Original: "${original}"`);
    console.log(`🔢 Numbers found: [${availableNumbers.join(', ')}]`);
    
    // LEVEL DETECTION - Check original text for better accuracy
    // Patterns: "level 7", "lvl 5", "I'm level 3", "change level to 2", just "6"
    if (/level|lvl|lv\b/i.test(original)) {
        if (/up/i.test(original)) {
            commands.push({ type: 'level', value: 'up', feedback: 'Level up' });
        } else if (/down/i.test(original)) {
            commands.push({ type: 'level', value: 'down', feedback: 'Level down' });
        } else {
            // Find number near "level" keyword or first number 1-9
            const levelMatch = original.match(/(?:level|lvl|lv)\s*(\d+)|(\d+)\s*(?:level|lvl)/i);
            const levelNum = levelMatch ? parseInt(levelMatch[1] || levelMatch[2]) : availableNumbers.find(n => n >= 1 && n <= 9);
            
            if (levelNum && levelNum >= 1 && levelNum <= 9) {
                commands.push({ type: 'level', value: levelNum, feedback: `Level ${levelNum}` });
                const idx = availableNumbers.indexOf(levelNum);
                if (idx !== -1) availableNumbers.splice(idx, 1);
            }
        }
    }
    // Standalone single-digit number might be level if no other context
    else if (availableNumbers.length === 1 && availableNumbers[0] >= 1 && availableNumbers[0] <= 9) {
        if (!/(own|have|got|scout|bench|refresh|star|copies)/i.test(original)) {
            commands.push({ type: 'level', value: availableNumbers[0], feedback: `Level ${availableNumbers[0]}` });
            availableNumbers = [];
        }
    }
    // Multiple numbers where first is 1-9
    else if (availableNumbers.length > 0 && availableNumbers[0] >= 1 && availableNumbers[0] <= 9) {
        if (!/(own|have|got|scout|bench|refresh)/i.test(original.split(availableNumbers[0])[0])) {
            // If the number isn't preceded by ownership/scouting keywords, assume it's level
            commands.push({ type: 'level', value: availableNumbers[0], feedback: `Level ${availableNumbers[0]}` });
            availableNumbers.shift();
        }
    }
    
    // RARITY DETECTION
    const rarityMap = {
        'common': 'common',
        'uncommon': 'uncommon',
        'uc': 'uncommon',
        'green': 'uncommon',
        'rare': 'rare',
        'blue': 'rare',
        'epic': 'epic',
        'purple': 'epic',
        'ultra': 'ultra',
        'legendary': 'ultra',
        'red': 'ultra'
    };
    
    for (const [keyword, rarity] of Object.entries(rarityMap)) {
        if (new RegExp(`\\b${keyword}\\b`, 'i').test(original)) {
            commands.push({ type: 'rarity', value: rarity, feedback: rarity });
            break;
        }
    }
    
    // EVOLUTION DETECTION
    if (/(two|2)\s*(star|\*)|2★/i.test(original)) {
        commands.push({ type: 'evolution', value: 'twoStar', feedback: '2★' });
    } else if (/(three|3)\s*(star|\*)|3★/i.test(original)) {
        commands.push({ type: 'evolution', value: 'threeStar', feedback: '3★' });
    }
    
    // COPIES OWNED
    const ownedMatch = original.match(/(own|have|got|holding)\s*(\d+)|(\d+)\s*(own|have|got|copies|owned)/i);
    if (ownedMatch && !/(scout|bench|seen|taken)/i.test(original)) {
        const num = parseInt(ownedMatch[2] || ownedMatch[3]);
        commands.push({ type: 'copies', value: num, feedback: `Own ${num}` });
        const idx = availableNumbers.indexOf(num);
        if (idx !== -1) availableNumbers.splice(idx, 1);
    }
    
    // SCOUTING
    const scoutMatch = original.match(/(scout|scouted|seen|taken|opponent|enemy)\s*(\d+)|(\d+)\s*(scout|scouted|seen|taken)/i);
    if (scoutMatch) {
        const num = parseInt(scoutMatch[2] || scoutMatch[3]);
        commands.push({ type: 'scouting', value: num, feedback: `Scouted ${num}` });
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
    if (/(add|enable|include|with|turn on|yes)\s*ditto|ditto\s*(on|enabled)/i.test(original)) {
        commands.push({ type: 'ditto', value: true, feedback: 'Ditto on' });
    } else if (/(remove|disable|exclude|without|turn off|no)\s*ditto|ditto\s*(off|disabled)/i.test(original)) {
        commands.push({ type: 'ditto', value: false, feedback: 'Ditto off' });
    }
    
    // REFRESHES
    const refreshMatch = original.match(/(\d+)\s*(?:refresh|roll|check|times)|(?:refresh|check|roll)\s*(\d+)/i);
    if (refreshMatch) {
        const num = parseInt(refreshMatch[1] || refreshMatch[2]);
        commands.push({ type: 'refreshes', value: num, feedback: `${num} refreshes` });
        const idx = availableNumbers.indexOf(num);
        if (idx !== -1) availableNumbers.splice(idx, 1);
    }
    
    // QUERY
    if (/(what|tell|read|show).*(odd|probability|chance|percent)/i.test(original)) {
        commands.push({ type: 'query', feedback: 'Reading odds' });
    }
    
    // CLEAR/RESET
    if (/(clear|reset|start over)/i.test(original)) {
        commands.push({ type: 'clear', feedback: 'Cleared' });
    }
    
    console.log(`✅ Parsed commands: ${commands.length > 0 ? commands.map(c => c.feedback).join(', ') : 'none'}`);
    return commands;
}
    function executeCommand(command) {
        const state = window.calculatorState;
        if (!state) return;
        
        switch (command.type) {
            case 'level':
                if (command.value === 'up') {
                    simulateSelect('select', Math.min(9, state.level + 1), 0);
                } else if (command.value === 'down') {
                    simulateSelect('select', Math.max(1, state.level - 1), 0);
                } else {
                    simulateSelect('select', command.value, 0);
                }
                break;
                
            case 'rarity':
                simulateSelect('select', command.value, 1);
                break;
                
            case 'evolution':
                simulateSelect('select', command.value, 2);
                break;
                
            case 'copies':
                simulateInput('number', command.value, 'copies owned');
                break;
                
            case 'scouting':
                simulateInput('number', command.value, 'scouting');
                break;
                
            case 'bench':
                simulateInput('number', command.value, 'bench');
                break;
                
            case 'ditto':
                simulateCheckbox(command.value, 'ditto');
                break;
                
            case 'refreshes':
                simulateInput('number', command.value, 'refreshes');
                break;
                
            case 'clear':
                const clearBtn = Array.from(document.querySelectorAll('button')).find(btn => 
                    btn.textContent.includes('Clear All')
                );
                if (clearBtn) clearBtn.click();
                break;
        }
    }
    
    /**
     * Simulate Select Change
     */
    function simulateSelect(type, value, index = 0) {
        const selects = document.querySelectorAll('select');
        if (selects[index]) {
            const select = selects[index];
            select.value = value;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    
    /**
     * Simulate Input Change
     */
    function simulateInput(type, value, hint) {
        const inputs = document.querySelectorAll(`input[type="${type}"]`);
        let targetInput = null;
        
        if (hint === 'copies owned') {
            targetInput = Array.from(inputs).find(input => {
                const label = input.closest('div')?.querySelector('label')?.textContent || '';
                return label.toLowerCase().includes('copies you have');
            });
        } else if (hint === 'scouting') {
            targetInput = Array.from(inputs).find(input => {
                const card = input.closest('.bg-gradient-to-br');
                const heading = card?.querySelector('h2')?.textContent || '';
                return heading.toLowerCase().includes('scouting');
            });
        } else if (hint === 'bench') {
            targetInput = Array.from(inputs).find(input => {
                const card = input.closest('.bg-gradient-to-br');
                const heading = card?.querySelector('h2')?.textContent || '';
                return heading.toLowerCase().includes('bench');
            });
        } else if (hint === 'refreshes') {
            targetInput = Array.from(inputs).find(input => {
                const label = input.closest('div')?.querySelector('label')?.textContent || '';
                return label.toLowerCase().includes('refreshes to check');
            });
        }
        
        if (targetInput) {
            targetInput.value = value;
            targetInput.dispatchEvent(new Event('input', { bubbles: true }));
            targetInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }
    
    /**
     * Simulate Checkbox Change
     */
    function simulateCheckbox(checked, hint) {
        const checkboxes = document.querySelectorAll('input[type="checkbox"]');
        let targetCheckbox = null;
        
        if (hint === 'ditto') {
            targetCheckbox = Array.from(checkboxes).find(cb => {
                const label = cb.parentElement?.textContent || '';
                return label.toLowerCase().includes('ditto');
            });
        }
        
        if (targetCheckbox && targetCheckbox.checked !== checked) {
            targetCheckbox.click();
        }
    }
    
    /**
     * Speak Results (TTS)
     */
    function speakResults() {
        const state = window.calculatorState;
        if (!state || !window.speechSynthesis) return;
        
        const probs = state.probabilities;
        const text = `Your odds are ${probs.perRefresh.toFixed(1)} percent per refresh, and ${probs.overNRefreshes.toFixed(1)} percent over ${state.refreshes} refreshes.`;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 1.1;
        utterance.pitch = 1.0;
        utterance.volume = 0.8;
        
        window.speechSynthesis.speak(utterance);
    }
    
    // Expose API - NOW WITH START/STOP METHODS
    window.voiceControl = {
        startListening,
        stopListening,
        isEnabled: () => !!recognition,
        isListening: () => isListening,
        toggleAudioFeedback: () => {
            config.audioFeedback = !config.audioFeedback;
            console.log(`🔊 Audio feedback: ${config.audioFeedback ? 'ON' : 'OFF'}`);
            return config.audioFeedback;
        },
        getHistory: () => commandHistory,
        testCommand: (text) => {
            const commands = parseCommand(text.toLowerCase());
            console.log('Parsed commands:', commands);
            commands.forEach(cmd => executeCommand(cmd));
            return commands;
        }
    };
    
    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }
    
    console.log('✓ Voice Control module loaded (top-right placement)');
})();
