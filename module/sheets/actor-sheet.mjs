const DEFEITOS = [
  { value: "",           label: "Nenhum",     desc: "" },
  { value: "assombrado", label: "Assombrado", desc: "O passado te persegue." },
  { value: "arrogante",  label: "Arrogante",  desc: "Subestima os outros." },
  { value: "covarde",    label: "Covarde",    desc: "Hesita diante do perigo." },
  { value: "ganancioso", label: "Ganancioso", desc: "Quer riqueza ou poder." },
  { value: "imprudente", label: "Imprudente", desc: "Age antes de pensar." },
  { value: "ingenuo",    label: "Ingênuo",    desc: "Confia facilmente." },
  { value: "instavel",   label: "Instável",   desc: "Sem controle emocional." },
  { value: "procurado",  label: "Procurado",  desc: "Alguém caça você." },
  { value: "teimoso",    label: "Teimoso",    desc: "Não sabe recuar." },
  { value: "viciado",    label: "Viciado",    desc: "Depende de algo." }
];

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
    const sys = this.actor.system;
    context.system = sys;

    if (this.actor.type !== "piloto") return context;

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
    const nucleoAtual = this.actor.system.exacom?.nucleo ?? "nenhum";
    context.nucleoOptions = Object.entries(CONFIG.EXAA.nucleos).map(([k, v]) => ({
      value: k, label: v, selected: k === nucleoAtual
    }));

    // Módulos EXACOM
    const TIPO_ARMA = [
      { value: "",            label: "Selecione..." },
      { value: "arma-fogo",  label: "Arma de Fogo" },
      { value: "arma-branca", label: "Arma Branca" }
    ];
    const PORTE_MODULO = [
      { value: "",       label: "Selecione..." },
      { value: "leve",   label: "Leve" },
      { value: "medio",  label: "Médio" },
      { value: "pesado", label: "Pesado" }
    ];
    const CATEGORIA_SUPORTE = [
      { value: "",              label: "Selecione..." },
      { value: "sensor",        label: "Sensor" },
      { value: "mobilidade",    label: "Mobilidade" },
      { value: "reparo",        label: "Reparo" },
      { value: "interferencia", label: "Interferência" }
    ];
    const opt = (arr, val) => arr.map(o => ({ ...o, selected: o.value === (val ?? "") }));
    const mod = sys.exacom?.modulos       ?? {};
    const ap  = mod.armaPrimaria          ?? {};
    const as_ = mod.armaSecundaria        ?? {};
    const sup = mod.suporte               ?? {};
    const bl  = mod.blindagem             ?? {};
    context.armaPrimariaTipoOptions    = opt(TIPO_ARMA,         ap.tipo       ?? "");
    context.armaPrimariaPorteOptions   = opt(PORTE_MODULO,      ap.porte      ?? "");
    context.armaSecundariaTipoOptions  = opt(TIPO_ARMA,         as_.tipo      ?? "");
    context.armaSecundariaPorteOptions = opt(PORTE_MODULO,      as_.porte     ?? "");
    context.suporteCategoriaOptions    = opt(CATEGORIA_SUPORTE, sup.categoria ?? "");
    context.blindagemPorteOptions      = opt(PORTE_MODULO,      bl.porte      ?? "");

    // Defeitos
    const defAtual  = sys.defeito  ?? "";
    const def2Atual = sys.defeito2 ?? "";
    context.defeito2Ativo  = sys.defeito2Ativo ?? false;
    context.defeitoOptions  = DEFEITOS.map(d => ({ ...d, selected: d.value === defAtual }));
    context.defeitoDesc     = DEFEITOS.find(d => d.value === defAtual)?.desc ?? "";
    context.defeito2Options = DEFEITOS.map(d => ({ ...d, selected: d.value === def2Atual }));
    context.defeito2Desc    = DEFEITOS.find(d => d.value === def2Atual)?.desc ?? "";

    // Validação de distribuição de pontos
    const atribVals = Object.values(sys.atributos).map(a => a.value).sort((a, b) => b - a);
    const atribOk = JSON.stringify(atribVals) === JSON.stringify([3, 2, 2, 1]);
    const habVals = Object.values(sys.habilidades).map(h => h.value);
    const c3 = habVals.filter(v => v === 3).length;
    const c2 = habVals.filter(v => v === 2).length;
    const c1 = habVals.filter(v => v === 1).length;
    const c0 = habVals.filter(v => v === 0).length;
    const esperaC1 = context.defeito2Ativo ? 4 : 3;
    const esperaC0 = context.defeito2Ativo ? 4 : 5;
    const habOk = c3 === 1 && c2 === 3 && c1 === esperaC1 && c0 === esperaC0;
    context.distribuicaoValida = atribOk && habOk;

    return context;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    html.find("[data-roll-exa]").on("click", async () => {
      const maxEXA = this.actor.system.exapoints?.value ?? 0;
      if (maxEXA === 0) {
        ui.notifications.warn("Nenhum EXApoint disponível.");
        return;
      }
      const params = await this._abrirDialogoEXA(maxEXA);
      if (!params) return;
      this.actor.rolarEXA(params.quantidade);
    });

    html.find("[data-roll-skill]").on("click", async event => {
      const habilidade = event.currentTarget.dataset.rollSkill;
      const habilidadeLabel = CONFIG.EXAA.habilidades[habilidade] ?? habilidade;
      const atributo = CONFIG.EXAA.habilidadeAtributo[habilidade];
      const params = await this._abrirDialogoTeste(habilidadeLabel);
      if (!params) return;
      this.actor.rolarTeste({ habilidade, atributo, modificador: params.modificador, exapoints: params.exapoints });
    });

    html.find(".stepper-btn").on("click", async event => {
      const btn = event.currentTarget;
      const field = btn.dataset.field;
      const action = btn.dataset.action;
      const max = parseInt(btn.dataset.max ?? "10");
      const current = Number(foundry.utils.getProperty(this.actor, field) ?? 0);
      const newVal = action === "plus" ? Math.min(max, current + 1) : Math.max(0, current - 1);
      await this.actor.update({ [field]: newVal });
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

    const exacomAtivo = this.actor.system.exacom?.ativo ?? false;
    const nucleo = this.actor.system.exacom?.nucleo ?? "nenhum";
    const nucleoLabel = CONFIG.EXAA.nucleos[nucleo] ?? "Nenhum";
    const exacomInfo = exacomAtivo && nucleo !== "nenhum"
      ? `<p class="exaa-dialog-section-title exaa-exacom-ativo">⚡ EXACOM Ativo — Núcleo: ${nucleoLabel}</p>`
      : `<p class="exaa-dialog-section-title">EXACOM inativo</p>`;

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
            <hr class="exaa-dialog-divider" />
            ${exacomInfo}
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

  async _abrirDialogoEXA(maxEXA) {
    const options = Array.from({ length: maxEXA }, (_, i) => i + 1)
      .map(n => `<option value="${n}"${n === maxEXA ? " selected" : ""}>${n}</option>`)
      .join("");

    return new Promise(resolve => {
      new Dialog({
        title: "Rolar EXApoints",
        content: `
          <form class="exaa-dialog-form">
            <div class="form-group">
              <label>Quantidade (máx. ${maxEXA} disponível${maxEXA > 1 ? "is" : ""})</label>
              <select name="quantidade">${options}</select>
            </div>
          </form>
        `,
        buttons: {
          roll: {
            icon: '<i class="fas fa-dice-d6"></i>',
            label: "Rolar",
            callback: html => resolve({ quantidade: Number(html.find("[name='quantidade']").val()) })
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
