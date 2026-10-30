
// ==========================================
// DICTIOSAVE - MAIN APPLICATION
// Reliable vocabulary learning application
// ==========================================

"use strict";

const STORAGE_KEY = "dictiosave_words_v1";
const SCORE_KEY = "dictiosave_quiz_score_v1";

let words = loadWords();
let quizQuestions = [];
let quizIndex = 0;
let quizScore = 0;
let quizAnswered = false;
let flashIndex = 0;
let flashFlipped = false;

// ==========================================
// STORAGE
// ==========================================

function loadWords() {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) || "[]"
    );

    if (!Array.isArray(saved)) return [];

    return saved
      .filter(item =>
        item &&
        typeof item.english === "string" &&
        typeof item.translation === "string"
      )
      .map((item, index) => ({
        id: item.id ?? (Date.now() + index),
        english: item.english.trim(),
        translation: item.translation.trim(),
        example: typeof item.example === "string"
          ? item.example : "",
        learned: Boolean(item.learned),
        createdAt: item.createdAt || new Date().toISOString()
      }))
      .filter(item => item.english && item.translation);

  } catch (error) {
    console.error("Loading error:", error);
    return [];
  }
}

function saveData() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(words)
    );

    updateStats();
    return true;

  } catch (error) {
    console.error("Saving error:", error);
    alert("Unable to save data. Check browser storage.");
    return false;
  }
}

function getQuizTotalCorrect() {
  try {
    return Number(localStorage.getItem(SCORE_KEY)) || 0;
  } catch {
    return 0;
  }
}

function createWordId() {
  if (window.crypto &&
      typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return Date.now() + "-" +
    Math.random().toString(16).slice(2);
}

// ==========================================
// NAVIGATION
// ==========================================

function showPage(page) {
  const target = document.getElementById("page-" + page);

  if (!target) return;

  document.querySelectorAll(".page").forEach(element => {
    element.classList.remove("active");
  });

  document.querySelectorAll(".nav-item[data-page]").forEach(element => {
    element.classList.toggle(
      "active",
      element.dataset.page === page
    );
  });

  target.classList.add("active");

  const names = {
    words: "My Words",
    flashcards: "Flashcards",
    quiz: "Quiz",
    stats: "Statistics",
    settings: "Settings"
  };

  document.getElementById("breadcrumb").textContent =
    names[page] || page;

  if (page === "words") renderWords();
  if (page === "flashcards") renderFlashcard();
  if (page === "stats") updateStats();

  document.getElementById("sidebar").classList.remove("open");
}

function toggleSidebar() {
  document.getElementById("sidebar")
    ?.classList.toggle("open");
}

// ==========================================
// ADD / EDIT MODAL
// ==========================================

function openModal(id = null) {
  const modal = document.getElementById("wordModal");
  const form = document.getElementById("wordForm");

  if (!modal || !form) return;

  form.reset();

  document.getElementById("editId").value = "";

  document.getElementById("modalTitle").textContent =
    "Add new word";

  if (id !== null) {
    const word = words.find(
      item => String(item.id) === String(id)
    );

    if (!word) return;

    document.getElementById("editId").value =
      String(word.id);

    document.getElementById("englishWord").value =
      word.english;

    document.getElementById("uzbekWord").value =
      word.translation;

    document.getElementById("exampleWord").value =
      word.example || "";

    document.getElementById("modalTitle").textContent =
      "Edit word";
  }

  modal.classList.add("open");

  document.getElementById("englishWord").focus();
}

function closeModal() {
  document.getElementById("wordModal")
    ?.classList.remove("open");
}

function overlayClose(event) {
  if (event.target.id === "wordModal") {
    closeModal();
  }
}

// ==========================================
// SAVE WORD
// ==========================================

function saveWord(event) {
  event.preventDefault();

  const id = document.getElementById("editId").value;

  const english = document.getElementById(
    "englishWord"
  ).value.trim();

  const translation = document.getElementById(
    "uzbekWord"
  ).value.trim();

  const example = document.getElementById(
    "exampleWord"
  ).value.trim();

  if (!english || !translation) {
    alert("Please enter both words and translation.");
    return;
  }

  const duplicate = words.find(item =>
    item.english.toLowerCase() === english.toLowerCase() &&
    String(item.id) !== String(id)
  );

  if (duplicate) {
    alert("This word already exists!");
    return;
  }

  if (id) {
    const index = words.findIndex(
      item => String(item.id) === String(id)
    );

    if (index === -1) {
      alert("Word not found. Please refresh.");
      return;
    }

    words[index] = {
      ...words[index],
      english,
      translation,
      example
    };

  } else {
    words.unshift({
      id: createWordId(),
      english,
      translation,
      example,
      learned: false,
      createdAt: new Date().toISOString()
    });
  }

  if (saveData()) {
    renderWords();
    renderFlashcard();
    closeModal();
  }
}

// ==========================================
// DELETE WORD
// ==========================================

function deleteWord(id) {
  const word = words.find(
    item => String(item.id) === String(id)
  );

  if (!word) return;

  if (!confirm(`Delete "${word.english}"?`)) {
    return;
  }

  words = words.filter(
    item => String(item.id) !== String(id)
  );

  if (flashIndex >= words.length) {
    flashIndex = Math.max(0, words.length - 1);
  }

  flashFlipped = false;

  saveData();
  renderWords();
  renderFlashcard();
}

// ==========================================
// LEARNED STATUS
// ==========================================

function toggleLearned(id) {
  const word = words.find(
    item => String(item.id) === String(id)
  );

  if (!word) return;

  word.learned = !word.learned;

  saveData();
  renderWords();
  renderFlashcard();
}

// ==========================================
// HTML SECURITY
// ==========================================

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  })[character]);
}

