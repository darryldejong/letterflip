import VALID_WORDS from './valid_words.js';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

function shuffleArray(array, seed) {
    const shuffled = [...array];
    let currentIndex = shuffled.length;
    let temporaryValue, randomIndex;
    
    let random = seed;
    
    while (currentIndex !== 0) {
        random = (random * 9301 + 49297) % 233280;
        randomIndex = Math.floor((random / 233280) * currentIndex);
        currentIndex -= 1;
        
        temporaryValue = shuffled[currentIndex];
        shuffled[currentIndex] = shuffled[randomIndex];
        shuffled[randomIndex] = temporaryValue;
    }
    
    return shuffled;
}

function getDailyWordIndex() {
    const startDate = new Date('2025-01-01');
    const today = new Date();
    const amsterdamTime = new Date(today.toLocaleString("en-US", {timeZone: "Europe/Amsterdam"}));
    const diffTime = amsterdamTime.getTime() - startDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    const shuffledWords = shuffleArray(VALID_WORDS, 12345);
    
    return diffDays % shuffledWords.length;
}

function getDailyWord() {
    const shuffledWords = shuffleArray(VALID_WORDS, 12345);
    return shuffledWords[getDailyWordIndex()];
}

function getTodayString() {
    const today = new Date();
    const amsterdamTime = new Date(today.toLocaleString("en-US", {timeZone: "Europe/Amsterdam"}));
    return amsterdamTime.toISOString().split('T')[0];
}

function getTimeUntilMidnight() {
    const now = new Date();
    const amsterdamTime = new Date(now.toLocaleString("en-US", {timeZone: "Europe/Amsterdam"}));
    const tomorrow = new Date(amsterdamTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const timeDiff = tomorrow.getTime() - amsterdamTime.getTime();
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeDiff % (1000 * 60)) / 1000);
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

let gameMode = 'daily';
let targetWord = getDailyWord();
let dailyGameCompleted = false;

const grid = document.getElementById("grid");
const message = document.getElementById("message");

const popupOverlay = document.getElementById('popupOverlay');
const popupMessage = document.getElementById('popupMessage');
const closePopupButton = document.getElementById('closePopupButton');

function getStats() {
    const stats = localStorage.getItem('letterflip-stats');
    if (!stats) {
        return {
            gamesPlayed: 0,
            gamesWon: 0,
            currentStreak: 0,
            maxStreak: 0,
            guessDistribution: [0, 0, 0, 0, 0, 0],
            lastPlayedDate: null
        };
    }
    return JSON.parse(stats);
}

function saveStats(stats) {
    localStorage.setItem('letterflip-stats', JSON.stringify(stats));
}

function getDailyGameState() {
    const today = getTodayString();
    const savedState = localStorage.getItem(`letterflip-daily-${today}`);
    if (!savedState) {
        return { completed: false, won: false, attempts: 0 };
    }
    return JSON.parse(savedState);
}

function saveDailyGameState(state) {
    const today = getTodayString();
    localStorage.setItem(`letterflip-daily-${today}`, JSON.stringify(state));
}

function updateStats(won, guessCount) {
    const stats = getStats();
    stats.gamesPlayed++;
    stats.lastPlayedDate = getTodayString();
    
    if (won) {
        stats.gamesWon++;
        stats.currentStreak++;
        stats.maxStreak = Math.max(stats.maxStreak, stats.currentStreak);
        stats.guessDistribution[guessCount - 1]++;
    } else {
        stats.currentStreak = 0;
    }
    
    saveStats(stats);
}


const keyboardLayouts = {
    qwerty: {
        row1: "qwertyuiop".split(""),
        row2: "asdfghjkl".split(""),
        row3: ["enter", ..."zxcvbnm".split(""), "backspace", "reset"]
    },
    azerty: {
        row1: "azertyuiop".split(""),
        row2: "qsdfghjklm".split(""),
        row3: ["enter", ..."wxcvbn".split(""), "backspace", "reset"]
    }
};

let activeLayout = localStorage.getItem("keyboardLayout") || "qwerty";

let currentGuess = "";
let currentRow = 0;
const keyStatuses = {};

const hintToggle = document.getElementById("hint-toggle");
const hintButton = document.getElementById("hint-btn-line");
let hintUsedForCurrentGame = false;
let isChecking = false;

