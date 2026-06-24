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
    }
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

  async rolarTeste({ atributo, habilidade, modificador = 0, exapoints = 0 } = {}) {
    if (this.type !== "piloto") return;

    const valorAtributo = this.system.atributos?.[atributo]?.value ?? 0;
    const valorHabilidade = this.system.habilidades?.[habilidade]?.value ?? 0;
    const penalidade = this.system.sindrome?.value ?? 0;

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

    const dadosBase = valorAtributo + valorHabilidade + Number(modificador) - penalidade + bonusEXACOM;
    const dadosEXA = Math.max(0, Number(exapoints) || 0);
    const usaPior = dadosBase <= 0 && dadosEXA === 0;

    const numBase = usaPior ? 2 : Math.min(10, Math.max(1, dadosBase));
    const rollBase = await new Roll(`${numBase}d6`).evaluate();
    const resultadosBase = rollBase.dice[0].results.map(r => r.result);

    let rollEXA = null;
    let resultadosEXA = [];
    if (dadosEXA > 0) {
      rollEXA = await new Roll(`${dadosEXA}d6`).evaluate();
      resultadosEXA = rollEXA.dice[0].results.map(r => r.result);
    }

    const resultadoFinal = usaPior
      ? Math.min(...resultadosBase)
      : Math.max(...resultadosBase, ...resultadosEXA);

    const resultado = EXAAActor.resultadoTeste(resultadoFinal);
    const labelAtributo = CONFIG.EXAA.atributos[atributo] ?? atributo;
    const labelHabilidade = CONFIG.EXAA.habilidades[habilidade] ?? habilidade;

    const exaUms = resultadosEXA.filter(r => r === 1).length;
    if (exaUms > 0) {
      const novoEXA = Math.max(0, this.system.exapoints.value - exaUms);
      await this.update({
        "system.exapoints.value": novoEXA,
        "system.sindrome.value": Math.min(3, 3 - novoEXA)
      });
    }

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

    const labelBase = usaPior
      ? `Dados (${numBase}d6, mantendo o menor)`
      : `Dados Base (${numBase}d6)`;

    const partes = [
      `${labelAtributo} (${valorAtributo})`,
      `${labelHabilidade} (${valorHabilidade})`
    ];
    if (Number(modificador) !== 0) partes.push(`Mod (${Number(modificador) > 0 ? "+" : ""}${modificador})`);
    let detalheParada = partes.join(" + ");
    if (penalidade > 0) detalheParada += ` − Marcas (${penalidade})`;
    if (exalink && nucleo !== "nenhum") detalheParada += ` + EXACOM (${tipoEXACOM})`;
    detalheParada += ` = ${usaPior ? "2d6 (pior)" : `${numBase}d6`}`;

    let content = `
      <div class="exaa-roll-msg">
        <p><strong>${this.name}</strong> testa <em>${labelAtributo} + ${labelHabilidade}</em></p>
        <p class="exaa-detalhe">${detalheParada}</p>
        <div class="exaa-dice-group">
          <span class="exaa-dice-label">${labelBase}:</span>
          <span class="exaa-dice-values">${baseHtml}</span>
        </div>`;

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
      const temSeis = [...resultadosBase, ...resultadosEXA].some(v => v === 6);
      if (temSeis) {
        content += `<div class="exaa-sobrecarga-wrapper"><button class="exaa-sobrecarga-btn exaa-sobrecarga-usada" disabled>Sobrecarga Indisponível</button></div>`;
      } else {
        content += `<div class="exaa-sobrecarga-wrapper"><button class="exaa-sobrecarga-btn" data-actor-id="${this.id}" data-resultados-base='${JSON.stringify(resultadosBase)}' data-resultados-exa='${JSON.stringify(resultadosEXA)}' data-resultado-final="${resultadoFinal}">Sobrecarga</button></div>`;
      }
    }

    content += `\n      </div>`;

    // Anima dados pelo DSN sem passar rolls ao ChatMessage
    // (passar rolls ao ChatMessage faz o Foundry v13 renderizar os dados brutos junto ao nosso HTML)
    if (game.dice3d) {
      const rollsToShow = [rollBase, rollEXA].filter(Boolean);
      for (const roll of rollsToShow) {
        await game.dice3d.showForRoll(roll, game.user, true, null, false);
      }
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      content
    });
  }

  async rolarEXA(quantidade) {
    if (this.type !== "piloto") return;
    const maxEXA = this.system.exapoints?.value ?? 0;
    const n = Math.min(Math.max(1, quantidade), maxEXA);

    const roll = await new Roll(`${n}d6`).evaluate();
    const resultados = roll.dice[0].results.map(r => r.result);
    const melhor = Math.max(...resultados);
    const resultado = EXAAActor.resultadoTeste(melhor);

    const uns = resultados.filter(r => r === 1).length;
    if (uns > 0) {
      const novoEXA = Math.max(0, this.system.exapoints.value - uns);
      await this.update({
        "system.exapoints.value": novoEXA,
        "system.sindrome.value": Math.min(3, 3 - novoEXA)
      });
    }

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
  }

  static resultadoTeste(valor) {
    if (valor <= 1) return "Falha Crítica";
    if (valor <= 3) return "Falha";
    if (valor <= 5) return "Sucesso com Custo";
    return "Sucesso Crítico";
  }
}

export class EXAAItem extends Item {}
