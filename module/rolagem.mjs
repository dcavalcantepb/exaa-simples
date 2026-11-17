/* ============================================================
   Motor de dados e combate do EX:AA
   Leia sempre o maior dado. Sem dados: 2d6, fica o menor.
   ============================================================ */

export const PORTE_NUM = { leve: 1, medio: 2, pesado: 3 };

const esc = v => Handlebars.escapeExpression(typeof v === "string" ? v : JSON.stringify(v));
const valores = roll => roll?.dice[0].results.map(r => r.result) ?? [];

/**
 * Rola uma parada de dados.
 * Base <= 0 sem EXApoints: 2d6, fica o menor. Com EXApoints, rolam-se só os dados EXA.
 */
export async function rolarParada(dadosBase, dadosEXA = 0) {
  const usaPior = dadosBase <= 0 && dadosEXA === 0;
  const numBase = usaPior ? 2 : Math.min(10, Math.max(0, dadosBase));
  const rolar = async n => (n > 0 ? new Roll(`${n}d6`).evaluate() : null);
  const rollBase = await rolar(numBase);
  const rollEXA = await rolar(dadosEXA);
  const base = valores(rollBase);
  const exa = valores(rollEXA);
  const final = usaPior ? Math.min(...base) : Math.max(...base, ...exa);

  // Anima pelo DSN sem passar rolls ao ChatMessage (no v13 isso renderiza os dados brutos junto ao HTML)
  if (game.dice3d) {
    for (const roll of [rollBase, rollEXA].filter(Boolean)) {
      await game.dice3d.showForRoll(roll, game.user, true, null, false);
    }
  }
  return { usaPior, numBase, dadosEXA, base, exa, final, todos: usaPior ? base : [...base, ...exa] };
}

/** HTML dos grupos de dados, destacando o dado que decidiu o resultado. */
export function htmlParada(p) {
  let achou = false;
  const render = (lista, isEXA) => lista.map(v => {
    let cls = `exaa-die${isEXA ? " exa" : ""}`;
    if (isEXA && v === 1) cls += " miss";
    if (!achou && v === p.final) { cls += " winner"; achou = true; }
    return `<span class="${cls}">${v}</span>`;
  }).join("");

  let html = "";
  if (p.base.length) {
    html += `<div class="exaa-dice-group">
      <span class="exaa-dice-label">${p.usaPior ? "Dados (2d6, mantendo o menor)" : `Dados Base (${p.numBase}d6)`}:</span>
      <span class="exaa-dice-values">${render(p.base, false)}</span>
    </div>`;
  }
  if (p.exa.length) {
    html += `<div class="exaa-dice-group">
      <span class="exaa-dice-label">EXApoints (${p.dadosEXA}d6):</span>
      <span class="exaa-dice-values">${render(p.exa, true)}</span>
    </div>`;
  }
  return html;
}

export function resultadoTeste(valor) {
  if (valor <= 1) return "Falha Crítica";
  if (valor <= 3) return "Falha";
  if (valor <= 5) return "Sucesso com Custo";
  return "Sucesso Crítico";
}

/* ---------------- Combate ---------------- */

/** Dano de um golpe. `poder` é o Porte da arma (Piloto) ou a Letalidade (Ameaça). */
export function danoDoGolpe(final, dados, poder) {
  if (final <= 1) return 0;
  if (final <= 3) return 1;
  if (final <= 5) return poder;
  return poder + dados.filter(v => v === 6).length;
}

export function textoDoGolpe(final, dano, poder) {
  if (final <= 1) return "Nenhum Dano. A guarda está aberta para um contra-ataque.";
  if (final <= 3) return "1 de Dano (raspão).";
  if (final <= 5) return `${dano} de Dano.`;
  return `${poder} +${dano - poder} = ${dano} de Dano.`;
}

/** Tokens marcados (alvos) pelo usuário no momento da rolagem. */
export function capturarAlvos() {
  return Array.from(game.user.targets).filter(t => t.actor).map(t => ({ uuid: t.actor.uuid, nome: t.name }));
}