function createGrid() {
    grid.innerHTML = "";
    for (let i = 0; i < MAX_GUESSES * WORD_LENGTH; i++) {
        const cell = document.createElement("div");
        cell.classList.add("cell");
        grid.appendChild(cell);
    }
}

function createKeyboard() {
    for (const rowId in keyboardLayouts[activeLayout]) {
        const rowDiv = document.getElementById(rowId);
        if (!rowDiv) {
            console.error(`Div met id ${rowId} niet gevonden!`);
            continue;
        }
        rowDiv.innerHTML = "";

        keyboardLayouts[activeLayout][rowId].forEach(key => {
            const keyBtn = document.createElement("button");

            if (key === "enter") {
                keyBtn.textContent = "Enter";
                keyBtn.classList.add("key", "wide", "enter-key");
            } else if (key === "backspace") {
                keyBtn.classList.add("key", "wide");

                const svgImg = document.createElement("img");
                svgImg.src = "assets/img/backspace.svg";
                svgImg.alt = "Backspace";
                svgImg.classList.add("svg-icon");
                keyBtn.appendChild(svgImg);
            } else if (key === "reset") {
                keyBtn.classList.add("key", "wide");

                const svgImg = document.createElement("img");
                svgImg.src = "assets/img/reset.svg";
                svgImg.alt = "Reset";
                svgImg.classList.add("svg-icon");
                keyBtn.appendChild(svgImg);
            } else {
                keyBtn.textContent = key;
                keyBtn.classList.add("key");
            }

            if (keyStatuses[key]) {
                keyBtn.classList.add(keyStatuses[key]);
            }

            keyBtn.addEventListener("click", () => handleKey(key));
            rowDiv.appendChild(keyBtn);
        });
    }
}

function updateGridRow(row, guess, states = []) {
    for (let i = 0; i < WORD_LENGTH; i++) {
        const cell = grid.children[row * WORD_LENGTH + i];

        if (row === 0 && i === 0 && hintUsedForCurrentGame) {
            continue;
        }

        cell.textContent = guess[i] ? guess[i].toUpperCase() : "";
        if (states.length === 0) {
            cell.className = "cell";
        }
        if (states[i]) {
            cell.classList.add(states[i]);
        }
    }
}

function checkGuess(guess) {
    let states = Array(WORD_LENGTH).fill("absent");
    let targetLetters = targetWord.split("");

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (guess[i] === targetLetters[i]) {
            states[i] = "correct";
            targetLetters[i] = null;
        }
    }

    for (let i = 0; i < WORD_LENGTH; i++) {
        if (states[i] === "correct") continue;
        let idx = targetLetters.indexOf(guess[i]);
        if (idx !== -1) {
            states[i] = "present";
            targetLetters[idx] = null;
        }
    }
    return states;
}

function setMessage(text, className = '') {
    message.textContent = text;
    message.className = className;
}

function showPopup(messageText) {
    const creditsText = `
        <div class="popup-extra">
            <p><span class="letterflip-text">Letterflip</span> is gemaakt door
              <a href="https://www.linkedin.com/in/darryldejong/" target="_blank" rel="noopener noreferrer" class="made-by-link">Darryl de Jong</a>.
              <hr>
            </p>
            <p>De volledige code staat op
                <a href="https://github.com/darryldejong/letterflip" target="_blank" rel="noopener noreferrer" class="project-link">GitHub</a>.
                <hr>
            </p>
            <p>Bedankt
                <a href="https://www.deviantart.com/taviturnip/art/Free-Element-Bearers-Icons-485132396" 
     target="_blank" rel="noopener noreferrer" class="credit-link">TaviTurnip</a> 
  voor het mogen gebruiken van de assets in dit project.
            </p>
        </div>
    `;
    
    popupMessage.innerHTML = messageText + creditsText;
    popupOverlay.classList.add('show');
}

