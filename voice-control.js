/**
 * PAC Analytics Voice Control System
 * Enables hands-free calculator operation during gameplay
 * 
 * Usage: Press and hold spacebar (or click mic button) to speak commands
 * 
 * Supported commands:
 * - Level: "level 5", "level up", "level down"
 * - Rarity: "uncommon", "rare", "epic", "ultra"
 * - Evolution: "two star", "three star", "two star max", "three star max"
 * - Copies: "have 3", "own 2", "got 5"
 * - Scouting: "scouted 4", "taken 3", "scout 2"
 * - Bench: "bench 5", "benched 3"
 * - Ditto: "add ditto", "enable ditto", "remove ditto", "disable ditto"
 * - Refreshes: "10 refreshes", "check 15"
 * - Query: "what are my odds", "tell me my odds", "read results"
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
        audioFeedback: false, // Toggle for TTS readback
        confidenceThreshold: 0.6
    };
    
    // State
    let recognition = null;
    let isListening = false;
    let isPushToTalkActive = false;
    let commandHistory = [];
    
    // UI Elements
    let voiceButton = null;
    let statusIndicator = null;
    let transcriptDisplay = null;
    let feedbackContainer = null;
    
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
        console.log('   → Or click the microphone button');
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
     * Create Voice Control UI
     */
    function createUI() {
        // Container
        const container = document.createElement('div');
        container.id = 'voice-control-container';
        container.style.cssText = `
            position: fixed;
            bottom: 2rem;
            right: 2rem;
            z-index: 2000;
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            gap: 1rem;
        `;
        
        // Feedback container (transcript + history)
        feedbackContainer = document.createElement('div');
        feedbackContainer.style.cssText = `
            background: linear-gradient(135deg, rgba(15, 23, 42, 0.98), rgba(30, 41, 59, 0.98));
            border: 1px solid rgba(56, 189, 248, 0.3);
            border-radius: 1rem;
            padding: 1rem;
            min-width: 300px;
            max-width: 400px;
            backdrop-filter: blur(10px);
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
            opacity: 0;
            transform: translateY(10px);
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            pointer-events: none;
        `;
        
        // Status indicator
        statusIndicator = document.createElement('div');
        statusIndicator.style.cssText = `
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin-bottom: 0.75rem;
            padding-bottom: 0.75rem;
            border-bottom: 1px solid rgba(56, 189, 248, 0.2);
            font-size: 0.875rem;
            color: #94a3b8;
        `;
        statusIndicator.innerHTML = `
            <div class="status-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #64748b;"></div>
            <span>Ready</span>
        `;
        
        // Transcript display
        transcriptDisplay = document.createElement('div');
        transcriptDisplay.style.cssText = `
            font-size: 1rem;
            color: white;
            min-height: 2rem;
            font-weight: 500;
        `;
        transcriptDisplay.textContent = 'Press spacebar to speak...';
        
        feedbackContainer.appendChild(statusIndicator);
        feedbackContainer.appendChild(transcriptDisplay);
        
        // Voice button
        voiceButton = document.createElement('button');
        voiceButton.id = 'voice-control-button';
        voiceButton.innerHTML = `
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <line x1="12" x2="12" y1="19" y2="22"/>
            </svg>
        `;
        voiceButton.style.cssText = `
            width: 64px;
            height: 64px;
            border-radius: 50%;
            background: linear-gradient(135deg, #38bdf8, #22d3ee);
            border: none;
            color: white;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(56, 189, 248, 0.4);
            transition: all 0.2s;
            position: relative;
        `;
        
        // Pulse animation for listening state
        const style = document.createElement('style');
        style.textContent = `
            @keyframes pulse {
                0%, 100% { transform: scale(1); opacity: 1; }
                50% { transform: scale(1.1); opacity: 0.8; }
            }
            
            .voice-listening {
                animation: pulse 1.5s ease-in-out infinite;
                background: linear-gradient(135deg, #22c55e, #16a34a) !important;
                box-shadow: 0 4px 20px rgba(34, 197, 94, 0.6) !important;
            }
            
            .voice-processing {
                background: linear-gradient(135deg, #f59e0b, #d97706) !important;
                box-shadow: 0 4px 20px rgba(245, 158, 11, 0.6) !important;
            }
            
            .voice-error {
                background: linear-gradient(135deg, #ef4444, #dc2626) !important;
                box-shadow: 0 4px 20px rgba(239, 68, 68, 0.6) !important;
            }
            
            .feedback-visible {
                opacity: 1 !important;
                transform: translateY(0) !important;
            }
            
            @media (max-width: 768px) {
                #voice-control-container {
                    bottom: 1rem;
                    right: 1rem;
                }
                
                #voice-control-button {
                    width: 56px;
                    height: 56px;
                }
            }
        `;
        document.head.appendChild(style);
        
        container.appendChild(feedbackContainer);
        container.appendChild(voiceButton);
        document.body.appendChild(container);
    }
    
    /**
     * Setup Event Listeners
     */
    function setupEventListeners() {
        // Button click
        voiceButton.addEventListener('mousedown', startListening);
        voiceButton.addEventListener('mouseup', stopListening);
        voiceButton.addEventListener('mouseleave', stopListening);
        
        // Keyboard (spacebar)
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
        } catch (error) {
            console.error('Failed to stop recognition:', error);
        }
    }
    
    /**
     * Recognition Started
     */
    function handleRecognitionStart() {
        voiceButton.classList.add('voice-listening');
        updateStatus('Listening...', '#22c55e');
        showFeedback();
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
            updateStatus('Processing...', '#f59e0b');
            
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
        voiceButton.classList.add('voice-error');
        updateStatus('Error: ' + event.error, '#ef4444');
        
        setTimeout(() => {
            voiceButton.classList.remove('voice-error');
            updateStatus('Ready', '#64748b');
            hideFeedback();
        }, 2000);
    }
    
    /**
     * Recognition Ended
     */
    function handleRecognitionEnd() {
        isListening = false;
        voiceButton.classList.remove('voice-listening', 'voice-processing');
    }
    
    /**
     * Update Status Indicator
     */
    function updateStatus(text, color) {
        const dot = statusIndicator.querySelector('.status-dot');
        const span = statusIndicator.querySelector('span');
        
        if (dot) dot.style.background = color;
        if (span) span.textContent = text;
    }
    
    /**
     * Show Feedback Container
     */
    function showFeedback() {
        feedbackContainer.classList.add('feedback-visible');
    }
    
    /**
     * Hide Feedback Container
     */
    function hideFeedback() {
        setTimeout(() => {
            if (!isListening) {
                feedbackContainer.classList.remove('feedback-visible');
            }
        }, 3000);
    }
    
    /**
     * Process Voice Command
     */
    function processCommand(transcript, confidence) {
        console.log(`🎤 Command: "${transcript}" (confidence: ${(confidence * 100).toFixed(1)}%)`);
        
        if (confidence < config.confidenceThreshold) {
            transcriptDisplay.innerHTML = `<span style="color: #f59e0b;">⚠️ Low confidence. Try again?</span>`;
            updateStatus('Low confidence', '#f59e0b');
            hideFeedback();
            return;
        }
        
        const command = parseCommand(transcript.toLowerCase());
        
        if (command.type === 'unknown') {
            transcriptDisplay.innerHTML = `<span style="color: #ef4444;">❌ Unknown command</span>`;
            updateStatus('Unknown command', '#ef4444');
            hideFeedback();
            return;
        }
        
        // Execute command
        executeCommand(command);
        
        // Add to history
        commandHistory.unshift({
            transcript,
            command,
            timestamp: Date.now()
        });
        if (commandHistory.length > 10) commandHistory.pop();
        
        // Success feedback
        transcriptDisplay.innerHTML = `<span style="color: #22c55e;">✓ ${command.feedback}</span>`;
        updateStatus('Command executed', '#22c55e');
        
        // Audio feedback if enabled
        if (config.audioFeedback && command.type === 'query') {
            speakResults();
        }
        
        hideFeedback();
    }
    
    /**
     * Parse Command from Transcript
     */
    function parseCommand(text) {
        // Level commands
        if (text.match(/level (\d)/)) {
            const level = parseInt(text.match(/level (\d)/)[1]);
            if (level >= 1 && level <= 9) {
                return { type: 'level', value: level, feedback: `Level ${level}` };
            }
        }
        if (text.includes('level up')) {
            return { type: 'level', value: 'up', feedback: 'Level up' };
        }
        if (text.includes('level down')) {
            return { type: 'level', value: 'down', feedback: 'Level down' };
        }
        
        // Rarity commands
        const rarities = ['common', 'uncommon', 'rare', 'epic', 'ultra'];
        for (const rarity of rarities) {
            if (text.includes(rarity)) {
                return { type: 'rarity', value: rarity, feedback: `Target: ${rarity}` };
            }
        }
        
        // Evolution commands
        if (text.match(/two star|2 star|two\*/)) {
            return { type: 'evolution', value: 'twoStar', feedback: '2★ max' };
        }
        if (text.match(/three star|3 star|three\*/)) {
            return { type: 'evolution', value: 'threeStar', feedback: '3★ max' };
        }
        
        // Copies owned
        if (text.match(/(have|own|got) (\d+)/)) {
            const copies = parseInt(text.match(/(have|own|got) (\d+)/)[2]);
            return { type: 'copies', value: copies, feedback: `Owned: ${copies}` };
        }
        
        // Scouting
        if (text.match(/(scout|scouted|taken) (\d+)/)) {
            const copies = parseInt(text.match(/(scout|scouted|taken) (\d+)/)[2]);
            return { type: 'scouting', value: copies, feedback: `Scouted: ${copies}` };
        }
        
        // Bench
        if (text.match(/(bench|benched) (\d+)/)) {
            const units = parseInt(text.match(/(bench|benched) (\d+)/)[2]);
            return { type: 'bench', value: units, feedback: `Bench: ${units}` };
        }
        
        // Ditto
        if (text.match(/(add|enable|include) ditto/)) {
            return { type: 'ditto', value: true, feedback: 'Ditto enabled' };
        }
        if (text.match(/(remove|disable|exclude) ditto/)) {
            return { type: 'ditto', value: false, feedback: 'Ditto disabled' };
        }
        
        // Refreshes
        if (text.match(/(\d+) refresh/)) {
            const refreshes = parseInt(text.match(/(\d+) refresh/)[1]);
            return { type: 'refreshes', value: refreshes, feedback: `Check ${refreshes} refreshes` };
        }
        if (text.match(/check (\d+)/)) {
            const refreshes = parseInt(text.match(/check (\d+)/)[1]);
            return { type: 'refreshes', value: refreshes, feedback: `Check ${refreshes} refreshes` };
        }
        
        // Query commands
        if (text.match(/(what are|tell me|read) (my )?odds/)) {
            return { type: 'query', feedback: 'Reading results' };
        }
        
        // Clear/Reset
        if (text.includes('clear') || text.includes('reset')) {
            return { type: 'clear', feedback: 'Cleared inputs' };
        }
        
        return { type: 'unknown' };
    }
    
    /**
     * Execute Parsed Command
     */
    function executeCommand(command) {
        const state = window.calculatorState;
        if (!state) return;
        
        // Find the React component instance (hacky but works)
        const root = document.getElementById('root');
        const reactRoot = root?._reactRootContainer?._internalRoot?.current;
        
        // Trigger state updates by dispatching events to the calculator
        switch (command.type) {
            case 'level':
                if (command.value === 'up') {
                    simulateSelect('select', Math.min(9, state.level + 1));
                } else if (command.value === 'down') {
                    simulateSelect('select', Math.max(1, state.level - 1));
                } else {
                    simulateSelect('select', command.value);
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
                const clearBtn = document.querySelector('button');
                if (clearBtn && clearBtn.textContent.includes('Clear')) {
                    clearBtn.click();
                }
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
        
        // Find the right input based on context
        let targetInput = null;
        
        if (hint === 'copies owned') {
            targetInput = Array.from(inputs).find(input => {
                const label = input.previousElementSibling?.textContent || '';
                return label.toLowerCase().includes('copies you have');
            });
        } else if (hint === 'scouting') {
            targetInput = Array.from(inputs).find(input => {
                const card = input.closest('.bg-gradient-to-br');
                return card?.textContent.includes('Scouting');
            });
        } else if (hint === 'bench') {
            targetInput = Array.from(inputs).find(input => {
                const card = input.closest('.bg-gradient-to-br');
                return card?.textContent.includes('Your Bench');
            });
        } else if (hint === 'refreshes') {
            targetInput = Array.from(inputs).find(input => {
                const label = input.previousElementSibling?.textContent || '';
                return label.toLowerCase().includes('refreshes');
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
    
    // Expose API
    window.voiceControl = {
        isEnabled: () => !!recognition,
        isListening: () => isListening,
        toggleAudioFeedback: () => {
            config.audioFeedback = !config.audioFeedback;
            console.log(`🔊 Audio feedback: ${config.audioFeedback ? 'ON' : 'OFF'}`);
            return config.audioFeedback;
        },
        getHistory: () => commandHistory,
        testCommand: (text) => {
            const command = parseCommand(text.toLowerCase());
            console.log('Parsed command:', command);
            if (command.type !== 'unknown') {
                executeCommand(command);
            }
            return command;
        }
    };
    
    // Initialize after DOM loads
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        setTimeout(init, 500);
    }
    
    console.log('✓ Voice Control module loaded');
})();