export function botao(acao, label, dados = {}, classe = "") {
  const attrs = Object.entries(dados).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  return `<button type="button" class="exaa-acao-btn ${classe}" data-acao="${acao}" data-id="${foundry.utils.randomID()}"${attrs}>${label}</button>`;
}

export function botoesAplicar(dano, alvos, fonte) {
  if (dano <= 0) return "";
  if (!alvos.length) return botao("aplicar", `Aplicar ${dano} de Dano no alvo marcado`, { dano, fonte });
  return alvos.map(a => {
    const previa = fromUuidSync(a.uuid)?.previaDano?.(dano);
    const detalhe = previa?.reducao ? ` (${previa.texto})` : "";
    return botao("aplicar", `Aplicar ${previa?.final ?? dano} de Dano em ${a.nome}${detalhe}`, { dano, fonte, alvo: a.uuid });
  }).join("");
}

/** Botões de contra-ataque após uma falha crítica de `atacante`. */
export function botoesContra(atacante, alvos) {
  if (!alvos.length) return botao("contra", "Contra-ataque (selecione o token do inimigo)", { atacante: atacante.uuid });
  return alvos.map(a => botao("contra", `Contra-ataque de ${a.nome}`, { atacante: atacante.uuid, contra: a.uuid })).join("");
}

export const acoes = html => (html ? `<div class="exaa-acoes">${html}</div>` : "");

/**
 * Contra-ataque: quem contra-ataca rola os próprios dados; com 4 ou mais causa 1 de Dano, +1 por 6,
 * seja qual for a Letalidade ou o Porte.
 */
export async function contraAtaque(contra, atacante, { modo = "corpo", modificador = 0 } = {}) {
  const { dados, detalhe: base } = contra.paradaDeContraAtaque(modo);
  const mod = Number(modificador) || 0;
  const p = await rolarParada(dados + mod);
  let detalhe = base;
  if (mod !== 0) detalhe += ` + Mod (${mod > 0 ? "+" : ""}${mod})`;
  if (p.usaPior) detalhe += " = sem dados: 2d6, fica o menor";
  const dano = p.final >= 4 ? 1 + (p.final === 6 ? p.todos.filter(v => v === 6).length : 0) : 0;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor: contra }),
    content: `<div class="exaa-roll-msg">
      <p><strong>${contra.name}</strong> contra-ataca <strong>${atacante.name}</strong>!</p>
      <p class="exaa-detalhe">${detalhe}</p>
      ${htmlParada(p)}
      <p class="exaa-resultado">${dano ? `Acertou: ${dano} de Dano.` : "O contra-ataque não acerta."}</p>
      ${acoes(botoesAplicar(dano, [{ uuid: atacante.uuid, nome: atacante.name }], contra.name))}
    </div>`
  });
}

/**
 * Diálogo do contra-ataque: o Piloto escolhe corpo a corpo ou à distância; o Operador pode dar modificador.
 * @returns {Promise<{modo: string, modificador: number}|null>}
 */
export function dialogoContraAtaque(contra, atacante) {
  const modOptions = [-3, -2, -1, 0, 1, 2, 3]
    .map(v => `<option value="${v}"${v === 0 ? " selected" : ""}>${v > 0 ? "+" + v : v}</option>`)
    .join("");
  const modoCampo = contra.type !== "piloto" ? "" : `
      <div class="form-group">
        <label>Forma do contra-ataque</label>
        <select name="modo">
          <option value="corpo">Corpo a corpo · ${contra.paradaDeContraAtaque("corpo").detalhe}</option>
          <option value="distancia">À distância · ${contra.paradaDeContraAtaque("distancia").detalhe}</option>
        </select>
      </div>`;

  return new Promise(resolve => {
    new Dialog({
      title: `Contra-ataque: ${contra.name}`,
      content: `
        <form class="exaa-dialog-form">
          <p class="exaa-dialog-section-title exaa-exacom-ativo">🎯 Contra ${atacante.name}</p>${modoCampo}
          <div class="form-group">
            <label>Modificador</label>
            <select name="modificador">${modOptions}</select>
          </div>
        </form>`,
      buttons: {
        roll: {
          icon: '<i class="fas fa-dice-d6"></i>',
          label: "Contra-atacar",
          callback: html => resolve({
            modo: html.find("[name='modo']").val() ?? "corpo",
            modificador: Number(html.find("[name='modificador']").val())
          })
        },
        cancel: { icon: '<i class="fas fa-times"></i>', label: "Cancelar", callback: () => resolve(null) }
      },
      default: "roll",
      close: () => resolve(null)
    }).render(true);
  });
}