function showStatsPopup(won, guessCount) {
    const stats = getStats();
    const winPercentage = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
    
    let percentageClass = '';
    if (winPercentage < 50) {
        percentageClass = 'percentage-red';
    } else if (winPercentage < 75) {
        percentageClass = 'percentage-green';
    } else if (winPercentage < 100) {
        percentageClass = 'percentage-light-green';
    } else {
        percentageClass = 'percentage-full-green';
    }
    
    let resultText = won ? 
        `<span class="win-text">Gefeliciteerd! Je hebt het woord geraden in ${guessCount} ${guessCount === 1 ? 'poging' : 'pogingen'}!</span><hr>` :
        `<span class="lose-text">Helaas, het woord was: <span class="failed">${targetWord.charAt(0).toUpperCase() + targetWord.slice(1).toLowerCase()}</span></span><hr>`;
    
    const statsText = `
        <h3 class="popup-stats-title">Statistieken</h3>
        <hr>
        <div class="stats-container">
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${stats.gamesPlayed}</div>
                    <div class="stat-label">Gespeeld</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number ${percentageClass}">${winPercentage}%</div>
                    <div class="stat-label">Gewonnen</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.currentStreak}</div>
                    <div class="stat-label">Huidige reeks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.maxStreak}</div>
                    <div class="stat-label">Beste reeks</div>
                </div>
            </div>
            ${gameMode === 'daily' ? `
                <hr>
                <div class="next-game-info">
                    <p>Het volgende dagelijkse woord is beschikbaar over:</p>
                    <div id="countdown-timer" class="countdown">${getTimeUntilMidnight()}</div>
                </div>
            ` : ''}
        </div>
    `;
    
    popupMessage.innerHTML = resultText + statsText;
    
    const popupContent = document.querySelector('.popup-content');
    const closeButton = document.getElementById('closePopupButton');
    if (gameMode === 'daily') {
        popupContent.className = 'popup-content-two';
        closeButton.innerHTML = '<img src="assets/img/arrow.svg" alt="close popup icon" class="svg-popup">';
    } else {
        popupContent.className = 'popup-content';
        closeButton.innerHTML = '<img src="assets/img/arrow.svg" alt="close popup icon" class="svg-popup-normal">';
    }
    
    popupOverlay.classList.add('show');
    
    if (gameMode === 'daily') {
        const countdownInterval = setInterval(() => {
            const timerElement = document.getElementById('countdown-timer');
            if (timerElement) {
                timerElement.textContent = getTimeUntilMidnight();
            } else {
                clearInterval(countdownInterval);
            }
        }, 1000);
    }
}

function showStatsOnlyPopup() {
    const stats = getStats();
    const winPercentage = stats.gamesPlayed > 0 ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0;
    
    let percentageClass = '';
    if (winPercentage < 50) {
        percentageClass = 'percentage-red';
    } else if (winPercentage < 75) {
        percentageClass = 'percentage-green';
    } else if (winPercentage < 100) {
        percentageClass = 'percentage-light-green';
    } else {
        percentageClass = 'percentage-full-green';
    }
    
    const statsText = `
        <h3 class="popup-stats-title">Statistieken</h3>
        <hr>
        <div class="stats-container">
            <div class="stats-grid">
                <div class="stat-item">
                    <div class="stat-number">${stats.gamesPlayed}</div>
                    <div class="stat-label">Gespeeld</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number ${percentageClass}">${winPercentage}%</div>
                    <div class="stat-label">Gewonnen</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.currentStreak}</div>
                    <div class="stat-label">Huidige reeks</div>
                </div>
                <div class="stat-item">
                    <div class="stat-number">${stats.maxStreak}</div>
                    <div class="stat-label">Beste reeks</div>
                </div>
            </div>
        </div>
    `;
    
    popupMessage.innerHTML = statsText;
    
    const popupContent = document.querySelector('.popup-content, .popup-content-two');
    popupContent.className = 'popup-statics';
    
    const closeButton = document.getElementById('closePopupButton');
    closeButton.innerHTML = '<img src="assets/img/arrow.svg" alt="close popup icon" class="svg-arrow-stats">';
    
    popupOverlay.classList.add('show');
}

function hidePopup() {
    popupOverlay.classList.remove('show');
    
    const closeButton = document.getElementById('closePopupButton');
    closeButton.innerHTML = '<img src="assets/img/arrow.svg" alt="close popup icon" class="svg-popup-normal">';
    
    const popupContent = document.querySelector('.popup-content, .popup-content-two, .popup-statics');
    if (popupContent) {
        popupContent.className = 'popup-content';
    }
}

