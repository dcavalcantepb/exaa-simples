export class EXAAItemSheet extends ItemSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["exaa", "sheet", "item"],
      width: 540,
      height: 520
    });
  }

  get template() {
    return "systems/exaa-simples/templates/item-sheet.hbs";
  }

  async getData(options) {
    const context = await super.getData(options);
    context.system = this.item.system;
    context.isEquipamento = this.item.type === "equipamento";
    context.isModulo = this.item.type === "modulo";
    context.nucleos = CONFIG.EXAA.nucleos;
    return context;
  }
}