/* ---------------- Botões do chat ---------------- */

/**
 * Troca um botão (ou todo o bloco de ações) da mensagem por um aviso de "já usado".
 * Só quem pode editar a mensagem a altera; para os demais, o botão fica desabilitado localmente.
 */
export function marcarUsado(message, { id = null, texto }) {
  if (!message.isOwner) return;
  const usado = `<button type="button" class="exaa-acao-btn exaa-usado" disabled>✓ ${texto}</button>`;
  const alvo = id
    ? new RegExp(`<button[^>]*data-id="${id}"[\\s\\S]*?</button>`)
    : /<div class="exaa-acoes">[\s\S]*?<\/div>/;
  return message.update({ content: message.content.replace(alvo, id ? usado : `<div class="exaa-acoes">${usado}</div>`) });
}

/**
 * Sobrecarga e Aplicar: quem fez a rolagem (ou o Operador), sobre fichas que controla.
 * Contra-ataque: quem controla quem contra-ataca, para escolher a forma do golpe.
 */
function podeUsar(message, btn) {
  const { acao, ator, alvo, contra } = btn.dataset;
  if (acao === "contra") return contra ? !!fromUuidSync(contra)?.isOwner : message.isOwner;
  if (!message.isOwner) return false;
  if (acao === "sobrecarga") return !!fromUuidSync(ator)?.isOwner;
  if (acao === "aplicar" && alvo) return !!fromUuidSync(alvo)?.isOwner;
  return true;
}

async function executar(message, btn) {
  const d = btn.dataset;

  if (d.acao === "sobrecarga") return fromUuidSync(d.ator).sobrecarga(message, btn);

  if (d.acao === "aplicar") {
    const alvo = d.alvo ? fromUuidSync(d.alvo) : Array.from(game.user.targets)[0]?.actor;
    if (!alvo) return ui.notifications.warn("Marque o token alvo para aplicar o Dano."), false;
    if (!alvo.isOwner) return ui.notifications.warn(`Só o Operador pode aplicar Dano em ${alvo.name}.`), false;
    await alvo.receberDano(Number(d.dano), d.fonte);
    await marcarUsado(message, { id: d.id, texto: `Dano aplicado em ${alvo.name}` });
    return true;
  }

  if (d.acao === "contra") {
    const contra = d.contra ? fromUuidSync(d.contra) : canvas.tokens.controlled[0]?.actor;
    const atacante = fromUuidSync(d.atacante);
    if (!contra) return ui.notifications.warn("Selecione o token do inimigo que contra-ataca."), false;
    if (!atacante) return ui.notifications.warn("Não encontrei quem abriu a guarda."), false;
    const params = await dialogoContraAtaque(contra, atacante);
    if (!params) return false;
    await marcarUsado(message, { id: d.id, texto: `Contra-ataque de ${contra.name}` });
    await contraAtaque(contra, atacante, params);
    return true;
  }
  return false;
}

export function registrarAcoesDoChat() {
  Hooks.on("renderChatMessage", (message, html) => {
    const root = html instanceof HTMLElement ? html : html[0];
    for (const btn of root?.querySelectorAll(".exaa-acao-btn[data-acao]:not([disabled])") ?? []) {
      // Ações ficam com quem fez a rolagem (ou o Operador), e só sobre fichas que essa pessoa controla
      if (!podeUsar(message, btn)) {
        btn.disabled = true;
        btn.title = btn.dataset.acao === "contra"
          ? "Só quem contra-ataca (ou o Operador) pode usar este botão."
          : "Ação reservada ao Operador ou a quem fez a rolagem.";
        continue;
      }
      btn.addEventListener("click", async event => {
        event.preventDefault();
        btn.disabled = true;
        const ok = await executar(message, btn).catch(err => (console.error(err), false));
        if (!ok) btn.disabled = false;
      });
    }
  });
}
