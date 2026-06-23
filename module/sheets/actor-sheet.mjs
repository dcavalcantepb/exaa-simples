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
    const equips = this.actor.system.equipamentos ?? [];
    context.equipamentosLista = Array.from({ length: 5 }, (_, i) => ({
      nome:   equips[i]?.nome  ?? "",
      tipo:   equips[i]?.tipo  ?? "",
      porte:  equips[i]?.porte ?? 1,
      index:  i,
      numero: i + 1
    }));
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
