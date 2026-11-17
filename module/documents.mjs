import {
  PORTE_NUM, rolarParada, htmlParada, resultadoTeste, danoDoGolpe, textoDoGolpe,
  capturarAlvos, botao, botoesAplicar, botoesContra, acoes, marcarUsado
} from "./rolagem.mjs";

const NIVEIS_AMEACA = { 1: "Bucha de canhão", 2: "Elite", 3: "Clímax da Missão" };

export class EXAAActor extends Actor {
  prepareDerivedData() {
    super.prepareDerivedData();

    if (this.type === "piloto") {
      for (const recurso of [this.system.exapoints, this.system.sindrome, this.system.dano?.piloto, this.system.dano?.exacom]) {
        if (recurso) recurso.value = Math.clamp(recurso.value, 0, recurso.max);
      }
    }

    if (this.type === "ameaca" && this.system.resistencia) {
      this.system.resistencia.value = Math.clamp(this.system.resistencia.value, 0, this.system.resistencia.max);
      this.system.nivel = this.system.letalidade;
      this.system.nivelLabel = NIVEIS_AMEACA[this.system.letalidade] ?? "";
    }
  }

  /** Dispara o despertar do Gene EXA sempre que as Marcas chegam a 3, venha de onde vier. */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (this.type !== "piloto" || userId !== game.user.id) return;
    if ((foundry.utils.getProperty(changed, "system.sindrome.value") ?? 0) >= 3) this._despertarGeneEXA();
  }

  async _despertarGeneEXA() {
    const speaker = ChatMessage.getSpeaker({ actor: this });
    await ChatMessage.create({
      speaker,
      content: `<div class="exaa-roll-msg exaa-gene-exa">
        <p>☣ <strong>O Gene EXA despertou.</strong></p>
        <p>${this.name} acumulou 3 Marcas e a consciência começa a se desfazer. O Operador rolou em segredo as horas que restam até a transformação.</p>
        <p class="exaa-consequence">O relógio está correndo.</p>
      </div>`
    });
    const roll = await new Roll("1d6").evaluate();
    await roll.toMessage(
      { speaker, flavor: `Gene EXA · ${this.name}: horas até a transformação` },
      { rollMode: CONST.DICE_ROLL_MODES.BLIND }
    );
  }

  get condicaoPiloto() {
    return EXAAActor.condicaoPorDano(this.system.dano?.piloto?.value ?? 0, false);
  }

  get condicaoEXACOM() {
    return EXAAActor.condicaoPorDano(this.system.dano?.exacom?.value ?? 0, true);
  }

  static condicaoPorDano(dano, exacom) {
    const condicoes = exacom
      ? ["Perfeito Estado", "Dano Leve", "Dano Grave", "Parada Total"]
      : ["Perfeito Estado", "Dano Leve", "Dano Grave", "Fora de Ação"];
    return condicoes[Math.clamp(Number(dano) || 0, 0, 3)];
  }

  static resultadoTeste(valor) {
    return resultadoTeste(valor);
  }

  /* ---------------- Paradas de dados ---------------- */

  get noEXACOM() {
    return !!this.system.exacom?.ativo && (this.system.exacom?.nucleo ?? "nenhum") !== "nenhum";
  }

  /** Bônus do Núcleo para um Atributo: +2 no seu, +1 nos vizinhos, +0 no oposto. */
  bonusNucleo(atributo) {
    if (!this.noEXACOM) return { bonus: 0, tipo: "" };
    const nucleo = this.system.exacom.nucleo;
    if (atributo === CONFIG.EXAA.nucleoAtributo[nucleo]) return { bonus: 2, tipo: "Núcleo +2" };
    if (atributo === CONFIG.EXAA.nucleoAtributo[CONFIG.EXAA.nucleoOposto[nucleo]]) return { bonus: 0, tipo: "Oposto +0" };
    return { bonus: 1, tipo: "Lateral +1" };
  }

  /** Dados de Atributo + Habilidade + Núcleo − Marcas. */
  paradaDe(atributo, habilidade) {
    const sys = this.system;
    return (sys.atributos?.[atributo]?.value ?? 0)
      + (sys.habilidades?.[habilidade]?.value ?? 0)
      + this.bonusNucleo(atributo).bonus
      - (sys.sindrome?.value ?? 0);
  }

  /**
   * Quem contra-ataca rola os próprios dados: P da Ameaça, ou a parada de ataque escolhida pelo Piloto.
   * @param {"corpo"|"distancia"} [modo]
   */
  paradaDeContraAtaque(modo = "corpo") {
    if (this.type === "ameaca") {
      return { dados: this.system.periculosidade, detalhe: `Periculosidade (${this.system.periculosidade})` };
    }
    const [atributo, habilidade] = modo === "distancia" ? ["agilidade", "pontaria"] : ["fisico", "combate"];
    const dados = this.paradaDe(atributo, habilidade);
    return { dados, detalhe: `${CONFIG.EXAA.atributos[atributo]} + ${CONFIG.EXAA.habilidades[habilidade]} (${dados}d6)` };
  }

  /* ---------------- Sobrecarga ---------------- */

  /**
   * Motivo pelo qual a Sobrecarga não pode ser usada agora, ou null se pode.
   * @param {object} [estado]
   * @param {number} [estado.exapoints]  EXApoints a considerar (padrão: os atuais)
   */
  motivoSemSobrecarga({ exapoints = this.system.exapoints?.value ?? 0 } = {}) {
    const sys = this.system;
    if (!this.noEXACOM) return "fora do EXACOM";
    if (exapoints <= 0) return "sem EXApoints";
    if (Math.max(sys.dano?.piloto?.value ?? 0, sys.dano?.exacom?.value ?? 0) >= 2) return "Dano Grave";
    return null;
  }

  /**
   * Sobrecarga: gasta 1 EXApoint, transforma um dado em 6 e recebe 1 Marca.
   * @returns {Promise<boolean>} true se a Sobrecarga foi aplicada
   */
  async sobrecarga(message, btn) {
    const motivo = this.motivoSemSobrecarga();
    if (motivo) {
      ui.notifications.warn(`Sobrecarga indisponível: ${motivo}.`);
      return false;
    }

    const base = JSON.parse(btn.dataset.base || "[]");
    const exa = JSON.parse(btn.dataset.exa || "[]");
    const ataque = btn.dataset.ataque ? JSON.parse(btn.dataset.ataque) : null;

    // Converte o maior dado (o mais perto do 6) e garante o sucesso crítico
    const todos = [...base, ...exa];
    const convertido = Math.max(...todos);
    todos[todos.indexOf(convertido)] = 6;

    await marcarUsado(message, { texto: "Sobrecarga ativada" });

    let content = `<div class="exaa-roll-msg">
        <p>⚡ <strong>Sobrecarga EXACOM!</strong> Dado ${convertido} convertido em 6.</p>
        <p class="exaa-resultado">Novo resultado: <strong>Sucesso Crítico</strong></p>`;
    if (ataque) {
      const dano = danoDoGolpe(6, todos, ataque.porte);
      content += `<p class="exaa-dano">${textoDoGolpe(6, dano, ataque.porte)}</p>
        ${acoes(botoesAplicar(dano, ataque.alvos, `${this.name} (${ataque.arma})`))}`;
    }
    content += `<p class="exaa-consequence">1 EXApoint consumido e 1 Marca adicionada.</p></div>`;

    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });
    await this._perderEXApoints(1);
    return true;
  }

  /** EXApoints e Marcas são dois lados da mesma moeda: sempre somam 3. */
  _perderEXApoints(quantidade) {
    const novoEXA = Math.max(0, this.system.exapoints.value - quantidade);
    return this.update({
      "system.exapoints.value": novoEXA,
      "system.sindrome.value": Math.min(3, 3 - novoEXA)
    });
  }

  /* ---------------- Testes e ataques do Piloto ---------------- */

  /**
   * Teste de Atributo + Habilidade. Com `ataque`, vira um golpe e calcula o Dano pelo Porte.
   * @param {object} [ataque]  { arma, porte }
   */
  async rolarTeste({ atributo, habilidade, modificador = 0, exapoints = 0, ataque = null } = {}) {
    if (this.type !== "piloto") return;

    const sys = this.system;
    const valorAtributo = sys.atributos?.[atributo]?.value ?? 0;
    const valorHabilidade = sys.habilidades?.[habilidade]?.value ?? 0;
    const penalidade = sys.sindrome?.value ?? 0;
    const mod = Number(modificador) || 0;
    const { tipo: tipoEXACOM } = this.bonusNucleo(atributo);
    const dadosEXA = Math.max(0, Number(exapoints) || 0);

    const p = await rolarParada(this.paradaDe(atributo, habilidade) + mod, dadosEXA);

    const labelAtributo = CONFIG.EXAA.atributos[atributo] ?? atributo;
    const labelHabilidade = CONFIG.EXAA.habilidades[habilidade] ?? habilidade;
    const exaUms = p.exa.filter(r => r === 1).length;
    const exaRestante = Math.max(0, (sys.exapoints?.value ?? 0) - exaUms);

    let detalhe = `${labelAtributo} (${valorAtributo}) + ${labelHabilidade} (${valorHabilidade})`;
    if (mod !== 0) detalhe += ` + Mod (${mod > 0 ? "+" : ""}${mod})`;
    if (penalidade > 0) detalhe += ` − Marcas (${penalidade})`;
    if (tipoEXACOM) detalhe += ` + EXACOM (${tipoEXACOM})`;
    detalhe += p.usaPior ? " = sem dados: 2d6, fica o menor" : ` = ${p.numBase}d6`;
    if (dadosEXA > 0) detalhe += ` + ${dadosEXA}d6 EXA`;

    const alvos = ataque ? capturarAlvos() : [];
    const cabecalho = ataque
      ? `<strong>${this.name}</strong> ataca${alvos.length ? ` <strong>${alvos.map(a => a.nome).join(", ")}</strong>` : ""} com <em>${ataque.arma}</em> (Porte ${ataque.porte})`
      : `<strong>${this.name}</strong> testa <em>${labelAtributo} + ${labelHabilidade}</em>`;

    let content = `
      <div class="exaa-roll-msg">
        <p>${cabecalho}</p>
        <p class="exaa-detalhe">${detalhe}</p>
        ${htmlParada(p)}
        <p class="exaa-resultado">Resultado: <strong>${resultadoTeste(p.final)}</strong></p>`;

    let botoes = "";
    if (ataque) {
      const dano = danoDoGolpe(p.final, p.todos, ataque.porte);
      content += `<p class="exaa-dano">${textoDoGolpe(p.final, dano, ataque.porte)}</p>`;
      botoes += botoesAplicar(dano, alvos, `${this.name} (${ataque.arma})`);
      if (p.final <= 1) botoes += botoesContra(this, alvos);
    }

    if (exaUms > 0) {
      content += `
        <p class="exaa-consequence">⚠ ${exaUms} dado(s) EXA com resultado 1: ${exaUms} EXApoint(s) perdido(s) e ${exaUms} Marca(s) adicionada(s).</p>`;
    }

    if (this.noEXACOM) {
      const motivo = p.final === 6
        ? "já há um 6"
        : this.motivoSemSobrecarga({ exapoints: exaRestante });
      botoes += motivo
        ? `<button type="button" class="exaa-acao-btn exaa-sobrecarga-btn exaa-usado" disabled>Sobrecarga indisponível: ${motivo}</button>`
        : botao("sobrecarga", "Sobrecarga", {
            ator: this.uuid, base: p.base, exa: p.exa,
            ...(ataque ? { ataque: { ...ataque, alvos } } : {})
          }, "exaa-sobrecarga-btn");
    }

    content += `${acoes(botoes)}\n      </div>`;

    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });

    // Atualiza depois da mensagem, para que um eventual despertar do Gene EXA apareça em seguida
    if (exaUms > 0) await this._perderEXApoints(exaUms);
  }

  /**
   * Ataque com uma arma: Físico + Combate (arma branca) ou Agilidade + Pontaria (arma de fogo).
   * @param {object} arma  { nome, tipo: "arma-branca"|"arma-fogo", porte: 1-3 }
   */
  rolarAtaque(arma, { modificador = 0, exapoints = 0 } = {}) {
    const corpo = arma.tipo === "arma-branca";
    return this.rolarTeste({
      atributo: corpo ? "fisico" : "agilidade",
      habilidade: corpo ? "combate" : "pontaria",
      modificador, exapoints,
      ataque: { arma: arma.nome || (corpo ? "Arma Branca" : "Arma de Fogo"), porte: arma.porte }
    });
  }

  /** Armas do Piloto: equipamento a pé ("equip:N") ou módulo do EXACOM ("modulo:armaPrimaria"). */
  arma(chave) {
    const [origem, id] = String(chave).split(":");
    if (origem === "equip") {
      const e = this.system.equipamentos?.[Number(id)];
      return e && { nome: e.nome, tipo: e.tipo, porte: Number(e.porte) || 0 };
    }
    const m = this.system.exacom?.modulos?.[id];
    return m && { nome: m.nome, tipo: m.tipo, porte: PORTE_NUM[m.porte] ?? 0 };
  }

  async rolarEXA(quantidade) {
    if (this.type !== "piloto") return;
    const maxEXA = this.system.exapoints?.value ?? 0;
    if (maxEXA === 0) return;
    const n = Math.min(Math.max(1, quantidade), maxEXA);

    const p = await rolarParada(0, n);
    const uns = p.exa.filter(r => r === 1).length;

    let content = `
      <div class="exaa-roll-msg">
        <p><strong>${this.name}</strong> rola <em>EXApoints avulsos</em></p>
        ${htmlParada(p)}
        <p class="exaa-resultado">Resultado: <strong>${resultadoTeste(p.final)}</strong></p>`;
    if (uns > 0) {
      content += `
        <p class="exaa-consequence">⚠ ${uns} dado(s) com resultado 1: ${uns} EXApoint(s) perdido(s) e ${uns} Marca(s) adicionada(s).</p>`;
    }
    content += `\n      </div>`;

    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });
    if (uns > 0) await this._perderEXApoints(uns);
  }

  /* ---------------- Ataque da Ameaça ---------------- */

  /** A Ameaça rola P dados e causa Dano igual à sua Letalidade, pela mesma tabela dos Pilotos. */
  async rolarAtaqueAmeaca({ modificador = 0 } = {}) {
    if (this.type !== "ameaca") return;
    const { periculosidade: P, letalidade: L } = this.system;
    const mod = Number(modificador) || 0;
    const p = await rolarParada(P + mod);
    const dano = danoDoGolpe(p.final, p.todos, L);
    const alvos = capturarAlvos();

    let detalhe = `Periculosidade (${P})`;
    if (mod !== 0) detalhe += ` + Mod (${mod > 0 ? "+" : ""}${mod})`;
    detalhe += p.usaPior ? " = sem dados: 2d6, fica o menor" : ` = ${p.numBase}d6 · Letalidade ${L}`;

    let botoes = botoesAplicar(dano, alvos, this.name);
    if (p.final <= 1) botoes += botoesContra(this, alvos);

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="exaa-roll-msg">
        <p><strong>${this.name}</strong> ataca${alvos.length ? ` <strong>${alvos.map(a => a.nome).join(", ")}</strong>` : ""}</p>
        <p class="exaa-detalhe">${detalhe}</p>
        ${htmlParada(p)}
        <p class="exaa-resultado">Resultado: <strong>${resultadoTeste(p.final)}</strong></p>
        <p class="exaa-dano">${textoDoGolpe(p.final, dano, L)}</p>
        ${acoes(botoes)}
      </div>`
    });
  }

  /* ---------------- Receber Dano ---------------- */

  /** Redução de Dano: Blindagem dentro do EXACOM; soma das Proteções a pé. */
  reducaoDeDano() {
    if (this.type !== "piloto") return { valor: 0, fonte: "", trilha: null };
    if (this.system.exacom?.ativo) {
      return { valor: PORTE_NUM[this.system.exacom.modulos?.blindagem?.porte] ?? 0, fonte: "Blindagem", trilha: "exacom" };
    }
    const valor = (this.system.equipamentos ?? [])
      .filter(e => e?.tipo === "protecao")
      .reduce((soma, e) => soma + (Number(e.porte) || 0), 0);
    return { valor, fonte: "Proteção", trilha: "piloto" };
  }

  /** Dano final após a redução (nunca abaixo de 1). */
  previaDano(dano) {
    const { valor, fonte } = this.reducaoDeDano();
    const final = dano > 0 ? Math.max(1, dano - valor) : 0;
    return { final, reducao: valor, texto: `${dano} − ${fonte} ${valor}` };
  }

  async receberDano(dano, fonte = "") {
    const speaker = ChatMessage.getSpeaker({ actor: this });
    const de = fonte ? ` de ${fonte}` : "";

    if (this.type === "ameaca") {
      const antes = this.system.resistencia.value;
      const depois = Math.max(0, antes - dano);
      await this.update({ "system.resistencia.value": depois });
      // Só o Operador vê a Resistência: o desfecho fica a cargo da narrativa dele
      return ChatMessage.create({
        speaker,
        whisper: game.users.filter(u => u.isGM).map(u => u.id),
        content: `<div class="exaa-roll-msg">
          <p>💥 <strong>${this.name}</strong> sofre ${dano} de Dano${de}. Resistência ${antes} → ${depois}.</p>
        </div>`
      });
    }

    const { trilha } = this.reducaoDeDano();
    const { final, reducao, texto } = this.previaDano(dano);
    const caminho = `system.dano.${trilha}.value`;
    const depois = Math.min(3, (foundry.utils.getProperty(this, caminho) ?? 0) + final);
    await this.update({ [caminho]: depois });

    const exacom = trilha === "exacom";
    const quem = exacom ? `O EXACOM de <strong>${this.name}</strong>` : `<strong>${this.name}</strong>`;
    const consequencia = depois < 3 ? ""
      : exacom ? "Parada Total: o EXACOM pode ser destruído."
        : "Fora de Ação: abandonado ou finalizado, o Piloto pode morrer.";

    return ChatMessage.create({
      speaker,
      content: `<div class="exaa-roll-msg">
        <p>💥 ${quem} sofre ${final} de Dano${de}${reducao ? ` (${texto}, mínimo 1)` : ""}.</p>
        <p class="exaa-resultado">Condição: ${EXAAActor.condicaoPorDano(depois, exacom)}</p>
        ${consequencia ? `<p class="exaa-consequence">${consequencia}</p>` : ""}
      </div>`
    });
  }
}

export class EXAAItem extends Item {}
