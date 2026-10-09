const answerKey = {};

const matchingQuestions = {};

const els = {
  startScreen: document.querySelector("#startScreen"),
  quizScreen: document.querySelector("#quizScreen"),
  resultsScreen: document.querySelector("#resultsScreen"),
  questionCount: document.querySelector("#questionCount"),
  timerMode: document.querySelector("#timerMode"),
  topicSelect: document.querySelector("#topicSelect"),
  topicSelectButton: document.querySelector("#topicSelectButton"),
  topicSelectMenu: document.querySelector("#topicSelectMenu"),
  fillBlankMode: document.querySelector("#fillBlankMode"),
  definitionMode: document.querySelector("#definitionMode"),
  identificationMode: document.querySelector("#identificationMode"),
  enumerationMode: document.querySelector("#enumerationMode"),
  startBtn: document.querySelector("#startBtn"),
  soundToggle: document.querySelector("#soundToggle"),
  quitBtn: document.querySelector("#quitBtn"),
  nextBtn: document.querySelector("#nextBtn"),
  restartBtn: document.querySelector("#restartBtn"),
  retryMissedBtn: document.querySelector("#retryMissedBtn"),
  bankSize: document.querySelector("#bankSize"),
  topicLabel: document.querySelector("#topicLabel"),
  questionProgress: document.querySelector("#questionProgress"),
  score: document.querySelector("#score"),
  streak: document.querySelector("#streak"),
  timer: document.querySelector("#timer"),
  progressBar: document.querySelector("#progressBar"),
  topicBadge: document.querySelector("#topicBadge"),
  multiBadge: document.querySelector("#multiBadge"),
  questionText: document.querySelector("#questionText"),
  answers: document.querySelector("#answers"),
  feedback: document.querySelector("#feedback"),
  finalTitle: document.querySelector("#finalTitle"),
  finalScore: document.querySelector("#finalScore"),
  finalDetails: document.querySelector("#finalDetails"),
  reviewList: document.querySelector("#reviewList")
};

const state = {
  allQuestions: [],
  session: [],
  missed: [],
  index: 0,
  score: 0,
  streak: 0,
  selected: new Set(),
  answered: false,
  topics: new Set(["all"]),
  timerSeconds: 30,
  tick: null,
  timeLeft: 30,
  typedAnswer: "",
  soundOn: true
};

const normalize = (value) => value.replace(/\s+/g, " ").trim().toLowerCase();

const audio = {
  clips: null,
  unlocked: false,
  notice: null,
  prepare() {
    if (this.clips) return;
    const definitions = {
      click: [[520, 0.05, "square", 0.24]],
      start: [[392, 0.08, "triangle", 0.34], [523.25, 0.08, "triangle", 0.34], [659.25, 0.08, "triangle", 0.34], [783.99, 0.12, "triangle", 0.34]],
      correct: [[523.25, 0.09, "triangle", 0.36], [659.25, 0.09, "triangle", 0.36], [783.99, 0.1, "triangle", 0.36], [1046.5, 0.16, "triangle", 0.34]],
      wrong: [[220, 0.14, "saw", 0.38], [164.81, 0.22, "saw", 0.34]],
      tick: [[880, 0.055, "square", 0.22]],
      finishGood: [[392, 0.1, "triangle", 0.34], [493.88, 0.1, "triangle", 0.34], [587.33, 0.12, "triangle", 0.34], [783.99, 0.18, "triangle", 0.34]],
      finishLow: [[349.23, 0.13, "triangle", 0.3], [293.66, 0.13, "triangle", 0.3], [261.63, 0.2, "triangle", 0.28]]
    };
    this.clips = Object.fromEntries(
      Object.entries(definitions).map(([name, notes]) => {
        const clip = new Audio(makeWavUrl(notes));
        clip.preload = "auto";
        clip.volume = 1;
        return [name, clip];
      })
    );
  },
  unlock() {
    if (!state.soundOn || this.unlocked) return;
    this.prepare();
    const clip = this.clips.click;
    clip.muted = true;
    clip.currentTime = 0;
    const playAttempt = clip.play();
    if (!playAttempt) {
      clip.pause();
      clip.muted = false;
      this.unlocked = true;
      return;
    }
    playAttempt
      .then(() => {
        clip.pause();
        clip.currentTime = 0;
        clip.muted = false;
        this.unlocked = true;
        this.hideNotice();
      })
      .catch(() => this.showNotice());
  },
  play(name) {
    if (!state.soundOn) return;
    this.prepare();
    const source = this.clips[name];
    if (!source) return;
    const clip = source.cloneNode();
    clip.volume = 1;
    const playAttempt = clip.play();
    if (playAttempt) playAttempt.catch(() => this.showNotice());
  },
  vibrate(pattern) {
    if (state.soundOn && navigator.vibrate) navigator.vibrate(pattern);
  },
  showNotice() {
    if (!this.notice) {
      this.notice = document.createElement("button");
      this.notice.className = "sound-notice";
      this.notice.type = "button";
      this.notice.textContent = "Tap to enable sound";
      this.notice.addEventListener("click", () => {
        this.unlocked = false;
        this.unlock();
        this.play("click");
      });
      document.body.append(this.notice);
    }
    this.notice.classList.add("visible");
  },
  hideNotice() {
    if (this.notice) this.notice.classList.remove("visible");
  },
  click() {
    this.play("click");
  },
  start() {
    this.unlock();
    this.play("start");
    this.vibrate(18);
  },
  correct() {
    this.play("correct");
    this.vibrate([20, 35, 20]);
  },
  wrong() {
    this.play("wrong");
    this.vibrate(90);
  },
  tick() {
    this.play("tick");
    this.vibrate(10);
  },
  finish(percent) {
    this.play(percent >= 70 ? "finishGood" : "finishLow");
  }
};

