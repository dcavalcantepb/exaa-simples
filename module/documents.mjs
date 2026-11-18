import {
  PORTE_NUM, LIMITE_DADOS, rolarParada, somarDadoEXA, cabeMaisUm, htmlParada, resultadoTeste, danoDoGolpe, textoDoGolpe,
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
      // Nível 1 vem em grupo: com metade abatida, perde 1 de P
      this.system.grupoEnfraquecido = this.system.letalidade === 1 && !!this.system.metadeAbatida;
      this.system.pEfetiva = this.system.periculosidade - (this.system.grupoEnfraquecido ? 1 : 0);
    }
  }

  /** Guarda as Marcas de antes da atualização, para saber se a Síndrome avançou. */
  async _preUpdate(changed, options, user) {
    if ((await super._preUpdate(changed, options, user)) === false) return false;
    if (this.type === "piloto") options.exaaMarcasAntes = this.system.sindrome?.value ?? 0;

    // Na Ameaça de ambiente, mudar o total de R preserva as marcas de superação já feitas
    const novoMax = foundry.utils.getProperty(changed, "system.resistencia.max");
    if (this.type === "ameaca" && this.system.ambiente && novoMax !== undefined
      && foundry.utils.getProperty(changed, "system.resistencia.value") === undefined) {
      const marcadas = this.system.resistencia.max - this.system.resistencia.value;
      foundry.utils.setProperty(changed, "system.resistencia.value", Math.max(0, novoMax - marcadas));
    }
  }

  /** Narra cada Marca nova e dispara o despertar do Gene EXA com 3, venha de onde vier. */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    if (this.type !== "piloto" || userId !== game.user.id) return;
    const marcas = foundry.utils.getProperty(changed, "system.sindrome.value");
    if (marcas === undefined || marcas <= (options.exaaMarcasAntes ?? 0)) return;
    if (marcas >= 3) this._despertarGeneEXA();
    else this._narrarMarca(marcas);
  }

  async _narrarMarca(marcas) {
    const sinais = {
      1: "As veias escurecem sob a pele; ecos estranhos sussurram no EXAlink.",
      2: "Os olhos brilham, o nariz sangra; a fúria começa a falar mais alto que as ordens."
    };
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="exaa-roll-msg exaa-marca">
        <p>🩸 <strong>A Síndrome avança:</strong> ${this.name} carrega ${marcas} Marca${marcas > 1 ? "s" : ""}.</p>
        <p class="exaa-narracao">${sinais[marcas]}</p>
      </div>`
    });
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
    if (this.system.dano?.piloto?.morto) return "Morto";
    return EXAAActor.condicaoPorDano(this.system.dano?.piloto?.value ?? 0, false);
  }

  get condicaoEXACOM() {
    if (this.system.dano?.exacom?.destruido) return "Destruído";
    return EXAAActor.condicaoPorDano(this.system.dano?.exacom?.value ?? 0, true);
  }

  /** Nível para os sinais vitais da ficha: o Dano (0–3), ou 4 se Morto / Destruído. */
  get nivelVitalPiloto() {
    return this.system.dano?.piloto?.morto ? 4 : (this.system.dano?.piloto?.value ?? 0);
  }

  get nivelVitalEXACOM() {
    return this.system.dano?.exacom?.destruido ? 4 : (this.system.dano?.exacom?.value ?? 0);
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
    if (this.type === "ameaca") return { dados: this.system.pEfetiva, detalhe: this.detalheP() };
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
      content += `<p class="exaa-dano">${textoDoGolpe(6, dano, ataque.porte, todos)}</p>
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
   * @param {number} [ajuda]   Pilotos ajudando (até 2): +1d cada
   * @param {object} [ataque]  { arma, porte }
   */
  async rolarTeste({ atributo, habilidade, modificador = 0, ajuda = 0, exapoints = 0, ataque = null } = {}) {
    if (this.type !== "piloto") return;

    const sys = this.system;
    const valorAtributo = sys.atributos?.[atributo]?.value ?? 0;
    const valorHabilidade = sys.habilidades?.[habilidade]?.value ?? 0;
    const penalidade = sys.sindrome?.value ?? 0;
    const mod = Number(modificador) || 0;
    const ajudantes = Math.clamp(Number(ajuda) || 0, 0, 2);
    // Ajuda é uma vantagem como outra qualquer: somadas, as vantagens não passam de +3
    const externo = Math.min(3, mod + ajudantes);
    const { tipo: tipoEXACOM } = this.bonusNucleo(atributo);
    const dadosEXA = Math.max(0, Number(exapoints) || 0);

    const p = await rolarParada(this.paradaDe(atributo, habilidade) + externo, dadosEXA);

    const labelAtributo = CONFIG.EXAA.atributos[atributo] ?? atributo;
    const labelHabilidade = CONFIG.EXAA.habilidades[habilidade] ?? habilidade;

    let detalhe = `${labelAtributo} (${valorAtributo}) + ${labelHabilidade} (${valorHabilidade})`;
    if (ajudantes > 0) detalhe += ` + Ajuda (+${ajudantes})`;
    if (mod !== 0) detalhe += ` + Mod (${mod > 0 ? "+" : ""}${mod})`;
    if (externo < mod + ajudantes) detalhe += ` (vantagens limitadas a +3)`;
    if (penalidade > 0) detalhe += ` − Marcas (${penalidade})`;
    if (tipoEXACOM) detalhe += ` + EXACOM (${tipoEXACOM})`;
    detalhe += p.usaPior ? " = sem dados: 2d6, fica o menor" : ` = ${p.numBase}d6`;
    if (p.exa.length > 0) detalhe += ` + ${p.exa.length}d6 EXA`;
    if (p.cortados > 0) detalhe += ` (limite de ${LIMITE_DADOS} dados)`;
    if (p.exaFora > 0) {
      detalhe += ` · ${p.exaFora} EXApoint${p.exaFora > 1 ? "s" : ""} não ${p.exaFora > 1 ? "couberam" : "coube"} na mão e não ${p.exaFora > 1 ? "foram gastos" : "foi gasto"}`;
    }

    const alvos = ataque ? capturarAlvos() : [];
    const cabecalho = ataque
      ? `<strong>${this.name}</strong> ataca${alvos.length ? ` <strong>${alvos.map(a => a.nome).join(", ")}</strong>` : ""} com <em>${ataque.arma}</em> (Porte ${ataque.porte})`
      : `<strong>${this.name}</strong> testa <em>${labelAtributo} + ${labelHabilidade}</em>`;

    await this._mensagemTeste({ cabecalho, detalhe, ataque: ataque && { ...ataque, alvos } }, p, p.exa);
  }

  /**
   * Publica o resultado de um Teste e aplica a perda de EXApoints dos dados EXA novos que mostraram 1.
   * @param {object} teste        { cabecalho, detalhe, ataque: { arma, porte, alvos } | null }
   * @param {object} p            parada rolada (ver rolarParada)
   * @param {number[]} exaNovos   dados EXA rolados agora (os antigos já foram cobrados)
   * @param {string} [prefacio]   linha de abertura (ex.: +1 EXApoint)
   */
  async _mensagemTeste(teste, p, exaNovos, prefacio = "") {
    const { ataque } = teste;
    const exaUms = exaNovos.filter(r => r === 1).length;
    const exaDepois = Math.max(0, (this.system.exapoints?.value ?? 0) - exaUms);
    // EXApoints ainda livres: os que não estão neste Teste como dados EXA que sobreviveram
    const exaLivres = exaDepois - p.exa.filter(r => r !== 1).length;

    let content = `
      <div class="exaa-roll-msg">
        ${prefacio}
        <p>${teste.cabecalho}</p>
        <p class="exaa-detalhe">${teste.detalhe}</p>
        ${htmlParada(p)}
        <p class="exaa-resultado">Resultado: <strong>${resultadoTeste(p.final)}</strong></p>`;

    let botoes = "";
    if (ataque) {
      const dano = danoDoGolpe(p.final, p.todos, ataque.porte);
      content += `<p class="exaa-dano">${textoDoGolpe(p.final, dano, ataque.porte, p.todos)}</p>`;
      botoes += botoesAplicar(dano, ataque.alvos, `${this.name} (${ataque.arma})`);
      if (p.final <= 1) botoes += botoesContra(this, ataque.alvos);
    }

    if (exaUms > 0) {
      content += `
        <p class="exaa-consequence">⚠ ${exaUms} dado(s) EXA com resultado 1: ${exaUms} EXApoint(s) perdido(s) e ${exaUms} Marca(s) adicionada(s).</p>`;
    }

    // EXApoints valem a qualquer momento; num Teste comum, depois de um 6 não há o que melhorar
    if (exaLivres > 0 && cabeMaisUm(p) && (p.final < 6 || ataque)) {
      botoes += botao("exa", `+1 EXApoint (livres: ${exaLivres})`, {
        ator: this.uuid, teste, parada: { usaPior: p.usaPior, numBase: p.numBase, base: p.base, exa: p.exa }
      }, "exaa-exa-btn");
    }

    if (this.noEXACOM) {
      const motivo = p.final === 6
        ? "já há um 6"
        : this.motivoSemSobrecarga({ exapoints: exaDepois });
      botoes += motivo
        ? `<button type="button" class="exaa-acao-btn exaa-sobrecarga-btn exaa-usado" disabled>Sobrecarga indisponível: ${motivo}</button>`
        : botao("sobrecarga", "Sobrecarga", {
            ator: this.uuid, base: p.base, exa: p.exa,
            ...(ataque ? { ataque } : {})
          }, "exaa-sobrecarga-btn");
    }

    content += `${acoes(botoes)}\n      </div>`;

    await ChatMessage.create({ speaker: ChatMessage.getSpeaker({ actor: this }), content });

    // Atualiza depois da mensagem, para que as Marcas e o Gene EXA apareçam em seguida
    if (exaUms > 0) await this._perderEXApoints(exaUms);
  }

  /**
   * +1 EXApoint depois da rolagem: soma um dado EXA ao Teste e refaz o resultado (e o Dano, se for ataque).
   * @returns {Promise<boolean>}
   */
  async maisUmEXA(message, btn) {
    const teste = JSON.parse(btn.dataset.teste);
    const anterior = JSON.parse(btn.dataset.parada);
    const livres = (this.system.exapoints?.value ?? 0) - anterior.exa.filter(r => r !== 1).length;
    if (livres <= 0) {
      ui.notifications.warn(`${this.name} não tem EXApoints livres para somar a este Teste.`);
      return false;
    }
    if (!cabeMaisUm(anterior)) {
      ui.notifications.warn(`A mão já tem ${LIMITE_DADOS} dados.`);
      return false;
    }

    const { p, novo } = await somarDadoEXA(anterior);
    await marcarUsado(message, { texto: "+1 EXApoint somado (veja abaixo)" });

    const detalhe = anterior.usaPior
      ? teste.detalhe.replace(" = sem dados: 2d6, fica o menor", " = 0d6") + " + 1d6 EXA"
      : `${teste.detalhe} + 1d6 EXA`;
    const prefacio = `<p>✚ <strong>+1 EXApoint!</strong> O dado EXA mostra ${novo}.</p>`;
    await this._mensagemTeste({ ...teste, detalhe }, p, [novo], prefacio);
    return true;
  }

  /**
   * Ataque com uma arma: Físico + Combate (arma branca) ou Agilidade + Pontaria (arma de fogo).
   * @param {object} arma  { nome, tipo: "arma-branca"|"arma-fogo", porte: 1-3 }
   */
  rolarAtaque(arma, { modificador = 0, ajuda = 0, exapoints = 0 } = {}) {
    const corpo = arma.tipo === "arma-branca";
    return this.rolarTeste({
      atributo: corpo ? "fisico" : "agilidade",
      habilidade: corpo ? "combate" : "pontaria",
      modificador, ajuda, exapoints,
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

  /* ---------------- Ponto de Protagonismo ---------------- */

  static PLOT_TWISTS = {
    flashback: { nome: "Flashback", texto: "Revele uma preparação feita antes da cena." },
    revelacao: { nome: "Revelação", texto: "Introduza um fato novo, sem contradizer a cena." },
    ultimoEsforco: { nome: "Último Esforço", texto: "Aja uma última vez antes de sofrer as consequências finais." },
    contraTodas: { nome: "Contra Todas as Chances", texto: "Anule, de forma épica, uma rolagem do Operador." }
  };

  /** Gasta o Ponto de Protagonismo e anuncia o Plot Twist proposto; o Operador valida se for plausível. */
  async usarProtagonismo(chave, proposta = "") {
    const twist = EXAAActor.PLOT_TWISTS[chave];
    if (this.type !== "piloto" || !twist) return;
    if ((this.system.protagonismo ?? 0) < 1) {
      ui.notifications.warn(`${this.name} não tem Ponto de Protagonismo.`);
      return;
    }
    await this.update({ "system.protagonismo": 0 });
    const texto = proposta.trim();
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="exaa-roll-msg exaa-plot-twist">
        <p>🌟 <strong>${this.name}</strong> gasta o Ponto de Protagonismo: <strong>${twist.nome}</strong></p>
        <p class="exaa-detalhe">${twist.texto}</p>
        ${texto ? `<p class="exaa-narracao">“${Handlebars.escapeExpression(texto)}”</p>` : ""}
        <p class="exaa-consequence">O Operador valida se for plausível.</p>
      </div>`
    });
  }

  /* ---------------- Ataque da Ameaça ---------------- */

  /** A Ameaça rola P dados e causa Dano igual à sua Letalidade, pela mesma tabela dos Pilotos. */
  /** "Periculosidade (3)", ou "Periculosidade (3) − Grupo pela metade (1)" para o grupo enfraquecido. */
  detalheP() {
    const { periculosidade: P, grupoEnfraquecido } = this.system;
    return `Periculosidade (${P})${grupoEnfraquecido ? " − Grupo pela metade (1)" : ""}`;
  }

  async rolarAtaqueAmeaca({ modificador = 0 } = {}) {
    if (this.type !== "ameaca") return;
    const { pEfetiva: P, letalidade: L } = this.system;
    const mod = Number(modificador) || 0;
    const p = await rolarParada(P + mod);
    const dano = danoDoGolpe(p.final, p.todos, L);
    const alvos = capturarAlvos();

    let detalhe = this.detalheP();
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
        <p class="exaa-dano">${textoDoGolpe(p.final, dano, L, p.todos)}</p>
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
