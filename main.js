let selectedLevel = '';
let activeData = null;
let quizQuestions = [];
let currentIndex = 0;
let correctCount = 0;
let adjustedScore = 0;
let answered = false;
let wrongRecords = [];
let slowRecords = [];
let stats = {};
let questionStartedAt = 0;
let timerId = null;

const startScreen = document.getElementById('startScreen');
const quizScreen = document.getElementById('quizScreen');
const loadingScreen = document.getElementById('loadingScreen');
const resultScreen = document.getElementById('resultScreen');
const startButton = document.getElementById('startButton');
const nextButton = document.getElementById('nextButton');
const quitButton = document.getElementById('quitButton');
const restartButton = document.getElementById('restartButton');
const backStartButton = document.getElementById('backStartButton');
const timer = document.getElementById('timer');

function show(screen) {
  [startScreen, quizScreen, loadingScreen, resultScreen].forEach(item => item.classList.add('hidden'));
  screen.classList.remove('hidden');
}

function shuffle(array) {
  const copied = [...array];
  for (let i = copied.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copied[i], copied[j]] = [copied[j], copied[i]];
  }
  return copied;
}

function chooseLevel(level) {
  selectedLevel = level;
  activeData = datasets[level];
  document.querySelectorAll('.level-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.level === level);
  });
  startButton.disabled = false;
}

function resetStats() {
  stats = {};
  activeData.fields.forEach(field => {
    stats[field] = { total: 0, correct: 0, wrong: 0, slow: 0, totalTime: 0 };
  });
}

function pickQuestions() {
  const picked = activeData.fields.flatMap(field => {
    const pool = activeData.bank.filter(q => q.field === field);
    if (selectedLevel === 'high' && field === '数学') {
      const figure = shuffle(pool.filter(q => q.figureHtml)).slice(0, 1);
      const usedIds = new Set(figure.map(q => q.id));
      const hard = shuffle(pool.filter(q => q.level >= 3 && !usedIds.has(q.id))).slice(0, 2);
      const selected = [...figure, ...hard];
      const selectedIds = new Set(selected.map(q => q.id));
      const rest = shuffle(pool.filter(q => !selectedIds.has(q.id))).slice(0, 3 - selected.length);
      return [...selected, ...rest];
    }
    if (selectedLevel === 'high') {
      const hard = shuffle(pool.filter(q => q.level >= 3)).slice(0, 2);
      const usedIds = new Set(hard.map(q => q.id));
      const rest = shuffle(pool.filter(q => !usedIds.has(q.id))).slice(0, 1);
      return [...hard, ...rest];
    }
    return shuffle(pool).slice(0, 3);
  });
  return shuffle(picked);
}

function startQuiz() {
  if (!activeData) {
    return;
  }
  quizQuestions = pickQuestions();
  currentIndex = 0;
  correctCount = 0;
  adjustedScore = 0;
  wrongRecords = [];
  slowRecords = [];
  answered = false;
  resetStats();
  show(quizScreen);
  renderQuestion();
}

function getTimeLimit(q) {
  if (q.timeLimit) {
    return q.timeLimit;
  }
  return timeLimitByLevel[q.level] || 35;
}

function startTimer(q) {
  clearInterval(timerId);
  questionStartedAt = Date.now();
  const limit = getTimeLimit(q);
  timer.className = 'timer';
  timer.textContent = `0秒 / 目安${limit}秒`;

  timerId = setInterval(() => {
    const elapsed = Math.floor((Date.now() - questionStartedAt) / 1000);
    timer.textContent = `${elapsed}秒 / 目安${limit}秒`;
    timer.classList.toggle('warn', elapsed > limit);
  }, 250);
}

function stopTimer() {
  clearInterval(timerId);
  return Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000));
}

function renderMiniStats() {
  const target = document.getElementById('miniStats');
  target.innerHTML = activeData.fields.map(field => {
    const s = stats[field];
    return `<div class='mini'><strong>${s.correct}/${s.total}</strong>${field}</div>`;
  }).join('');
}