closePopupButton.addEventListener('click', (e) => {
    const arrowImg = e.currentTarget.querySelector('.svg-arrow-stats');
    if (arrowImg) {
        const popupContent = document.querySelector('.popup-statics');
        if (popupContent) {
            returnFromStats();
            return;
        } else {
            startFreshGame();
            return;
        }
    }
    
    const popupContentTwo = document.querySelector('.popup-content-two');
    if (popupContentTwo) {
        startFreshGame();
        return;
    }
    
    hidePopup();
    if (gameMode === 'daily' && dailyGameCompleted) {
        return;
    }
    if (gameMode === 'free') {
        resetGame();
    }
});

popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
        const closeButton = document.getElementById('closePopupButton');
        const arrowImg = closeButton.querySelector('.svg-arrow-stats');
        if (arrowImg) {
            const popupContent = document.querySelector('.popup-statics');
            if (popupContent) {
                returnFromStats();
                return;
            } else {
                startFreshGame();
                return;
            }
        }
        
        const popupContentTwo = document.querySelector('.popup-content-two');
        if (popupContentTwo) {
            startFreshGame();
            return;
        }
        
        hidePopup();
        if (gameMode === 'daily' && dailyGameCompleted) {
            return;
        }
        if (gameMode === 'free') {
            resetGame();
        }
    }
});

function startFreePlay() {
    gameMode = 'free';
    dailyGameCompleted = false;
    hidePopup();
    resetGame();
}

async function animateRow(row, guess, states) {
    for (let i = 0; i < WORD_LENGTH; i++) {
        const cell = grid.children[row * WORD_LENGTH + i];

        cell.classList.add("flip-in");
        await new Promise(r => setTimeout(r, 100));

        cell.textContent = guess[i].toUpperCase();
        cell.className = "cell";
        cell.classList.add(states[i]);

        cell.classList.add("flip-out");
        await new Promise(r => setTimeout(r, 100));
        cell.classList.remove("flip-in", "flip-out");
    }
}

function updateKeyboard(guess, states) {
    guess.split("").forEach((letter, i) => {
        const keyButtons = document.querySelectorAll(".key");
        const state = states[i];
        const prevStatus = keyStatuses[letter];

        if (prevStatus === "correct") return;
        if (prevStatus === "present" && state === "absent") return;

        keyStatuses[letter] = state;

        keyButtons.forEach(button => {
            if (button.textContent.toLowerCase() === letter) {
                button.classList.remove("correct", "present", "absent");
                button.classList.add(state);
            }
        });
    });
}

function resetGame() {
    if (gameMode === 'daily') {
        targetWord = getDailyWord();
    } else {
        targetWord = VALID_WORDS[Math.floor(Math.random() * VALID_WORDS.length)];
    }
    
    currentGuess = "";
    currentRow = 0;
    for (const key in keyStatuses) {
        delete keyStatuses[key];
    }
    createGrid();
    createKeyboard();
    
    const messageEl = document.getElementById('message');
    if (gameMode === 'daily') {
        messageEl.textContent = "Dagelijks woord - Veel succes!";
        messageEl.className = "daily";
    } else {
        messageEl.textContent = "Vrij spelen - Veel succes!";
        messageEl.className = "free-play";
    }

    hintUsedForCurrentGame = false;
    const hintEnabled = localStorage.getItem("hintEnabled") === "enabled";
    if (hintEnabled && currentRow === 0 && (!dailyGameCompleted || gameMode === 'free')) {
        hintButton.classList.remove("hidden");
    } else {
        hintButton.classList.add("hidden");
    }
    
    document.querySelectorAll(".key").forEach(k => k.disabled = false);
    
    isChecking = false;
}

