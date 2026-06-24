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
      : ["Perfeito Estado", "Dano Leve", "Dano Grave", "Fora de Acao"];
    return condicoes[Math.clamp(Number(dano) || 0, 0, 3)];
  }

  async rolarTeste({ atributo, habilidade, modificador = 0, exapoints = 0 } = {}) {
    if (this.type !== "piloto") return;

    const valorAtributo = this.system.atributos?.[atributo]?.value ?? 0;
    const valorHabilidade = this.system.habilidades?.[habilidade]?.value ?? 0;
    const penalidade = this.system.sindrome?.value ?? 0;
    const dadosBase = valorAtributo + valorHabilidade + Number(modificador) - penalidade;
    const dadosEXA = Math.max(0, Number(exapoints) || 0);
    const usaPior = dadosBase <= 0 && dadosEXA === 0;

    const numBase = usaPior ? 2 : Math.min(10, Math.max(1, dadosBase));
    const rollBase = await new Roll(`${numBase}d6`).evaluate();
    const resultadosBase = rollBase.dice[0].results.map(r => r.result);

    let resultadosEXA = [];
    if (dadosEXA > 0) {
      const rollEXA = await new Roll(`${dadosEXA}d6`).evaluate();
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

    let content = `
      <div class="exaa-roll-msg">
        <p><strong>${this.name}</strong> testa <em>${labelAtributo} + ${labelHabilidade}</em></p>
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
