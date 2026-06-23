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

    html.find("[data-roll-skill]").on("click", event => {
      const habilidade = event.currentTarget.dataset.rollSkill;
      const atributo = html.find("[name='roll-atributo']").val();
      const modificador = html.find("[name='roll-modificador']").val();
      const exapoints = html.find("[name='roll-exapoints']").val();
      this.actor.rolarTeste({ atributo, habilidade, modificador, exapoints });
    });

    html.find(".track-checkbox").on("click", async event => {
      event.preventDefault();
      const el = event.currentTarget;
      const field = el.dataset.field;
      const index = parseInt(el.dataset.index);
      const currentValue = foundry.utils.getProperty(this.actor, field);
      const newValue = currentValue === index + 1 ? index : index + 1;

      await this.actor.update({ [field]: newValue });

      if (field === "system.sindrome.value" && newValue >= this.actor.system.sindrome.max) {
        ChatMessage.create({
          content: "<p>Você desenvolveu a Síndrome, sua aventura chegou ao fim.</p>",
          speaker: ChatMessage.getSpeaker({ actor: this.actor })
        });
      }
    });
  }
}