function renderQuestion() {
  const q = quizQuestions[currentIndex];
  answered = false;
  nextButton.disabled = true;

  document.getElementById('questionCounter').textContent = `問題 ${currentIndex + 1} / ${quizQuestions.length}`;
  document.getElementById('levelLabel').textContent = activeData.label;
  document.getElementById('fieldChip').textContent = `${q.field}　難易度${q.level}`;
  document.getElementById('questionText').textContent = q.question;
  document.getElementById('progressBar').style.width = `${(currentIndex / quizQuestions.length) * 100}%`;

  const figure = document.getElementById('questionFigure');
  if (q.figureHtml) {
    figure.innerHTML = q.figureHtml;
    figure.classList.remove('hidden');
  } else {
    figure.innerHTML = '';
    figure.classList.add('hidden');
  }

  const feedback = document.getElementById('feedback');
  feedback.className = 'feedback';
  feedback.textContent = '答えを選ぶと、ここに解説が表示されます。';

  const choices = document.getElementById('choices');
  choices.innerHTML = '';

  shuffle([
    { text: q.correctAnswer, correct: true },
    ...q.wrongAnswers.map(item => ({ text: item, correct: false }))
  ]).forEach(answer => {
    const button = document.createElement('button');
    button.className = 'choice-btn';
    button.textContent = answer.text;
    button.addEventListener('click', () => selectAnswer(button, answer));
    choices.appendChild(button);
  });

  renderMiniStats();
  startTimer(q);
}

function selectAnswer(button, answer) {
  if (answered) {
    return;
  }
  answered = true;

  const elapsed = stopTimer();
  const q = quizQuestions[currentIndex];
  const limit = getTimeLimit(q);
  const isSlow = elapsed > limit;
  const s = stats[q.field];
  s.total += 1;
  s.totalTime += elapsed;

  if (isSlow) {
    s.slow += 1;
    slowRecords.push({
      field: q.field,
      question: q.question,
      elapsed,
      limit,
      level: q.level,
      correct: answer.correct,
      mistakeType: q.mistakeType
    });
  }

  const buttons = [...document.querySelectorAll('.choice-btn')];
  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === q.correctAnswer) {
      btn.classList.add('correct');
    }
  });

  const feedback = document.getElementById('feedback');
  const timeNote = isSlow ? `<br>時間：${elapsed}秒。目安${limit}秒を超えたので、復習時は解き方の型を確認しましょう。` : `<br>時間：${elapsed}秒。目安内で解けています。`;

  if (answer.correct) {
    correctCount += 1;
    if (!isSlow) {
      adjustedScore += 1;
    } else if (elapsed <= limit * 1.5) {
      adjustedScore += 0.5;
    } else {
      adjustedScore += 0.2;
    }
    s.correct += 1;
    button.classList.add('correct');
    feedback.className = 'feedback good';
    feedback.innerHTML = `<strong>正解。</strong><br>${q.explanation}${timeNote}`;
  } else {
    s.wrong += 1;
    button.classList.add('wrong');
    feedback.className = 'feedback bad';
    feedback.innerHTML = `<strong>不正解。</strong> 正解は ${q.correctAnswer} です。<br>${q.explanation}${timeNote}`;
    wrongRecords.push({
      field: q.field,
      question: q.question,
      selected: answer.text,
      correct: q.correctAnswer,
      explanation: q.explanation,
      mistakeType: q.mistakeType,
      elapsed,
      limit,
      slow: isSlow
    });
  }

  renderMiniStats();
  nextButton.disabled = false;
}

function nextQuestion() {
  if (!answered) {
    return;
  }
  currentIndex += 1;
  if (currentIndex < quizQuestions.length) {
    renderQuestion();
  } else {
    document.getElementById('progressBar').style.width = '100%';
    show(loadingScreen);
    setTimeout(showResults, 900);
  }
}

function countBy(items, key) {
  return items.reduce((acc, item) => {
    acc[item[key]] = (acc[item[key]] || 0) + 1;
    return acc;
  }, {});
}

function getTypeTitle(typeCounts) {
  if (wrongRecords.length === 0 && slowRecords.length === 0) {
    return ['バランス理解タイプ', '正確さも時間も安定しています。どの分野もバランスよく理解できています。'];
  }
  if (wrongRecords.length === 0 && slowRecords.length > 0) {
    return ['じっくり正解タイプ', '正解できていますが、いくつかの問題で時間がかかっています。解法の型を覚えるとさらに安定します。'];
  }
  const top = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0][0];
  return [typeMap[top] || '復習ポイント発見タイプ', `${top} の間違いが目立ちます。関連する問題を復習すると伸びやすいです。`];
}

