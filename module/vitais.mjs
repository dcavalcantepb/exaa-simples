/* ============================================================
   EX:AA · Sinais vitais da ficha
   - ecgSVG(nivel): monitor cardíaco do Piloto (0 a 3, e 4 = Morto)
   - statusHTML(nivel): barra de integridade do EXACOM (0 a 3, e 4 = Destruído)
   - manchaHTML(): névoa roxa que toma o retrato, por nível de Marca
   Validado no laboratório (9999 - Sistema Foundry/laboratorio-vitais).
   ============================================================ */

/* ---------------- Eletrocardiograma ---------------- */

const BASE = 26; // linha de base no viewBox 200 x 40

/** Um batimento (P, QRS, T) começando em x. `amp` = altura do pico, `larg` = largura. */
function batida(x, amp = 1, larg = 1) {
  const sx = v => (x + v * larg).toFixed(1);
  const sy = v => (BASE - v * amp).toFixed(1);
  return ` L${sx(0)} ${BASE} L${sx(4)} ${BASE} Q${sx(6)} ${sy(4)} ${sx(8)} ${BASE} L${sx(10)} ${BASE}`
    + ` L${sx(11)} ${BASE + 3} L${sx(13)} ${sy(20)} L${sx(15)} ${BASE + 7} L${sx(16.5)} ${BASE}`
    + ` L${sx(20)} ${BASE} Q${sx(24)} ${sy(6)} ${sx(28)} ${BASE}`;
}

/** Batimentos encadeados: [amplitude, largura, pausa até o próximo], até encher o monitor. */
function emSequencia(lista) {
  const batidas = [];
  let x = 1;
  for (const [amp, larg, pausa] of lista) {
    if (x + 28 * larg > 198) break;
    batidas.push([x, amp, larg]);
    x += 28 * larg + pausa;
  }
  return batidas;
}

/** Ritmos por Condição: [x, amplitude, largura] de cada batimento. */
const RITMOS = {
  0: [[8, 1, 1], [58, 1, 1], [108, 1, 1], [158, 1, 1]],                       // calmo e regular
  1: [[4, .95, .9], [42, .95, .9], [80, .95, .9], [118, .95, .9], [156, .95, .9]], // acelerado
  2: [[2, .8, .8], [30, 1.1, .7], [52, .6, .8], [88, 1, .75], [110, .7, .7], [150, 1.05, .8], [172, .5, .7]], // irregular
  3: emSequencia([                                                              // palpitações descontroladas
    [.9, .45, 1], [1.2, .4, 3], [.5, .4, 0], [1.1, .45, 2], [.7, .4, 4], [1.25, .45, 0], [.4, .4, 1],
    [1, .45, 3], [1.2, .4, 0], [.6, .45, 2], [1.15, .4, 1], [.5, .4, 0], [1.2, .45, 3], [.8, .4, 1], [1.25, .45, 2]
  ]),
  4: [] // linha reta
};

/** Tempo de uma varredura, em segundos. */
const TEMPOS = { 0: 2.6, 1: 1.8, 2: 1.15, 3: 0.8, 4: 3.2 };

/** Leitura do monitor: batimentos por minuto e estado. */
const LEITURAS = {
  0: { bpm: "72", texto: "FINE" },
  1: { bpm: "108", texto: "ATTENTION" },
  2: { bpm: "146", texto: "DANGER" },
  3: { bpm: "198", texto: "CRITICAL" },
  4: { bpm: "---", texto: "LOS" }
};

/** Caveira do botão de morte do Piloto. */
const CAVEIRA = `<svg class="icone-morte" viewBox="0 0 24 24">`
  + `<path class="osso" d="M12 2C6.9 2 3 5.6 3 10.3c0 2.8 1.4 4.9 3.5 6.1V19a1 1 0 0 0 1 1h1.5v-2h1.5v2h3v-2h1.5v2h1.5a1 1 0 0 0 1-1v-2.6c2.1-1.2 3.5-3.3 3.5-6.1C21 5.6 17.1 2 12 2Z"/>`
  + `<circle class="vazio" cx="8.5" cy="11" r="2.2"/><circle class="vazio" cx="15.5" cy="11" r="2.2"/>`
  + `<path class="vazio" d="M12 13.4l-1.3 2.3h2.6Z"/></svg>`;