function makeWavUrl(notes) {
  const sampleRate = 44100;
  const gapSamples = Math.floor(sampleRate * 0.025);
  const samples = [];

  notes.forEach(([frequency, duration, type, volume]) => {
    const sampleCount = Math.floor(sampleRate * duration);
    for (let i = 0; i < sampleCount; i += 1) {
      const t = i / sampleRate;
      const phase = (t * frequency) % 1;
      let wave = Math.sin(2 * Math.PI * frequency * t);
      if (type === "square") wave = phase < 0.5 ? 1 : -1;
      if (type === "saw") wave = 2 * phase - 1;
      if (type === "triangle") wave = 1 - 4 * Math.abs(Math.round(phase - 0.25) - (phase - 0.25));
      const attack = Math.min(1, i / Math.max(1, sampleRate * 0.01));
      const release = Math.min(1, (sampleCount - i) / Math.max(1, sampleRate * 0.04));
      samples.push(wave * volume * Math.min(attack, release));
    }
    for (let i = 0; i < gapSamples; i += 1) samples.push(0);
  });

  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);
  writeString(view, 0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(view, 8, "WAVE");
  writeString(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(view, 36, "data");
  view.setUint32(40, samples.length * 2, true);

  samples.forEach((sample, index) => {
    const value = Math.max(-1, Math.min(1, sample));
    view.setInt16(44 + index * 2, value < 0 ? value * 0x8000 : value * 0x7fff, true);
  });

  return URL.createObjectURL(new Blob([view], { type: "audio/wav" }));
}

function writeString(view, offset, value) {
  for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
}

["pointerdown", "touchstart", "keydown"].forEach((eventName) => {
  window.addEventListener(eventName, () => audio.unlock(), { once: true });
});

function topicFor(block) {
  if (/ICT4D|digital divide|digital literacy|income levels|geographical restrictions/i.test(block)) return "ICT4D";
  if (/Authoritarianism|Soviet|Libertarianism|Social Responsibility|theory of the press/i.test(block)) return "Press Theories";
  if (/Cultural Imperialism|Participatory|Entertainment-Education|Freire/i.test(block)) return "DevComm Theories";
  if (/writing|framing|humanization|visual storytelling|ethical reporting|documentary/i.test(block)) return "Writing";
  return "Development Journalism";
}

function parseQuestions(source) {
  return source
    .split(/\r?\n(?=\d+\.\s)/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const number = Number(block.match(/^(\d+)\./)?.[1]);
      const explanationIndex = block.indexOf("\nExplanation:");
      const beforeExplanation = explanationIndex >= 0 ? block.slice(0, explanationIndex) : block;
      const explanation = explanationIndex >= 0 ? block.slice(explanationIndex + 1).trim() : "";
      const lines = beforeExplanation.split(/\r?\n/);
      const cleanLines = lines.map((line) => line.trimEnd());
      const choiceLines = [];

      while (cleanLines.length && cleanLines[cleanLines.length - 1].trim() === "") cleanLines.pop();
      while (cleanLines.length) {
        const line = cleanLines.pop();
        if (line.trim() === "") break;
        choiceLines.unshift(line.trim());
      }

      const filteredChoices = choiceLines.filter((choice) => {
        const low = choice.toLowerCase();
        return choice && low !== "freestar" && low !== "copy" && low !== "icon" && !/file\(s\)/i.test(choice);
      });

      const question = cleanLines.join("\n").trim() || beforeExplanation.trim();
      const answers = answerKey[number] || [];
      const matching = matchingQuestions[number] || null;
      const gradable = Boolean(matching) || (answers.length > 0 && filteredChoices.length > 0);

      return {
        number,
        topic: topicFor(block),
        question,
        choices: filteredChoices,
        answers,
        matching,
        explanation,
        gradable,
        raw: block
      };
    });
}