function handleKey(key) {
    if (isChecking) return;
    if (gameMode === 'daily' && dailyGameCompleted) return;
    
    if (key === "enter") {
        if (currentGuess.length !== WORD_LENGTH) {
            setMessage("Vul eerst 5 letters in.", "error");
            return;
        }
        if (!VALID_WORDS.includes(currentGuess)) {
            setMessage("Dit woord staat niet in de lijst.", "error");
            return;
        }

        if (currentRow === 0) {
            hintButton.classList.add("hidden");
        }

        const states = checkGuess(currentGuess);
        isChecking = true;
        animateRow(currentRow, currentGuess, states).then(() => {
            updateKeyboard(currentGuess, states);

            if (states.every(s => s === "correct")) {
                if (gameMode === 'daily') {
                    updateStats(true, currentRow + 1);
                    saveDailyGameState({ completed: true, won: true, attempts: currentRow + 1 });
                    dailyGameCompleted = true;
                    showStatsPopup(true, currentRow + 1);
                } else {
                    showPopup("Gefeliciteerd! Je hebt het woord geraden.");
                }
                disableKeyboard();
                if (gameMode === 'free') {
                    setTimeout(() => {
                        hidePopup();
                        resetGame();
                    }, 60000);
                } else {
                    isChecking = false;
                }
                return;
            }

            currentRow++;
            currentGuess = "";

            if (currentRow >= MAX_GUESSES) {
                if (gameMode === 'daily') {
                    updateStats(false, 0);
                    saveDailyGameState({ completed: true, won: false, attempts: MAX_GUESSES });
                    dailyGameCompleted = true;
                    showStatsPopup(false, 0);
                } else {
                    const messageText = `<span class="message-text">Helaas, het woord was: </span>`;
                    const formattedWord = `<span class="failed">${targetWord.charAt(0).toUpperCase() + targetWord.slice(1)}</span><hr>`;
                    showPopup(messageText + formattedWord);
                }
                disableKeyboard();
                if (gameMode === 'free') {
                    setTimeout(() => {
                        hidePopup();
                        resetGame();
                    }, 60000);
                } else {
                    isChecking = false;
                }
            } else {
                setMessage("");
                isChecking = false;
            }
        });

    } else if (key === "backspace") {
        if (currentGuess.length > 0) {
            if (currentRow === 0 && currentGuess.length === 1 && hintUsedForCurrentGame) {
                return;
            }
            currentGuess = currentGuess.slice(0, -1);
            updateGridRow(currentRow, currentGuess);

            if (currentRow === 0 && currentGuess.length === 0 && hintUsedForCurrentGame) {
                const cell = grid.children[0];
                cell.textContent = targetWord[0].toUpperCase();
                cell.className = "cell correct";
            }

        }
    } else if (key === "reset") {
        resetGame();
    } else if (/^[a-z]$/.test(key)) {
        let startingIndex = 0;
        if (currentRow === 0 && hintUsedForCurrentGame) {
            startingIndex = 1;
            if (currentGuess.length < startingIndex) {
                currentGuess = targetWord[0];
            }
        }

        if (currentGuess.length < WORD_LENGTH) {
            currentGuess += key;
            updateGridRow(currentRow, currentGuess);
        }
    }
}

function disableKeyboard() {
    document.querySelectorAll(".key").forEach(k => k.disabled = true);
}

document.addEventListener("DOMContentLoaded", () => {
    const today = getTodayString();
    const lastPlayedDate = localStorage.getItem('letterflip-last-date');
    
    if (lastPlayedDate !== today) {
        gameMode = 'daily';
        dailyGameCompleted = false;
        localStorage.setItem('letterflip-last-date', today);
    } else {
        const dailyState = getDailyGameState();
        if (dailyState.completed) {
            dailyGameCompleted = true;
            gameMode = 'free';
        }
    }
    
    createGrid();
    createKeyboard();
    updateGridRow(0, "");
    
    const messageEl = document.getElementById('message');
    if (gameMode === 'daily' && !dailyGameCompleted) {
        messageEl.textContent = "Dagelijks woord - Veel succes!";
        messageEl.className = "daily";
    } else if (gameMode === 'free') {
        messageEl.textContent = "Vrij spelen - Veel succes!";
        messageEl.className = "free-play";
    }

    const savedDarkMode = localStorage.getItem("darkMode");
    if (savedDarkMode === "enabled") {
        document.body.classList.add("dark");
        darkModeToggle.checked = true;
    }

    const savedKeyboardLayout = localStorage.getItem("keyboardLayout");
    if (savedKeyboardLayout === "azerty") {
        keyboardToggle.checked = true;
        activeLayout = "azerty";
        createKeyboard();
    } else {
        keyboardToggle.checked = false;
        activeLayout = "qwerty";
        createKeyboard();
    }

    const savedHintSetting = localStorage.getItem("hintEnabled");
    if (savedHintSetting === "enabled") {
        hintToggle.checked = true;
        if (currentRow === 0 && !hintUsedForCurrentGame && (!dailyGameCompleted || gameMode === 'free')) {
            hintButton.classList.remove("hidden");
        } else {
            hintButton.classList.add("hidden");
        }
    } else {
        hintToggle.checked = false;
        hintButton.classList.add("hidden");
    }
    
    const statsButton = document.getElementById("stats-btn");
    if (statsButton) {
        statsButton.addEventListener("click", () => {
            settingsModal.classList.add("hidden");
            showStatsOnlyPopup();
        });
    }
});

