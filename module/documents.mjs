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
    const totalDados = Math.min(10, Math.max(0, dadosBase) + dadosEXA);
    const usaPior = dadosBase <= 0 && dadosEXA === 0;
    const formula = usaPior ? "2d6kl1" : `${Math.max(1, totalDados)}d6kh1`;
    const roll = await new Roll(formula).evaluate();
    const maior = roll.total;
    const resultado = EXAAActor.resultadoTeste(maior);
    const labelAtributo = CONFIG.EXAA.atributos[atributo] ?? atributo;
    const labelHabilidade = CONFIG.EXAA.habilidades[habilidade] ?? habilidade;

    return roll.toMessage({
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `
        <strong>${this.name}</strong> testa ${labelAtributo} + ${labelHabilidade}<br>
        Dados: ${usaPior ? "2d6, mantendo o menor" : `${Math.max(1, totalDados)}d6, mantendo o maior`}<br>
        Resultado: <strong>${resultado}</strong>
      `
    });
  }

  static resultadoTeste(valor) {
    if (valor <= 1) return "Falha Critica";
    if (valor <= 3) return "Falha";
    if (valor <= 5) return "Sucesso com custo";
    return "Sucesso Critico";
  }
}

export class EXAAItem extends Item {}