function showResults() {
  clearInterval(timerId);
  show(resultScreen);

  const results = activeData.fields.map(field => {
    const s = stats[field];
    const rate = s.total ? Math.round((s.correct / s.total) * 100) : 0;
    const avgTime = s.total ? Math.round(s.totalTime / s.total) : 0;
    return { field, ...s, rate, avgTime };
  });

  const typeCounts = countBy(wrongRecords, 'mistakeType');
  const [type, summary] = getTypeTitle(typeCounts);

  document.getElementById('typeTitle').textContent = type;
  document.getElementById('typeSummary').textContent = summary;
  document.getElementById('score').textContent = `${adjustedScore.toFixed(1)} / ${quizQuestions.length} 点`;
  document.getElementById('timeScore').textContent = 'スコアは正解数ではなく、正解までの時間を含めて計算しています。目安時間を超えた正解は0.5点、1.5倍を超えた正解は0.2点です。';

  document.getElementById('fieldBars').innerHTML = results.map(item => `
    <div class='bar-row'>
      <span>${item.field}</span>
      <div class='bar-track'><div class='bar-fill' style='width:${item.rate}%'></div></div>
      <span>${item.rate}%</span>
    </div>
  `).join('');

  const weakSorted = [...results].sort((a, b) => {
    if (a.rate !== b.rate) {
      return a.rate - b.rate;
    }
    return b.slow - a.slow;
  });

  document.getElementById('weakRanking').innerHTML = weakSorted.map((item, i) => `
    <li><strong>${i + 1}位：${item.field}</strong><br>正解率 ${item.rate}%、不正解 ${item.wrong}問、時間超過 ${item.slow}問、平均 ${item.avgTime}秒</li>
  `).join('');

  const timeAdvice = [];
  const slowByField = [...results].sort((a, b) => b.slow - a.slow)[0];
  if (slowRecords.length === 0) {
    timeAdvice.push('時間の使い方は安定しています。次は解説を読んで、より短い解法を探すとさらに良いです。');
  } else {
    timeAdvice.push(`${slowByField.field}で時間がかかりやすいです。最初に使う公式や読むポイントを決めてから解き始めましょう。`);
    timeAdvice.push('目安時間を超えた問題は、答えが合っていても復習対象にしましょう。理解はできていても、解法の型がまだ固まっていない可能性があります。');
    timeAdvice.push('迷った選択肢を2つまで絞ったら、条件や単位を見直す癖をつけましょう。');
  }
  document.getElementById('timeAdviceList').innerHTML = timeAdvice.map(text => `<li>${text}</li>`).join('');

  const weakFields = weakSorted.filter(item => item.wrong > 0 || item.slow > 0).slice(0, 2).map(item => item.field);
  const adviceFields = weakFields.length ? weakFields : [weakSorted[0].field];
  document.getElementById('adviceList').innerHTML = adviceFields
    .flatMap(field => adviceByField[field].slice(0, 2))
    .slice(0, 3)
    .map(text => `<li>${text}</li>`)
    .join('');

  const reviewItems = [
    ...wrongRecords.map(item => ({
      kind: '間違い',
      ...item
    })),
    ...slowRecords
      .filter(item => item.correct)
      .map(item => ({
        kind: '時間超過',
        field: item.field,
        question: item.question,
        selected: '正解',
        correct: '正解',
        explanation: `正解ですが、${item.elapsed}秒かかりました。目安は${item.limit}秒です。`,
        mistakeType: item.mistakeType,
        elapsed: item.elapsed,
        limit: item.limit,
        slow: true
      }))
  ];

  document.getElementById('wrongList').innerHTML = reviewItems.length ? reviewItems.map(item => `
    <li>
      <strong>${item.kind}｜${item.field}｜${item.mistakeType}</strong><br>
      問題：${item.question}<br>
      選んだ答え：${item.selected}<br>
      正解：${item.correct}<br>
      時間：${item.elapsed}秒 / 目安${item.limit}秒<br>
      解説：${item.explanation}
    </li>
  `).join('') : `<li><strong>全問安定</strong><br>間違いも時間超過もありません。</li>`;
}

document.querySelectorAll('.level-btn').forEach(btn => {
  btn.addEventListener('click', () => chooseLevel(btn.dataset.level));
});
startButton.addEventListener('click', startQuiz);
nextButton.addEventListener('click', nextQuestion);
restartButton.addEventListener('click', startQuiz);
backStartButton.addEventListener('click', () => show(startScreen));
quitButton.addEventListener('click', () => {
  clearInterval(timerId);
  show(startScreen);
});