function caminhoECG(dano) {
  return `M0 ${BASE}` + RITMOS[dano].map(([x, a, l]) => batida(x, a, l)).join("") + ` L200 ${BASE}`;
}

/** Monitor: o traço inteiro fica desenhado, e uma máscara em movimento revela a ponta e o rastro. */
export function ecgSVG(dano) {
  const n = Math.max(0, Math.min(4, Number(dano) || 0));
  const { bpm, texto } = LEITURAS[n];
  return `<div class="exaa-ecg ecg-n${n}" style="--ecg-tempo:${TEMPOS[n]}s" aria-hidden="true">`
    + `<svg class="ecg-traco" viewBox="0 0 200 40" preserveAspectRatio="none">`
    + `<path d="${caminhoECG(n)}" vector-effect="non-scaling-stroke"/>`
    + `</svg>`
    + `<span class="vital-num">${bpm} <small>BPM</small></span>`
    + `<span class="vital-estado">${texto}</span>`
    + `</div>`;
}

/* ---------------- Status do Sistema (EXACOM) ---------------- */

/** X vermelho do botão de destruição do EXACOM. */
const X_VERMELHO = `<svg class="icone-morte" viewBox="0 0 24 24"><path d="M5 5 L19 19 M19 5 L5 19"/></svg>`;

const SEGMENTOS = 12;
const STATUS = {
  0: { acesos: 12, texto: "NOMINAL" },
  1: { acesos: 8, texto: "DAMAGED" },
  2: { acesos: 4, texto: "FAILURE" },
  3: { acesos: 1, texto: "CRITICAL" },
  4: { acesos: 0, texto: "LOS" }
};

/** Barra de integridade do EXACOM: segmentos acesos conforme o Dano, com percentual e leitura. */
export function statusHTML(dano) {
  const n = Math.max(0, Math.min(4, Number(dano) || 0));
  const { acesos, texto } = STATUS[n];
  const segmentos = Array.from({ length: SEGMENTOS }, (_, i) => `<span class="sys-seg${i < acesos ? " on" : ""}"></span>`).join("");
  return `<div class="exaa-sys sys-n${n}" aria-hidden="true">`
    + `<span class="sys-rotulo">SYS</span>`
    + `<div class="sys-barra">${segmentos}</div>`
    + `<span class="vital-num">${Math.round((acesos / SEGMENTOS) * 100)}%</span>`
    + `<span class="vital-estado">${texto}</span>`
    + `</div>`;
}

/** Ícones dos botões de morte, ao lado do contador de Dano. */
export const ICONES = { caveira: CAVEIRA, x: X_VERMELHO };

/* ---------------- Mancha da Síndrome no retrato ---------------- */

/** Filtro de fumaça usado pela mancha: precisa existir uma vez no documento. */
const FILTRO_FUMACA = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">`
  + `<filter id="exaa-fumaca" x="-20%" y="-20%" width="140%" height="140%">`
  + `<feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="3" result="ruido">`
  + `<animate attributeName="baseFrequency" dur="14s" values="0.03;0.042;0.03" repeatCount="indefinite"/>`
  + `</feTurbulence>`
  + `<feDisplacementMap in="SourceGraphic" in2="ruido" scale="22" xChannelSelector="R" yChannelSelector="G"/>`
  + `</filter></svg>`;

function garantirFiltroFumaca() {
  if (!document.getElementById("exaa-fumaca")) document.body.insertAdjacentHTML("beforeend", FILTRO_FUMACA);
}

/** Camadas da mancha, para pôr dentro do retrato (o contêiner leva a classe marcas-N). */
export function manchaHTML() {
  garantirFiltroFumaca();
  return `<div class="mancha-wrap"><div class="mancha"></div></div>`;
}