// ==========================================
// RENDER WORDS
// ==========================================

function renderWords() {
  const grid = document.getElementById("wordGrid");

  if (!grid) return;

  const search = (
    document.getElementById("searchInput")?.value || ""
  ).toLowerCase().trim();

  const filter =
    document.getElementById("filterWords")?.value || "all";

  const filtered = words.filter(word => {

    const matchesSearch =
      word.english.toLowerCase().includes(search) ||
      word.translation.toLowerCase().includes(search) ||
      (word.example || "").toLowerCase().includes(search);

    const matchesFilter =
      filter === "all" ||
      (filter === "learned" && word.learned) ||
      (filter === "learning" && !word.learned);

    return matchesSearch && matchesFilter;
  });

  document.getElementById("wordCount").textContent =
    `${filtered.length} ${
      filtered.length === 1 ? "word" : "words"
    }`;

  if (!filtered.length) {

    const hasWords = words.length > 0;

    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📚</div>

        <h3>
          ${hasWords
            ? "No words found"
            : "Your vocabulary is empty"}
        </h3>

        <p>
          ${hasWords
            ? "Try changing your search."
            : "Start building your vocabulary."}
        </p>

        ${hasWords
          ? ""
          : '<button class="primary-btn" onclick="openModal()">＋ Add your first word</button>'}
      </div>
    `;

    updateStats();
    return;
  }

  grid.innerHTML = filtered.map(word => `
    <article class="word-card">

      <div class="word-card-top">
        <div>
          <h3>${escapeHTML(word.english)}</h3>

          <p class="word-translation">
            ${escapeHTML(word.translation)}
          </p>
        </div>

        <span class="status ${word.learned ? "learned" : ""}">
          ${word.learned ? "✓ Learned" : "Learning"}
        </span>
      </div>

      ${word.example ? `
        <p class="word-example">
          "${escapeHTML(word.example)}"
        </p>
      ` : ""}

      <div class="word-actions">

        <button class="icon-btn"
          onclick="toggleLearned('${escapeHTML(word.id)}')">
          ${word.learned ? "↶ Learning" : "✓ Learned"}
        </button>

        <button class="icon-btn"
          onclick="openModal('${escapeHTML(word.id)}')">
          ✎ Edit
        </button>

        <button class="icon-btn delete"
          onclick="deleteWord('${escapeHTML(word.id)}')">
          ✕
        </button>

      </div>
    </article>
  `).join("");

  updateStats();
}

// ==========================================
// STATISTICS
// ==========================================

function updateStats() {
  const total = words.length;

  const learned = words.filter(
    word => word.learned
  ).length;

  const remaining = total - learned;

  const percent = total
    ? Math.round(learned / total * 100)
    : 0;

  const correct = getQuizTotalCorrect();

  const values = {
    totalWords: total,
    learnedWords: learned,
    remainingWords: remaining,
    statsTotal: total,
    statsLearned: learned,
    statsCorrect: correct,
    statsPercent: percent + "%"
  };

  Object.entries(values).forEach(([id, value]) => {
    const element = document.getElementById(id);

    if (element) {
      element.textContent = value;
    }
  });

  const progress = document.getElementById(
    "statsProgress"
  );

  if (progress) {
    progress.style.width = percent + "%";
  }
}

// ==========================================
// FLASHCARDS
// ==========================================

function renderFlashcard() {
  const wordElement =
    document.getElementById("flashWord");

  const translationElement =
    document.getElementById("flashTranslation");

  const label =
    document.getElementById("flashLabel");

  const position =
    document.getElementById("flashPosition");

  const progress =
    document.getElementById("flashProgress");

  if (!wordElement || !translationElement || !label) {
    return;
  }

  if (!words.length) {
    wordElement.textContent = "No words yet";

    translationElement.textContent =
      "Add words to start learning";

    label.textContent = "YOUR VOCABULARY";

    if (position) position.textContent = "0 / 0";
    if (progress) progress.style.width = "0%";

    return;
  }

  if (flashIndex >= words.length) flashIndex = 0;
  if (flashIndex < 0) flashIndex = words.length - 1;

  const word = words[flashIndex];

  wordElement.textContent = flashFlipped
    ? word.translation
    : word.english;

  translationElement.textContent = flashFlipped
    ? word.english
    : "Think about the meaning...";

  label.textContent = flashFlipped
    ? "TRANSLATION"
    : "ENGLISH WORD";

  if (position) {
    position.textContent =
      `${flashIndex + 1} / ${words.length}`;
  }

  if (progress) {
    progress.style.width =
      ((flashIndex + 1) / words.length * 100) + "%";
  }
}

function flipCard() {
  if (!words.length) return;

  flashFlipped = !flashFlipped;
  renderFlashcard();
}

function nextCard() {
  if (!words.length) return;

  flashIndex = (flashIndex + 1) % words.length;
  flashFlipped = false;

  renderFlashcard();
}

function previousCard() {
  if (!words.length) return;

  flashIndex =
    (flashIndex - 1 + words.length) % words.length;

  flashFlipped = false;

  renderFlashcard();
}

// ==========================================
// QUIZ
// ==========================================

function startQuiz() {

  if (words.length < 2) {
    alert("Add at least 2 words to start the quiz.");
    return;
  }

  quizQuestions = [...words].sort(
    () => Math.random() - 0.5
  );

  quizIndex = 0;
  quizScore = 0;
  quizAnswered = false;

  const startButton =
    document.getElementById("startQuiz");

  const content =
    document.getElementById("quizContent");

  startButton.style.display = "none";

  content.innerHTML = `
    <div class="quiz-question">
      <span class="eyebrow">
        TRANSLATE THIS WORD
      </span>

      <h2 id="quizWord">Ready?</h2>

      <p>Select the correct translation below.</p>
    </div>

    <div class="answers" id="quizAnswers"></div>

    <div class="quiz-footer">
      <span id="quizFeedback">
        Choose your answer.
      </span>

      <button class="primary-btn"
        id="nextQuestion"
        onclick="nextQuestion()"
        disabled>
        Next →
      </button>
    </div>
  `;

  content.style.display = "block";

  renderQuestion();
}

function renderQuestion() {
  const current = quizQuestions[quizIndex];

  if (!current) return;

  quizAnswered = false;

  document.getElementById("quizNumber").textContent =
    `Question ${quizIndex + 1} / ${quizQuestions.length}`;

  document.getElementById("quizScore").textContent =
    `Score: ${quizScore}`;

  document.getElementById("quizProgress").style.width =
    (quizIndex / quizQuestions.length * 100) + "%";

  document.getElementById("quizWord").textContent =
    current.english;

  document.getElementById("quizFeedback").textContent =
    "Choose your answer.";

  document.getElementById("nextQuestion").disabled = true;

  const distractors = words
    .filter(word =>
      String(word.id) !== String(current.id)
    )
    .sort(() => Math.random() - 0.5)
    .map(word => word.translation);

  const options = [
    ...new Set([
      current.translation,
      ...distractors
    ])
  ]
    .sort(() => Math.random() - 0.5)
    .slice(0, 4);

  const answers =
    document.getElementById("quizAnswers");

  answers.innerHTML = "";

  options.forEach((option, index) => {

    const button = document.createElement("button");

    button.type = "button";
    button.className = "answer-btn";
    button.dataset.answer = option;

    const letter = document.createElement("b");

    letter.textContent =
      String.fromCharCode(65 + index) + ". ";

    button.appendChild(letter);

    button.appendChild(
      document.createTextNode(option)
    );

    button.addEventListener("click", () => {
      checkAnswer(button, option);
    });

    answers.appendChild(button);
  });
}

function checkAnswer(button, answer) {
  if (quizAnswered) return;

  quizAnswered = true;

  const current = quizQuestions[quizIndex];

  const correct = answer === current.translation;

  if (correct) {
    quizScore++;

    document.getElementById("quizFeedback").textContent =
      "✓ Correct answer!";

    try {
      localStorage.setItem(
        SCORE_KEY,
        String(getQuizTotalCorrect() + 1)
      );
    } catch (error) {
      console.error("Quiz score saving error:", error);
    }

  } else {
    document.getElementById("quizFeedback").textContent =
      `✕ Correct answer: ${current.translation}`;
  }

  document.querySelectorAll(".answer-btn").forEach(btn => {

    btn.disabled = true;

    if (btn.dataset.answer === current.translation) {
      btn.classList.add("correct");
    }
  });

  if (!correct) {
    button.classList.add("wrong");
  }

  document.getElementById("quizScore").textContent =
    `Score: ${quizScore}`;

  document.getElementById("nextQuestion").disabled =
    false;

  updateStats();
}

function nextQuestion() {
  if (!quizAnswered) return;

  quizIndex++;

  if (quizIndex >= quizQuestions.length) {
    showQuizResult();
    return;
  }

  renderQuestion();
}

function showQuizResult() {
  document.getElementById("quizProgress").style.width =
    "100%";

  document.getElementById("quizNumber").textContent =
    "Quiz completed!";

  document.getElementById("quizScore").textContent =
    `Score: ${quizScore}`;

  document.getElementById("quizContent").innerHTML = `
    <div class="quiz-question">

      <div style="font-size:45px">🎉</div>

      <h2>Great job!</h2>

      <p>You completed the vocabulary quiz.</p>

      <h2 style="color:#7e22ce;margin-top:25px">
        ${quizScore} / ${quizQuestions.length}
      </h2>

      <p>Correct answers</p>

    </div>
  `;

  const startButton =
    document.getElementById("startQuiz");

  startButton.textContent = "Try Again";
  startButton.style.display = "block";
}

// ==========================================
// EXPORT VOCABULARY
// ==========================================

function exportWords() {
  if (!words.length) {
    alert("There are no words to export.");
    return;
  }

  const blob = new Blob(
    [JSON.stringify(words, null, 2)],
    { type: "application/json" }
  );

  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");

  link.href = url;
  link.download = "dictiosave-vocabulary.json";

  document.body.appendChild(link);

  link.click();
  link.remove();

  URL.revokeObjectURL(url);
}

// ==========================================
// IMPORT VOCABULARY
// ==========================================

function importWords() {
  document.getElementById("importFile")?.click();
}

function handleImport(event) {
  const file = event.target.files?.[0];

  if (!file) return;

  const reader = new FileReader();

  reader.onload = () => {
    try {
      const imported = JSON.parse(reader.result);

      if (!Array.isArray(imported)) {
        throw new Error("Invalid JSON format");
      }

      const valid = imported.filter(item =>
        item &&
        typeof item.english === "string" &&
        typeof item.translation === "string" &&
        item.english.trim() &&
        item.translation.trim()
      );

      if (!valid.length) {
        alert("No valid vocabulary found.");
        return;
      }

      let added = 0;

      valid.forEach(item => {

        const normalized =
          item.english.trim().toLowerCase();

        const exists = words.some(existing =>
          existing.english.toLowerCase() === normalized
        );

        if (!exists) {
          words.push({
            id: createWordId(),
            english: item.english.trim(),
            translation: item.translation.trim(),
            example: typeof item.example === "string"
              ? item.example : "",
            learned: Boolean(item.learned),
            createdAt: item.createdAt ||
              new Date().toISOString()
          });

          added++;
        }
      });

      saveData();
      renderWords();
      renderFlashcard();

      alert(
        `Import complete. ${added} new word(s) added.`
      );

    } catch (error) {
      console.error("Import error:", error);

      alert(
        "Unable to import. Select a valid DictioSave JSON file."
      );

    } finally {
      event.target.value = "";
    }
  };

  reader.onerror = () => {
    alert("The selected file could not be read.");
    event.target.value = "";
  };

  reader.readAsText(file);
}

// ==========================================
// CLEAR ALL WORDS
// ==========================================

function clearWords() {
  if (!confirm(
    "Are you sure you want to delete ALL vocabulary? This cannot be undone unless you exported a backup."
  )) {
    return;
  }

  words = [];

  flashIndex = 0;
  flashFlipped = false;

  saveData();

  renderWords();
  renderFlashcard();

  alert("All vocabulary has been deleted.");
}

// ==========================================
// INITIALIZE APPLICATION
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

  const quizContent =
    document.getElementById("quizContent");

  if (quizContent) {
    quizContent.style.display = "none";
  }

  updateStats();

  renderWords();

  renderFlashcard();

  console.log("DictioSave successfully initialized!");
});
