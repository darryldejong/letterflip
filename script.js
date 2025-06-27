import VALID_WORDS from './valid_words.js';

const WORD_LENGTH = 5;
const MAX_GUESSES = 6;
let targetWord = VALID_WORDS[Math.floor(Math.random() * VALID_WORDS.length)];

const grid = document.getElementById("grid");
const message = document.getElementById("message");

const popupOverlay = document.getElementById('popupOverlay');
const popupMessage = document.getElementById('popupMessage');
const closePopupButton = document.getElementById('closePopupButton');


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

function setMessage(text) {
    message.textContent = text;
}

function showPopup(messageText) {
    popupMessage.innerHTML = messageText;
    popupOverlay.classList.add('show');
}

function hidePopup() {
    popupOverlay.classList.remove('show');
}

closePopupButton.addEventListener('click', () => {
    hidePopup();
    resetGame();
});
popupOverlay.addEventListener('click', (e) => {
    if (e.target === popupOverlay) {
        hidePopup();
        resetGame();
    }
});

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
    targetWord = VALID_WORDS[Math.floor(Math.random() * VALID_WORDS.length)];
    currentGuess = "";
    currentRow = 0;
    for (const key in keyStatuses) {
        delete keyStatuses[key];
    }
    createGrid();
    createKeyboard();
    setMessage("");

    hintUsedForCurrentGame = false;
    const hintEnabled = localStorage.getItem("hintEnabled") === "enabled";
    if (hintEnabled && currentRow === 0) {
        hintButton.classList.remove("hidden");
    } else {
        hintButton.classList.add("hidden");
    }
}

function handleKey(key) {
    if (isChecking) return;
    if (key === "enter") {
        if (currentGuess.length !== WORD_LENGTH) {
            setMessage("Vul eerst 5 letters in.");
            return;
        }
        if (!VALID_WORDS.includes(currentGuess)) {
            setMessage("Dit woord staat niet in de lijst.");
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
                showPopup("Gefeliciteerd! Je hebt het woord geraden.");
                disableKeyboard();
                setTimeout(() => {
                    hidePopup();
                    resetGame();
                    isChecking = false;
                }, 60000);
                return;
            }

            currentRow++;
            currentGuess = "";

            if (currentRow >= MAX_GUESSES) {
              const messageText = `<span class="message-text">Helaas, het woord was: </span>`;
                const formattedWord = `<span class="failed">${targetWord.charAt(0).toUpperCase() + targetWord.slice(1)}</span><hr>`;
                showPopup(messageText + formattedWord);
                disableKeyboard();
                setTimeout(() => {
                    hidePopup();
                    resetGame();
                    isChecking = false;
                }, 60000);
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
    createGrid();
    createKeyboard();
    updateGridRow(0, "");
    setMessage("");

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
        if (currentRow === 0 && !hintUsedForCurrentGame) {
            hintButton.classList.remove("hidden");
        } else {
            hintButton.classList.add("hidden");
        }
    } else {
        hintToggle.checked = false;
        hintButton.classList.add("hidden");
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
        if (currentRow === 0 && !hintUsedForCurrentGame) {
            hintButton.classList.remove("hidden");
        }
    } else {
        localStorage.setItem("hintEnabled", "disabled");
        hintButton.classList.add("hidden");
    }
});

hintButton.addEventListener("click", async () => {
    if (currentRow === 0 && !hintUsedForCurrentGame) {
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
