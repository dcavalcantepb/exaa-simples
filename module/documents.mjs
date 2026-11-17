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

  /**
   * Motivo pelo qual a Sobrecarga não pode ser usada agora, ou null se pode.
   * @param {object} [estado]
   * @param {number} [estado.exapoints]  EXApoints a considerar (padrão: os atuais)
   */
  motivoSemSobrecarga({ exapoints = this.system.exapoints?.value ?? 0 } = {}) {
    const sys = this.system;
    if (!sys.exacom?.ativo || (sys.exacom?.nucleo ?? "nenhum") === "nenhum") return "fora do EXACOM";
    if (exapoints <= 0) return "sem EXApoints";
    if (Math.max(sys.dano?.piloto?.value ?? 0, sys.dano?.exacom?.value ?? 0) >= 2) return "Dano Grave";
    return null;
  }

  async rolarTeste({ atributo, habilidade, modificador = 0, exapoints = 0 } = {}) {
    if (this.type !== "piloto") return;

    const valorAtributo = this.system.atributos?.[atributo]?.value ?? 0;
    const valorHabilidade = this.system.habilidades?.[habilidade]?.value ?? 0;
    const penalidade = this.system.sindrome?.value ?? 0;
    const mod = Number(modificador) || 0;

    // Bônus do Núcleo EXACOM (lido do campo Ativo na ficha)
    let bonusEXACOM = 0;
    let tipoEXACOM = "";
    const exalink = this.system.exacom?.ativo ?? false;
    const nucleo = this.system.exacom?.nucleo ?? "nenhum";
    if (exalink && nucleo !== "nenhum") {
      const atribNucleo  = CONFIG.EXAA.nucleoAtributo[nucleo];
      const atribOposto  = CONFIG.EXAA.nucleoAtributo[CONFIG.EXAA.nucleoOposto[nucleo]];
      if (atributo === atribNucleo)       { bonusEXACOM = 2; tipoEXACOM = "Núcleo +2"; }
      else if (atributo === atribOposto)  { bonusEXACOM = 0; tipoEXACOM = "Oposto +0"; }
      else                                { bonusEXACOM = 1; tipoEXACOM = "Lateral +1"; }
    }

    // Sem dados: rola 2d6 e fica o menor. Com EXApoints por cima, rolam-se só os dados EXA, normalmente.
    const dadosBase = valorAtributo + valorHabilidade + mod - penalidade + bonusEXACOM;
    const dadosEXA = Math.max(0, Number(exapoints) || 0);
    const usaPior = dadosBase <= 0 && dadosEXA === 0;
    const numBase = usaPior ? 2 : Math.min(10, Math.max(0, dadosBase));

    const rolar = async n => (n > 0 ? new Roll(`${n}d6`).evaluate() : null);
    const valores = roll => roll?.dice[0].results.map(r => r.result) ?? [];
    const rollBase = await rolar(numBase);
    const rollEXA = await rolar(dadosEXA);
    const resultadosBase = valores(rollBase);
    const resultadosEXA = valores(rollEXA);

    const resultadoFinal = usaPior
      ? Math.min(...resultadosBase)
      : Math.max(...resultadosBase, ...resultadosEXA);

    const resultado = EXAAActor.resultadoTeste(resultadoFinal);
    const labelAtributo = CONFIG.EXAA.atributos[atributo] ?? atributo;
    const labelHabilidade = CONFIG.EXAA.habilidades[habilidade] ?? habilidade;

    const exaUms = resultadosEXA.filter(r => r === 1).length;
    const exaRestante = Math.max(0, (this.system.exapoints?.value ?? 0) - exaUms);

    const renderDice = (results, isEXA, winnerVal, winnerAlreadyFound) => {
      let found = winnerAlreadyFound;
      const html = results.map(v => {
        let cls = `exaa-die${isEXA ? " exa" : ""}`;
        if (isEXA && v === 1) cls += " miss";
        if (!found && v === winnerVal) { cls += " winner"; found = true; }
        return `<span class="${cls}">${v}</span>`;
      }).join("");
      return { html, winnerFound: found };
    };

    const { html: baseHtml, winnerFound } = renderDice(resultadosBase, false, resultadoFinal, false);
    const { html: exaHtml } = renderDice(resultadosEXA, true, resultadoFinal, winnerFound);

    const partes = [
      `${labelAtributo} (${valorAtributo})`,
      `${labelHabilidade} (${valorHabilidade})`
    ];
    if (mod !== 0) partes.push(`Mod (${mod > 0 ? "+" : ""}${mod})`);
    let detalheParada = partes.join(" + ");
    if (penalidade > 0) detalheParada += ` − Marcas (${penalidade})`;
    if (exalink && nucleo !== "nenhum") detalheParada += ` + EXACOM (${tipoEXACOM})`;
    detalheParada += usaPior ? " = sem dados: 2d6, fica o menor" : ` = ${numBase}d6`;
    if (dadosEXA > 0) detalheParada += ` + ${dadosEXA}d6 EXA`;

    let content = `
      <div class="exaa-roll-msg">
        <p><strong>${this.name}</strong> testa <em>${labelAtributo} + ${labelHabilidade}</em></p>
        <p class="exaa-detalhe">${detalheParada}</p>`;

    if (resultadosBase.length > 0) {
      content += `
        <div class="exaa-dice-group">
          <span class="exaa-dice-label">${usaPior ? "Dados (2d6, mantendo o menor)" : `Dados Base (${numBase}d6)`}:</span>
          <span class="exaa-dice-values">${baseHtml}</span>
        </div>`;
    }

    if (resultadosEXA.length > 0) {
      content += `
        <div class="exaa-dice-group">
          <span class="exaa-dice-label">EXApoints (${dadosEXA}d6):</span>
          <span class="exaa-dice-values">${exaHtml}</span>
        </div>`;
    }

    content += `
        <p class="exaa-resultado">Resultado: <strong>${resultado}</strong></p>`;

    if (exaUms > 0) {
      content += `
        <p class="exaa-consequence">⚠ ${exaUms} dado(s) EXA com resultado 1: ${exaUms} EXApoint(s) perdido(s) e ${exaUms} Marca(s) adicionada(s).</p>`;
    }

    if (exalink && nucleo !== "nenhum") {
      const temSeis = [...resultadosBase, ...resultadosEXA].includes(6);
      const motivo = temSeis ? "já há um 6" : this.motivoSemSobrecarga({ exapoints: exaRestante });
      content += motivo
        ? `<div class="exaa-sobrecarga-wrapper"><button class="exaa-sobrecarga-btn exaa-sobrecarga-usada" disabled>Sobrecarga indisponível: ${motivo}</button></div>`
        : `<div class="exaa-sobrecarga-wrapper"><button class="exaa-sobrecarga-btn" data-actor-id="${this.id}" data-resultados-base='${JSON.stringify(resultadosBase)}' data-resultados-exa='${JSON.stringify(resultadosEXA)}'>Sobrecarga</button></div>`;
    }

    content += `\n      </div>`;

    // Anima dados pelo DSN sem passar rolls ao ChatMessage
    // (passar rolls ao ChatMessage faz o Foundry v13 renderizar os dados brutos junto ao nosso HTML)
    if (game.dice3d) {
      for (const roll of [rollBase, rollEXA].filter(Boolean)) {
        await game.dice3d.showForRoll(roll, game.user, true, null, false);
      }
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content
    });

    // Atualiza depois da mensagem, para que um eventual despertar do Gene EXA apareça em seguida
    if (exaUms > 0) await this._perderEXApoints(exaUms);
  }

  /**
   * Sobrecarga: gasta 1 EXApoint, transforma um dado em 6 e recebe 1 Marca.
   * @returns {Promise<boolean>} true se a Sobrecarga foi aplicada
   */
  async sobrecarga(message, resultadosBase, resultadosEXA) {
    const motivo = this.motivoSemSobrecarga();
    if (motivo) {
      ui.notifications.warn(`Sobrecarga indisponível: ${motivo}.`);
      return false;
    }

    await message.update({
      content: message.content.replace(
        /<div class="exaa-sobrecarga-wrapper">[\s\S]*?<\/div>/,
        '<div class="exaa-sobrecarga-wrapper"><button class="exaa-sobrecarga-btn exaa-sobrecarga-usada" disabled>✓ Sobrecarga ativada</button></div>'
      )
    });

    const convertido = Math.max(...resultadosBase, ...resultadosEXA);
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content: `<div class="exaa-roll-msg">
        <p>⚡ <strong>Sobrecarga EXACOM!</strong> Dado ${convertido} convertido em 6.</p>
        <p class="exaa-resultado">Novo resultado: <strong>Sucesso Crítico</strong></p>
        <p class="exaa-consequence">1 EXApoint consumido e 1 Marca adicionada.</p>
      </div>`
    });

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

  async rolarEXA(quantidade) {
    if (this.type !== "piloto") return;
    const maxEXA = this.system.exapoints?.value ?? 0;
    if (maxEXA === 0) return;
    const n = Math.min(Math.max(1, quantidade), maxEXA);

    const roll = await new Roll(`${n}d6`).evaluate();
    const resultados = roll.dice[0].results.map(r => r.result);
    const melhor = Math.max(...resultados);
    const resultado = EXAAActor.resultadoTeste(melhor);
    const uns = resultados.filter(r => r === 1).length;

    if (game.dice3d) {
      await game.dice3d.showForRoll(roll, game.user, true, null, false);
    }

    let winnerFound = false;
    const diceHtml = resultados.map(v => {
      let cls = "exaa-die exa";
      if (v === 1) cls += " miss";
      if (!winnerFound && v === melhor) { cls += " winner"; winnerFound = true; }
      return `<span class="${cls}">${v}</span>`;
    }).join("");

    let content = `
      <div class="exaa-roll-msg">
        <p><strong>${this.name}</strong> rola <em>EXApoints avulsos</em></p>
        <div class="exaa-dice-group">
          <span class="exaa-dice-label">EXApoints (${n}d6):</span>
          <span class="exaa-dice-values">${diceHtml}</span>
        </div>
        <p class="exaa-resultado">Resultado: <strong>${resultado}</strong></p>`;

    if (uns > 0) {
      content += `
        <p class="exaa-consequence">⚠ ${uns} dado(s) com resultado 1: ${uns} EXApoint(s) perdido(s) e ${uns} Marca(s) adicionada(s).</p>`;
    }

    content += `\n      </div>`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content
    });

    if (uns > 0) await this._perderEXApoints(uns);
  }

  static resultadoTeste(valor) {
    if (valor <= 1) return "Falha Crítica";
    if (valor <= 3) return "Falha";
    if (valor <= 5) return "Sucesso com Custo";
    return "Sucesso Crítico";
  }
}

export class EXAAItem extends Item {}