function shuffle(items) {
  return [...items].sort(() => Math.random() - 0.5);
}

function showOnly(screen) {
  [els.startScreen, els.quizScreen, els.resultsScreen].forEach((section) => section.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function filteredBaseBank() {
  let bank = state.allQuestions;
  if (!state.topics.has("all")) {
    bank = bank.filter((q) => state.topics.has(q.topic) || state.topics.has(q.module));
  }
  return bank;
}

function buildPracticeBank() {
  const base = filteredBaseBank();
  const extras = [];

  if (els.fillBlankMode.checked) {
    extras.push(...base.filter(canMakeTypedQuestion).map(makeFillBlankQuestion));
  }

  if (els.definitionMode.checked) {
    extras.push(...base.filter(canMakeDefinitionQuestion).map(makeDefinitionQuestion));
  }

  if (els.identificationMode.checked) {
    extras.push(...base.filter(canMakeIdentificationQuestion).map(makeIdentificationQuestion));
  }

  if (els.enumerationMode.checked) {
    extras.push(...base.filter(canMakeEnumerationQuestion).map(makeEnumerationQuestion));
  }

  return [...base, ...extras];
}

function updateBankSize() {
  if (!state.allQuestions.length) return;
  els.bankSize.textContent = buildPracticeBank().length;
}

function canMakeTypedQuestion(q) {
  return q.gradable && !q.matching && q.answers.length === 1 && shortTypedAnswers(q).length > 0;
}

function canMakeDefinitionQuestion(q) {
  if (!canMakeTypedQuestion(q)) return false;
  const answer = shortTypedAnswers(q)[0];
  const wordCount = answer.split(/\s+/).length;
  if (wordCount > 3 || answer.length > 32) return false;
  if (/[#]|access-list|Router\(|\d+\.\d+\.\d+\.\d+|\/\d+/i.test(answer)) return false;
  return definitionClue(q).length >= 35;
}

function canMakeIdentificationQuestion(q) {
  if (!canMakeTypedQuestion(q)) return false;
  const answer = shortTypedAnswers(q)[0];
  const wordCount = answer.split(/\s+/).length;
  return wordCount <= 3 && answer.length <= 32 && definitionClue(q).length >= 35;
}

function canMakeEnumerationQuestion(q) {
  const answers = enumerationAnswers(q);
  return q.gradable && answers.length >= 2 && answers.length <= 8;
}

function makeFillBlankQuestion(q) {
  const typedAnswers = shortTypedAnswers(q);
  return {
    ...q,
    id: `${q.id || `${q.module}-${q.number}`}-fill`,
    question: makeClozePrompt(q, typedAnswers) || `${q.question}\n\nType the correct answer.`,
    choices: [],
    matching: null,
    mode: "fill",
    typedAnswers,
    sourceMode: "Fill in the blanks"
  };
}

function makeClozePrompt(q, typedAnswers) {
  const candidates = [q.explanation, q.raw, q.question]
    .filter(Boolean)
    .flatMap((text) => splitSentences(text));
  const variants = [];

  typedAnswers.forEach((answer) => {
    candidates.forEach((sentence) => {
      const blanked = blankAnswer(sentence, answer);
      if (blanked !== sentence && blanked.includes("_____")) {
        variants.push(`${blanked}\n\nType the correct answer.`);
      }
    });
  });

  return variants.length ? shuffle(variants)[0] : "";
}

function splitSentences(text) {
  return text
    .replace(/^Explanation:\s*/i, "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.?!])\s+|\n+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 24 && sentence.length <= 220);
}

function makeDefinitionQuestion(q) {
  const answer = shortTypedAnswers(q)[0];
  return {
    ...q,
    id: `${q.id || `${q.module}-${q.number}`}-term`,
    question: `Definition of Terms\n\n${blankAnswer(definitionClue(q), answer)}`,
    choices: [],
    matching: null,
    mode: "definition",
    typedAnswers: shortTypedAnswers(q),
    sourceMode: "Definition of terms"
  };
}

function makeIdentificationQuestion(q) {
  return {
    ...q,
    id: `${q.id || `${q.module}-${q.number}`}-identification`,
    question: `Identification\n\n${definitionClue(q)}`,
    choices: [],
    matching: null,
    mode: "identification",
    typedAnswers: shortTypedAnswers(q),
    sourceMode: "Identification"
  };
}

function makeEnumerationQuestion(q) {
  const typedAnswers = enumerationAnswers(q);
  return {
    ...q,
    id: `${q.id || `${q.module}-${q.number}`}-enumeration`,
    question: `${q.question}\n\nEnumerate the answers. Separate each answer with a comma.`,
    choices: [],
    matching: null,
    mode: "enumeration",
    typedAnswers,
    sourceMode: "Enumeration"
  };
}

function shortTypedAnswers(q) {
  const answer = q.answers[0]?.trim();
  if (!answer) return [];

  const explicit = keywordAnswers(answer);
  if (explicit.length) return explicit;

  const cleaned = answer
    .replace(/^it\s+(requires|allows|provides|uses|connects|creates)\s+/i, "")
    .replace(/^(the|a|an)\s+/i, "")
    .replace(/[.?!]+$/g, "")
    .trim();
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length <= 3 && cleaned.length <= 32 && !/[#()]|access-list/i.test(cleaned)) return [cleaned];
  return [];
}

function enumerationAnswers(q) {
  if (q.matching) return [...new Set(Object.values(q.matching.answers || {}))].filter(Boolean);
  if (q.answers?.length > 1) return q.answers;
  return [];
}

function keywordAnswers(answer) {
  const rules = [
    [/Development Journalism/i, ["Development Journalism", "DevJourn"]],
    [/development support communication/i, ["development support communication"]],
    [/government say-so journalism/i, ["government say-so journalism"]],
    [/Press Foundation of Asia|\bPFA\b/i, ["Press Foundation of Asia", "PFA"]],
    [/Alan Chalkley/i, ["Alan Chalkley"]],
    [/Juan Mercado/i, ["Juan Mercado"]],
    [/Authoritarianism/i, ["Authoritarianism"]],
    [/Soviet Communist Theory/i, ["Soviet Communist Theory"]],
    [/Libertarianism/i, ["Libertarianism"]],
    [/Social Responsibility/i, ["Social Responsibility"]],
    [/Fifth Theory of the Press/i, ["Fifth Theory of the Press"]],
    [/Framing/i, ["Framing"]],
    [/Human impact/i, ["Human impact"]],
    [/Build Trust First/i, ["Build Trust First"]],
    [/Visual/i, ["Visual"]],
    [/Silent Colonization/i, ["Silent Colonization"]],
    [/Cultural Imperialism/i, ["Cultural Imperialism"]],
    [/Dialogue/i, ["Dialogue"]],
    [/Conscientization/i, ["Conscientization"]],
    [/Praxis/i, ["Praxis"]],
    [/Transformation/i, ["Transformation"]],
    [/Critical Consciousness/i, ["Critical Consciousness"]],
    [/Entertainment-Education/i, ["Entertainment-Education"]],
    [/ICT4D/i, ["ICT4D"]],
    [/digital divide/i, ["digital divide"]],
    [/Communication Planning/i, ["Communication Planning"]],
    [/Focused Audience/i, ["Focused Audience"]],
    [/Anti-Slavery Society/i, ["Anti-Slavery Society"]],
    [/Community Broadcasting/i, ["Community Broadcasting"]],
    [/Public Information Office|\bPIO\b/i, ["Public Information Office", "PIO"]]
  ];

  return rules.find(([pattern]) => pattern.test(answer))?.[1] || [];
}

function definitionClue(q) {
  return (q.explanation || q.question)
    .replace(/^Explanation:\s*/i, "")
    .replace(/Topic\s+\d+(?:\.\d+)*\s*/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function blankAnswer(text, answer) {
  const escaped = answer.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(escaped, "gi"), "_____");
}

function cleanQuestionPrompt(question) {
  return question
    .replace(/^\d+\.\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function questionClue(q) {
  const answers = q.answers?.length ? q.answers : q.typedAnswers || [];
  let clue = definitionClue(q);
  answers.forEach((answer) => {
    clue = blankAnswer(clue, answer);
  });
  return clue.replace(/\s+/g, " ").trim();
}

function answerPhrase(q) {
  const answers = q.answers?.length ? q.answers : q.typedAnswers || [];
  if (!answers.length) return "";
  if (answers.length === 1) return answers[0];
  if (answers.length === 2) return `${answers[0]} and ${answers[1]}`;
  return `${answers.slice(0, -1).join(", ")}, and ${answers[answers.length - 1]}`;
}

function makeQuestionVariant(q) {
  if (!q.gradable || q.mode || q.matching) {
    if (!q.matching) return { ...q };
    const matchingPrompts = [
      q.question,
      `${cleanQuestionPrompt(q.question)}\n\nMatch each item to the reviewer wording.`,
      `Use the reviewer notes to match these related ideas.\n\n${cleanQuestionPrompt(q.question)}`
    ];
    return { ...q, question: shuffle(matchingPrompts)[0] };
  }

  const answers = q.answers || [];
  const clue = questionClue(q);
  const prompt = cleanQuestionPrompt(q.question);
  const sourceSentence = splitSentences(q.raw || q.explanation || "").find((sentence) => sentence.length >= 28) || clue;
  const variants = [q.question];

  if (answers.length === 1) {
    const blankedSource = blankAnswer(sourceSentence, answers[0]);
    if (blankedSource.includes("_____")) {
      variants.push(
        `Which answer best completes this reviewer idea?\n\n${blankedSource}`,
        `A classmate says: "${blankedSource}"\n\nWhich option correctly fills the blank?`
      );
    }
    if (clue.includes("_____")) {
      variants.push(
        `Based on the reviewer, identify the concept or answer:\n\n${clue}`,
        `What does this reviewer note point to?\n\n${clue}`
      );
    }
    variants.push(`Answer this reviewer check in a different form:\n\n${prompt}`);
  } else if (answers.length > 1) {
    variants.push(
      `Which choices belong with this reviewer idea?\n\n${prompt}`,
      `Select every answer that correctly completes the reviewer note:\n\n${questionClue(q)}`,
      `A reviewer summary points to ${answers.length} correct items: ${answerPhrase(q).replace(/./g, "_").slice(0, Math.min(64, answerPhrase(q).length))}\n\nChoose the matching items from the options.`,
      `Which ${answers.length} items are supported by the PDF notes?\n\n${prompt}`
    );
  }

  return { ...q, question: shuffle(variants.filter(Boolean))[0] };
}

function buildSession(source = null) {
  const bank = source || buildPracticeBank();

  const requested = els.questionCount.value;
  const count = requested === "all" ? bank.length : Number(requested);
  state.session = shuffle(bank).slice(0, count).map(makeQuestionVariant);
  state.index = 0;
  state.missed = [];
  state.score = 0;
  state.streak = 0;
  state.answered = false;
  state.timerSeconds = Number(els.timerMode.value);
}

function startQuiz(source = null) {
  audio.start();
  buildSession(source);
  showOnly(els.quizScreen);
  renderQuestion();
}

function stopTimer() {
  if (state.tick) clearInterval(state.tick);
  state.tick = null;
}

function startTimer() {
  stopTimer();
  state.timeLeft = state.timerSeconds;
  els.timer.textContent = state.timerSeconds === 0 ? "∞" : state.timeLeft;
  if (state.timerSeconds === 0) return;

  state.tick = setInterval(() => {
    state.timeLeft -= 1;
    els.timer.textContent = state.timeLeft;
    if (state.timeLeft <= 5 && state.timeLeft > 0) audio.tick();
    if (state.timeLeft <= 0) answerQuestion(null, true);
  }, 1000);
}

function renderQuestion() {
  stopTimer();
  const q = state.session[state.index];
  state.selected.clear();
  state.typedAnswer = "";
  state.answered = false;

  els.feedback.classList.add("hidden");
  els.feedback.innerHTML = "";
  els.nextBtn.disabled = true;
  els.nextBtn.textContent = "Next";
  els.topicLabel.textContent = `${q.module || q.topic} Review`;
  els.questionProgress.textContent = `Question ${state.index + 1} of ${state.session.length}`;
  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
  els.progressBar.style.width = `${(state.index / state.session.length) * 100}%`;
  els.topicBadge.textContent = q.topic;
  els.multiBadge.textContent = q.sourceMode || (q.matching ? "Match" : q.answers.length > 1 ? `Choose ${q.answers.length}` : q.gradable ? "Choose 1" : "Review");
  els.questionText.textContent = q.question;
  els.answers.innerHTML = "";
  renderExhibits(q);

  if (!q.gradable) {
    const raw = document.createElement("pre");
    raw.className = "raw-card";
    raw.textContent = q.raw;
    els.answers.append(raw);
    els.feedback.classList.remove("hidden");
    els.feedback.innerHTML = `<strong>Review item</strong><p>This item is shown with the exact pasted text. It was not turned into a scored question because the exhibit/matching choices were not fully available in the paste.</p>`;
    els.nextBtn.disabled = false;
    els.nextBtn.textContent = state.index === state.session.length - 1 ? "Finish" : "Next";
    state.answered = true;
    els.timer.textContent = "—";
    return;
  }

  if (q.matching) {
    renderMatchingQuestion(q);
    startTimer();
    return;
  }

  if (q.mode === "fill" || q.mode === "definition" || q.mode === "identification" || q.mode === "enumeration") {
    renderTypedQuestion(q);
    startTimer();
    return;
  }

  shuffle(q.choices).forEach((choice, index) => {
    const button = document.createElement("button");
    button.className = "answer-btn";
    button.type = "button";
    button.innerHTML = `<span>${String.fromCharCode(65 + index)}</span><strong></strong>`;
    button.querySelector("strong").textContent = choice;
    button.addEventListener("click", () => selectAnswer(choice, button));
    els.answers.append(button);
  });

  startTimer();
}

function renderExhibits(q) {
  const images = q.images || (q.image ? [q.image] : []);
  if (!images.length) return;

  const wrapper = document.createElement("div");
  wrapper.className = "exhibit-gallery";

  images.forEach((src, index) => {
    const image = document.createElement("img");
    image.className = "exhibit-image";
    image.src = src;
    image.alt = `Exhibit for ${q.question.replace(/^\d+\.\s*/, "")}${images.length > 1 ? ` ${index + 1}` : ""}`;
    image.loading = "lazy";
    image.decoding = "async";
    wrapper.append(image);
  });

  els.answers.append(wrapper);
}

function renderTypedQuestion(q) {
  const wrapper = document.createElement("div");
  wrapper.className = "typed-answer";
  wrapper.innerHTML = `
    <label>
      <span>${q.mode === "definition" || q.mode === "identification" ? "Term" : q.mode === "enumeration" ? "Answers" : "Answer"}</span>
      <input id="typedAnswerInput" type="text" autocomplete="off" spellcheck="false" placeholder="Type your answer" />
    </label>
  `;

  const input = wrapper.querySelector("input");
  input.addEventListener("input", () => {
    state.typedAnswer = input.value;
    syncSubmitButton();
  });
  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !els.nextBtn.disabled) {
      event.preventDefault();
      nextQuestion();
    }
  });

  els.answers.append(wrapper);
  try {
    input.focus({ preventScroll: true });
  } catch {
    input.focus();
  }
}

function renderMatchingQuestion(q) {
  const wrapper = document.createElement("div");
  wrapper.className = "match-grid";
  const shuffledTargets = shuffle(q.matching.targets);
  const shuffledOptions = shuffle(q.matching.options);
  q.currentTargetOrder = shuffledTargets;

  shuffledTargets.forEach((target) => {
    const row = document.createElement("label");
    row.className = "match-row";
    const text = document.createElement("span");
    text.textContent = target;
    const select = document.createElement("select");
    select.dataset.target = target;
    select.innerHTML = `<option value="">Choose match</option>${shuffledOptions.map((option) => `<option value="${escapeHtml(option)}">${escapeHtml(option)}</option>`).join("")}`;
    select.addEventListener("change", () => {
      audio.click();
      syncSubmitButton();
    });
    row.append(text, select);
    wrapper.append(row);
  });

  els.answers.append(wrapper);
}

function readMatchingSelection(wrapper) {
  return [...wrapper.querySelectorAll("select")].map((select) => ({
    target: select.dataset.target,
    answer: select.value
  }));
}

function escapeHtml(value) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function selectAnswer(choice, button) {
  const q = state.session[state.index];
  if (state.answered) return;
  audio.click();

  if (q.answers.length > 1) {
    if (state.selected.has(choice)) {
      state.selected.delete(choice);
      button.classList.remove("selected");
    } else {
      state.selected.add(choice);
      button.classList.add("selected");
    }

    syncSubmitButton();
    return;
  }

  state.selected.clear();
  els.answers.querySelectorAll(".answer-btn").forEach((answerButton) => answerButton.classList.remove("selected"));
  state.selected.add(choice);
  button.classList.add("selected");
  syncSubmitButton();
}

function syncSubmitButton() {
  const q = state.session[state.index];
  if (state.answered) return;
  if (q.mode === "fill" || q.mode === "definition" || q.mode === "identification" || q.mode === "enumeration") {
    els.nextBtn.disabled = !state.typedAnswer.trim();
    return;
  }
  if (q.matching) {
    els.nextBtn.disabled = ![...els.answers.querySelectorAll("select")].every((item) => item.value);
    return;
  }
  const needed = Math.max(1, q.answers.length);
  els.nextBtn.disabled = state.selected.size !== needed;
}

function sameAnswers(selected, correct) {
  if (!selected || selected.length !== correct.length) return false;
  const picked = selected.map(normalize).sort();
  const expected = correct.map(normalize).sort();
  return picked.every((answer, index) => answer === expected[index]);
}

function normalizeTyped(value) {
  return normalize(value).replace(/[^a-z0-9]+/g, " ").trim();
}

function sameTypedAnswer(selected, correct) {
  const typed = normalizeTyped(selected || "");
  return correct.some((answer) => typed === normalizeTyped(answer));
}

function normalizeTypedList(value) {
  return value
    .split(/[,;\n]+/)
    .map(normalizeTyped)
    .filter(Boolean);
}

function sameEnumerationAnswer(selected, correct) {
  const typedItems = normalizeTypedList(selected || "");
  if (!typedItems.length || typedItems.length !== correct.length) return false;
  const picked = typedItems.sort();
  const expected = correct.map(normalizeTyped).sort();
  return expected.every((answer, index) => answer === picked[index]);
}

function sameMatching(selected, matching) {
  if (!selected || selected.length !== matching.targets.length) return false;
  return selected.every((item) => normalize(item.answer) === normalize(matching.answers[item.target]));
}

function answerQuestion(selected, timedOut) {
  if (state.answered) return;
  stopTimer();
  state.answered = true;

  const q = state.session[state.index];
  const correct = q.mode === "enumeration" ? sameEnumerationAnswer(selected, q.typedAnswers || q.answers) : q.mode === "fill" || q.mode === "definition" || q.mode === "identification" ? sameTypedAnswer(selected, q.typedAnswers || q.answers) : q.matching ? sameMatching(selected, q.matching) : sameAnswers(selected, q.answers);
  const buttons = [...els.answers.querySelectorAll(".answer-btn")];

  if (q.mode === "fill" || q.mode === "definition" || q.mode === "identification" || q.mode === "enumeration") {
    markTypedQuestion(correct);
  } else if (q.matching) {
    markMatchingQuestion(q, selected || []);
  } else {
    buttons.forEach((button) => {
      const text = button.querySelector("strong").textContent;
      const isCorrect = q.answers.some((answer) => normalize(answer) === normalize(text));
      const wasPicked = selected?.some((answer) => normalize(answer) === normalize(text));
      if (isCorrect) button.classList.add("correct");
      if (wasPicked && !isCorrect) button.classList.add("wrong");
      button.disabled = true;
    });
  }

  if (correct) {
    audio.correct();
    const bonus = state.streak * 50;
    const speed = state.timerSeconds ? Math.max(0, state.timeLeft * 5) : 0;
    state.score += 500 + bonus + speed;
    state.streak += 1;
  } else {
    audio.wrong();
    state.missed.push({ ...q, picked: selected || [] });
    state.streak = 0;
  }

  els.score.textContent = state.score;
  els.streak.textContent = state.streak;
  els.feedback.classList.remove("hidden");
  els.feedback.innerHTML = `
    <strong>${correct ? "Correct" : timedOut ? "Time's up" : "Not quite"}</strong>
    <p><b>Answer:</b> ${formatCorrectAnswer(q)}</p>
    <p>${q.explanation}</p>
  `;
  els.nextBtn.disabled = false;
  els.nextBtn.textContent = state.index === state.session.length - 1 ? "Finish" : "Next";
}

function markMatchingQuestion(q, selected) {
  els.answers.querySelectorAll(".match-row").forEach((row) => {
    const select = row.querySelector("select");
    const target = select.dataset.target;
    const picked = selected.find((item) => item.target === target)?.answer || "";
    const right = q.matching.answers[target];
    row.classList.toggle("correct", normalize(picked) === normalize(right));
    row.classList.toggle("wrong", normalize(picked) !== normalize(right));
    select.disabled = true;
  });
}

function markTypedQuestion(correct) {
  const wrapper = els.answers.querySelector(".typed-answer");
  const input = wrapper?.querySelector("input");
  if (!wrapper || !input) return;
  wrapper.classList.toggle("correct", correct);
  wrapper.classList.toggle("wrong", !correct);
  input.disabled = true;
}

function formatCorrectAnswer(q) {
  if (q.mode === "fill" || q.mode === "definition" || q.mode === "identification" || q.mode === "enumeration") return q.typedAnswers?.join(" | ") || q.answers.join(" | ");
  if (!q.matching) return q.answers.join(" | ");
  const targets = q.currentTargetOrder || q.matching.targets;
  return targets.map((target) => `${target} => ${q.matching.answers[target]}`).join(" | ");
}

function nextQuestion() {
  if (!state.session.length) return;
  if (!state.answered) {
    const q = state.session[state.index];
    const selected = q.mode === "fill" || q.mode === "definition" || q.mode === "identification" || q.mode === "enumeration" ? state.typedAnswer : q.matching ? readMatchingSelection(els.answers.querySelector(".match-grid")) : [...state.selected];
    answerQuestion(selected, false);
    return;
  }
  if (state.index < state.session.length - 1) {
    state.index += 1;
    renderQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  stopTimer();
  const gradable = state.session.filter((q) => q.gradable).length;
  const correct = gradable - state.missed.length;
  const percent = gradable ? Math.round((correct / gradable) * 100) : 0;

  showOnly(els.resultsScreen);
  audio.finish(percent);
  els.finalScore.textContent = `${percent}%`;
  els.finalTitle.textContent = percent >= 85 ? "Clean run." : percent >= 70 ? "Almost there." : "Good review set.";
  els.finalDetails.textContent = `${correct}/${gradable} scored questions correct • ${state.score} points`;
  els.retryMissedBtn.disabled = state.missed.length === 0;
  els.reviewList.innerHTML = "";

  const reviewItems = state.missed.length ? state.missed : state.session.slice(0, 8);
  reviewItems.forEach((q) => {
    const item = document.createElement("article");
    item.className = "review-card";
    item.innerHTML = `
      <span>${q.module || q.topic} • Question ${q.number}</span>
      <h3></h3>
      <p><b>Answer:</b> ${formatCorrectAnswer(q) || "Review item"}</p>
      <p></p>
    `;
    item.querySelector("h3").textContent = q.question;
    item.querySelector("p:last-child").textContent = q.explanation || q.raw;
    els.reviewList.append(item);
  });
}

function selectedTopicValues() {
  return [...els.topicSelectMenu.querySelectorAll("input:not([value='all']):checked")].map((input) => input.value);
}

function setAllTopics(checked) {
  els.topicSelectMenu.querySelectorAll("input").forEach((input) => {
    input.checked = checked;
  });
}

function updateTopicButton(values, allChecked) {
  const label = els.topicSelectButton.querySelector("span");
  if (allChecked) {
    label.textContent = "All Lessons";
  } else if (values.length === 1) {
    label.textContent = values[0];
  } else {
    label.textContent = `${values.length} selected`;
  }
}

function syncTopicSelection(changedInput = null) {
  const allInput = els.topicSelectMenu.querySelector("input[value='all']");
  const topicInputs = [...els.topicSelectMenu.querySelectorAll("input:not([value='all'])")];

  if (changedInput === allInput) {
    setAllTopics(allInput.checked);
  } else {
    allInput.checked = topicInputs.every((input) => input.checked);
  }

  let values = selectedTopicValues();
  if (!values.length) {
    setAllTopics(true);
    values = selectedTopicValues();
  }

  if (allInput.checked || values.length === topicInputs.length) {
    state.topics = new Set(["all"]);
    updateTopicButton(values, true);
  } else {
    state.topics = new Set(values);
    updateTopicButton(values, false);
  }

  updateBankSize();
}

els.topicSelectButton.addEventListener("click", () => {
  const isOpen = els.topicSelect.classList.toggle("open");
  els.topicSelectButton.setAttribute("aria-expanded", String(isOpen));
});

els.topicSelectMenu.querySelectorAll("input").forEach((input) => {
  input.addEventListener("change", () => syncTopicSelection(input));
});

document.addEventListener("click", (event) => {
  if (els.topicSelect.contains(event.target)) return;
  els.topicSelect.classList.remove("open");
  els.topicSelectButton.setAttribute("aria-expanded", "false");
});

els.fillBlankMode.addEventListener("change", updateBankSize);
els.definitionMode.addEventListener("change", updateBankSize);
els.identificationMode.addEventListener("change", updateBankSize);
els.enumerationMode.addEventListener("change", updateBankSize);
els.startBtn.addEventListener("click", () => startQuiz());
els.soundToggle.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  els.soundToggle.setAttribute("aria-pressed", String(state.soundOn));
  els.soundToggle.querySelector("strong").textContent = state.soundOn ? "Sound on" : "Sound off";
  if (state.soundOn) audio.click();
});
els.quitBtn.addEventListener("click", () => {
  audio.click();
  stopTimer();
  showOnly(els.startScreen);
});
els.nextBtn.addEventListener("click", () => {
  audio.click();
  nextQuestion();
});
els.restartBtn.addEventListener("click", () => {
  audio.click();
  showOnly(els.startScreen);
});
els.retryMissedBtn.addEventListener("click", () => startQuiz(state.missed));

state.allQuestions = window.QUESTION_BANK || parseQuestions(window.QUESTIONS_SOURCE || "");
updateBankSize();

