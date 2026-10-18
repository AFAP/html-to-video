/* 本片唯一的音乐/画面时间表：120 BPM，30小节，60秒。 */
window.ABYSS_TIMING = {
  bpm: 120, beat: 0.5, bar: 2, duration: 60,
  sections: [
    { at: 0, title: '开场', en: 'ABYSS / WHALE', color: 'cyan', mode: 'air', energy: 0.2 },
    { at: 4, title: '从想法到项目', en: 'CREATE / BUILD', color: 'blue', mode: 'build', energy: 0.6 },
    { at: 10, title: '结果', en: 'PROOF / 1017', color: 'acid', mode: 'drive', energy: 0.9 },
    { at: 14, title: '深潜入口', en: 'DIVE / THE CORE', color: 'cyan', mode: 'break', energy: 0.2 },
    { at: 18, title: '稀疏权重', en: 'WEIGHTS / 552B', color: 'violet', mode: 'drop', energy: 1 },
    { at: 22, title: 'CED 非对称', en: 'CED / 20 + 20', color: 'cyan', mode: 'focus', energy: 0.6 },
    { at: 28, title: 'KV 缓存', en: 'CACHE / SINGULARITY', color: 'cyan', mode: 'build', energy: 0.8 },
    { at: 34, title: 'CSA2 跨层', en: 'CSA2 / SONAR', color: 'acid', mode: 'drive', energy: 0.85 },
    { at: 40, title: 'FP4 与分层', en: 'FP4 / ABYSS', color: 'blue', mode: 'focus', energy: 0.55 },
    { at: 44, title: 'DSpark', en: 'DSPARK / POD', color: 'acid', mode: 'drop', energy: 1 },
    { at: 48, title: '开放生态', en: 'OPEN / MIT', color: 'violet', mode: 'open', energy: 0.35 },
    { at: 52, title: '收束', en: 'FINALE / RESURFACE', color: 'acid', mode: 'finale', energy: 0.9 }
  ],
  cues: [
    { at: 0, type: 'sonar', power: 0.55 },
    { at: 4, type: 'impact', power: 0.65 },
    { at: 5, type: 'tick', power: 0.4 }, { at: 5.5, type: 'tick', power: 0.5 }, { at: 6, type: 'tick', power: 0.6 },
    { at: 10, type: 'impact', power: 0.8 },
    { at: 11, type: 'note', power: 0.65 }, { at: 11.5, type: 'note', power: 0.75 }, { at: 12, type: 'note', power: 0.85 },
    { at: 14, type: 'sonar', power: 0.65 }, { at: 16, type: 'sonar', power: 0.5 },
    { at: 18, type: 'impact', power: 1 }, { at: 19, type: 'tick', power: 0.55 },
    { at: 22, type: 'impact', power: 0.45 }, { at: 23, type: 'tick', power: 0.45 }, { at: 25, type: 'note', power: 0.55 }, { at: 26, type: 'tick', power: 0.65 },
    { at: 28, type: 'sonar', power: 0.5 }, { at: 30, type: 'impact', power: 1 },
    { at: 34, type: 'impact', power: 0.75 }, { at: 35, type: 'tick', power: 0.4 }, { at: 36, type: 'tick', power: 0.5 }, { at: 37, type: 'tick', power: 0.6 },
    { at: 40, type: 'sonar', power: 0.4 },
    { at: 44, type: 'impact', power: 0.9 }, { at: 45.25, type: 'tick', power: 0.5 }, { at: 45.5, type: 'tick', power: 0.55 }, { at: 46, type: 'impact', power: 0.65 },
    { at: 48, type: 'sonar', power: 0.5 }, { at: 49.5, type: 'note', power: 0.6 },
    { at: 52, type: 'impact', power: 1 }, { at: 54, type: 'note', power: 0.75 }, { at: 56, type: 'sonar', power: 0.4 }
  ]
};