const body = document.body;
const settingsBtn = document.getElementById("settings-btn-line");
const helpBtn = document.getElementById("help-btn-line");
const modal = document.getElementById("modal");
const closeModalBtn = document.getElementById("close-modal");
const settingsModal = document.getElementById("settings-modal");
const closeSettingsBtn = document.getElementById("close-settings");
const darkModeToggle = document.getElementById("dark-mode-toggle");
const keyboardToggle = document.getElementById("keyboard-toggle");

helpBtn.addEventListener("click", () => {
    modal.classList.remove("hidden");
});
closeModalBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
});

settingsBtn.addEventListener("click", () => {
    settingsModal.classList.remove("hidden");
});
closeSettingsBtn.addEventListener("click", () => {
    settingsModal.classList.add("hidden");
});

darkModeToggle.addEventListener("change", () => {
    if (darkModeToggle.checked) {
        body.classList.add("dark");
        localStorage.setItem("darkMode", "enabled");
    } else {
        body.classList.remove("dark");
        localStorage.setItem("darkMode", "disabled");
    }
});

keyboardToggle.addEventListener("change", () => {
    if (keyboardToggle.checked) {
        activeLayout = "azerty";
    } else {
        activeLayout = "qwerty";
    }
    localStorage.setItem("keyboardLayout", activeLayout);
    createKeyboard();
});

hintToggle.addEventListener("change", () => {
    if (hintToggle.checked) {
        localStorage.setItem("hintEnabled", "enabled");
        if (currentRow === 0 && !hintUsedForCurrentGame && (!dailyGameCompleted || gameMode === 'free')) {
            hintButton.classList.remove("hidden");
        }
    } else {
        localStorage.setItem("hintEnabled", "disabled");
        hintButton.classList.add("hidden");
    }
});

hintButton.addEventListener("click", async () => {
    if (currentRow === 0 && !hintUsedForCurrentGame && (!dailyGameCompleted || gameMode === 'free')) {
        const firstLetter = targetWord[0];
        currentGuess = firstLetter;

        const cell = grid.children[0];

        cell.classList.add("flip-in");
        await new Promise(r => setTimeout(r, 300));

        cell.textContent = firstLetter.toUpperCase();
        cell.className = "cell";
        cell.classList.add("correct");

        cell.classList.add("flip-out");
        await new Promise(r => setTimeout(r, 150));
        cell.classList.remove("flip-in", "flip-out");

        const keyButtons = document.querySelectorAll(".key");
        keyButtons.forEach(button => {
            if (button.textContent.toLowerCase() === firstLetter) {
                button.classList.remove("correct", "present", "absent");
                button.classList.add("correct");
                keyStatuses[firstLetter] = "correct";
            }
        });

        hintUsedForCurrentGame = true;
        hintButton.classList.add("hidden");
    }
});

window.addEventListener("click", (event) => {
    if (event.target === settingsModal) {
        settingsModal.classList.add("hidden");
    }
    if (event.target === modal) {
        modal.classList.add("hidden");
    }
});

document.addEventListener("keydown", (event) => {
    const key = event.key.toLowerCase();

    if (key === "enter") {
        event.preventDefault();
        handleKey("enter");
    } else if (key === "backspace") {
        event.preventDefault();
        handleKey("backspace");
    } else if (/^[a-z]$/.test(key)) {
        handleKey(key);
    }
});

document.addEventListener("DOMContentLoaded", () => {
    const popupOverlay = document.getElementById("popupOverlay");
    if (popupOverlay && popupOverlay.parentElement !== document.body) {
        document.body.appendChild(popupOverlay);
    }
});

function startFreshGame() {
    gameMode = 'free';
    dailyGameCompleted = false;
    hidePopup();
    resetGame();
    
    const closeButton = document.getElementById('closePopupButton');
    closeButton.innerHTML = '<img src="assets/img/arrow.svg" alt="close popup icon" class="svg-popup-normal">';
}

function returnFromStats() {
    hidePopup();
    
    const closeButton = document.getElementById('closePopupButton');
    closeButton.innerHTML = '<img src="assets/img/arrow.svg" alt="close popup icon" class="svg-popup-normal">';
}
