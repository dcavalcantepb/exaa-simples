export class EXAAActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["exaa", "sheet", "actor"],
      width: 760,
      height: 760,
      tabs: [
        {
          navSelector: ".sheet-tabs",
          contentSelector: ".sheet-body",
          initial: "piloto"
        }
      ]
    });
  }

  get template() {
    return this.actor.type === "ameaca"
      ? "systems/exaa-simples/templates/ameaca-sheet.hbs"
      : "systems/exaa-simples/templates/piloto-sheet.hbs";
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = this.actor.system;
    context.atributos = CONFIG.EXAA.atributos;
    context.habilidades = CONFIG.EXAA.habilidades;
    context.nucleos = CONFIG.EXAA.nucleos;
    context.gruposHabilidades = CONFIG.EXAA.grupos.map(g => ({
      atributoKey: g.key,
      atributoLabel: g.label,
      atributoValue: this.actor.system.atributos[g.key]?.value ?? 0,
      habilidades: g.habilidades.map(hk => ({
        key: hk,
        label: CONFIG.EXAA.habilidades[hk],
        value: this.actor.system.habilidades[hk]?.value ?? 0
      }))
    }));
    context.condicaoPiloto = this.actor.condicaoPiloto;
    context.condicaoEXACOM = this.actor.condicaoEXACOM;
    context.exapointsBoxes = Array.from({ length: 3 }, (_, i) => i < this.actor.system.exapoints.value);
    context.sindromeBoxes = Array.from({ length: 3 }, (_, i) => i < this.actor.system.sindrome.value);
    context.protagonismoChecked = this.actor.system.protagonismo >= 1;
    context.cargaOptions = [
      { value: "leve",   label: "Leve (3 pts)",  selected: this.actor.system.carga === "leve" },
      { value: "medio",  label: "Médio (5 pts)", selected: this.actor.system.carga === "medio" },
      { value: "pesado", label: "Pesado (7 pts)", selected: this.actor.system.carga === "pesado" }
    ];
    const TIPO_OPTIONS = [
      { value: "",             label: "Vazio" },
      { value: "arma-fogo",   label: "Arma de Fogo" },
      { value: "arma-branca", label: "Arma Branca" },
      { value: "ferramenta",  label: "Ferramenta" },
      { value: "protecao",    label: "Proteção" }
    ];
    const PORTE_OPTIONS = [
      { value: 0, label: "Vazio" },
      { value: 1, label: "Leve (1 pt)" },
      { value: 2, label: "Médio (2 pts)" },
      { value: 3, label: "Pesado (3 pts)" }
    ];
    const CARGA_MAX = { leve: 3, medio: 5, pesado: 7 };
    const equips = this.actor.system.equipamentos ?? [];
    context.equipamentosLista = Array.from({ length: 5 }, (_, i) => {
      const e = equips[i] ?? {};
      const tipoVal  = e.tipo  ?? "";
      const porteVal = e.porte ?? 0;
      return {
        nome:  e.nome ?? "",
        tipo:  tipoVal,
        porte: porteVal,
        index: i,
        numero: i + 1,
        tipoOptions:  TIPO_OPTIONS.map(o => ({ ...o, selected: o.value === tipoVal })),
        porteOptions: PORTE_OPTIONS.map(o => ({ ...o, selected: o.value === porteVal }))
      };
    });
    context.porteTotal    = equips.reduce((sum, e) => sum + (e?.porte ?? 0), 0);
    context.cargaMax      = CARGA_MAX[this.actor.system.carga] ?? 5;
    context.cargaExcedida = context.porteTotal > context.cargaMax;
    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-roll-skill]").on("click", async event => {
      const habilidade = event.currentTarget.dataset.rollSkill;
      const habilidadeLabel = CONFIG.EXAA.habilidades[habilidade] ?? habilidade;
      const atributo = CONFIG.EXAA.habilidadeAtributo[habilidade];
      const params = await this._abrirDialogoTeste(habilidadeLabel);
      if (!params) return;
      this.actor.rolarTeste({ habilidade, atributo, ...params });
    });

    html.find(".track-checkbox").on("click", async event => {
      event.preventDefault();
      const el = event.currentTarget;
      const field = el.dataset.field;
      const index = parseInt(el.dataset.index);
      const currentValue = foundry.utils.getProperty(this.actor, field);
      const newValue = currentValue === index + 1 ? index : index + 1;

      const updates = { [field]: newValue };

      // Regra vinculada: EXApoints + Síndrome sempre somam 3
      if (field === "system.exapoints.value") {
        updates["system.sindrome.value"] = Math.min(3, Math.max(0, 3 - newValue));
      } else if (field === "system.sindrome.value") {
        updates["system.exapoints.value"] = Math.min(3, Math.max(0, 3 - newValue));
      }

      await this.actor.update(updates);

      if (field === "system.sindrome.value" && newValue >= this.actor.system.sindrome.max) {
        ChatMessage.create({
          content: "<p>Você desenvolveu a Síndrome, sua aventura chegou ao fim.</p>",
          speaker: ChatMessage.getSpeaker({ actor: this.actor })
        });
      }
    });
  }

  async _abrirDialogoTeste(habilidadeLabel) {
    const modOptions = [-3, -2, -1, 0, 1, 2, 3]
      .map(v => `<option value="${v}"${v === 0 ? " selected" : ""}>${v > 0 ? "+" + v : v}</option>`)
      .join("");

    const maxEXA = this.actor.system.exapoints?.value ?? 0;
    const exaOptions = Array.from({ length: maxEXA + 1 }, (_, i) =>
      `<option value="${i}"${i === 0 ? " selected" : ""}>${i}</option>`
    ).join("");

    return new Promise(resolve => {
      new Dialog({
        title: `Teste: ${habilidadeLabel}`,
        content: `
          <form class="exaa-dialog-form">
            <div class="form-group">
              <label>Modificador</label>
              <select name="modificador">${modOptions}</select>
            </div>
            <div class="form-group">
              <label>EXApoints (disponíveis: ${maxEXA})</label>
              <select name="exapoints">${exaOptions}</select>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d6"></i>',
            label: "Rolar",
            callback: html => resolve({
              modificador: Number(html.find("[name='modificador']").val()),
              exapoints: Number(html.find("[name='exapoints']").val())
            })
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancelar",
            callback: () => resolve(null)
          }
        },
        default: "roll",
        close: () => resolve(null)
      }).render(true);
    });
  }
}
