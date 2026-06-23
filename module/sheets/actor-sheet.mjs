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
  }
}
