import { EXAAActor, EXAAItem } from "./module/documents.mjs";
import {
  PilotoDataModel,
  AmeacaDataModel,
  EquipamentoDataModel,
  ModuloDataModel
} from "./module/data-models.mjs";
import { EXAAActorSheet } from "./module/sheets/actor-sheet.mjs";
import { EXAAItemSheet } from "./module/sheets/item-sheet.mjs";

Hooks.once("init", () => {
  CONFIG.EXAA = {
    atributos: {
      fisico: "Físico",
      agilidade: "Agilidade",
      intelecto: "Intelecto",
      vontade: "Vontade"
    },
    habilidades: {
      atletismo: "Atletismo",
      combate: "Combate",
      sobrevivencia: "Sobrevivência",
      pontaria: "Pontaria",
      furtividade: "Furtividade",
      pilotagem: "Pilotagem",
      percepcao: "Percepção",
      tecnica: "Técnica",
      medicina: "Medicina",
      comando: "Comando",
      influencia: "Influência",
      disciplina: "Disciplina"
    },
    nucleos: {
      nenhum: "Nenhum",
      assalto: "Assalto",
      reconhecimento: "Reconhecimento",
      engenharia: "Engenharia",
      lideranca: "Liderança"
    },
    nucleoAtributo: {
      assalto: "fisico",
      reconhecimento: "agilidade",
      engenharia: "intelecto",
      lideranca: "vontade"
    },
    nucleoOposto: {
      assalto: "engenharia",
      engenharia: "assalto",
      reconhecimento: "lideranca",
      lideranca: "reconhecimento"
    },
    habilidadeAtributo: {
      atletismo: "fisico", combate: "fisico", sobrevivencia: "fisico",
      pontaria: "agilidade", furtividade: "agilidade", pilotagem: "agilidade",
      percepcao: "intelecto", tecnica: "intelecto", medicina: "intelecto",
      comando: "vontade", influencia: "vontade", disciplina: "vontade"
    },
    grupos: [
      { key: "fisico",    label: "Físico",    habilidades: ["atletismo", "combate", "sobrevivencia"] },
      { key: "agilidade", label: "Agilidade", habilidades: ["pontaria", "furtividade", "pilotagem"] },
      { key: "intelecto", label: "Intelecto", habilidades: ["percepcao", "tecnica", "medicina"] },
      { key: "vontade",   label: "Vontade",   habilidades: ["comando", "influencia", "disciplina"] }
    ]
  };

  CONFIG.Actor.documentClass = EXAAActor;
  CONFIG.Item.documentClass = EXAAItem;

  CONFIG.Actor.dataModels = {
    piloto: PilotoDataModel,
    ameaca: AmeacaDataModel
  };

  CONFIG.Item.dataModels = {
    equipamento: EquipamentoDataModel,
    modulo: ModuloDataModel
  };

  CONFIG.Actor.trackableAttributes = {
    piloto: {
      bar: ["dano.piloto", "dano.exacom", "exapoints", "sindrome"],
      value: ["protagonismo"]
    },
    ameaca: {
      bar: ["resistencia"],
      value: ["perigo"]
    }
  };

  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("exaa-simples", EXAAActorSheet, {
    makeDefault: true,
    types: ["piloto", "ameaca"]
  });

  Items.unregisterSheet("core", ItemSheet);
  Items.registerSheet("exaa-simples", EXAAItemSheet, {
    makeDefault: true,
    types: ["equipamento", "modulo"]
  });
});

Hooks.on("renderChatMessage", (message, html) => {
  html.find(".exaa-sobrecarga-btn:not([disabled])").on("click", async event => {
    event.preventDefault();
    const btn = event.currentTarget;
    btn.disabled = true;

    const actorId = btn.dataset.actorId;
    const actor = game.actors.get(actorId);
    if (!actor?.isOwner) return;

    const resultadosBase = JSON.parse(btn.dataset.resultadosBase || "[]");
    const resultadosExa  = JSON.parse(btn.dataset.resultadosExa  || "[]");
    const todosDados = [...resultadosBase, ...resultadosExa];
    const minVal = Math.min(...todosDados);

    const novosBase = [...resultadosBase];
    const novosExa  = [...resultadosExa];
    const baseIdx = novosBase.indexOf(minVal);
    if (baseIdx !== -1) novosBase[baseIdx] = 6;
    else { const ei = novosExa.indexOf(minVal); if (ei !== -1) novosExa[ei] = 6; }

    const todosNovos = [...novosBase, ...novosExa];
    const novoFinal = Math.max(...todosNovos);
    const v = novoFinal;
    const resultadoTexto = v <= 1 ? "Falha Crítica" : v <= 3 ? "Falha" : v <= 5 ? "Sucesso com Custo" : "Sucesso Crítico";

    const novoEXA = Math.max(0, actor.system.exapoints.value - 1);
    await actor.update({
      "system.exapoints.value": novoEXA,
      "system.sindrome.value": Math.min(3, 3 - novoEXA)
    });

    const messageId = btn.closest("[data-message-id]")?.dataset.messageId;
    if (messageId) {
      const msg = game.messages.get(messageId);
      if (msg) {
        const novoConteudo = msg.content.replace(
          /<div class="exaa-sobrecarga-wrapper">[\s\S]*?<\/div>/,
          '<div class="exaa-sobrecarga-wrapper"><button class="exaa-sobrecarga-btn exaa-sobrecarga-usada" disabled>✓ Sobrecarga ativada</button></div>'
        );
        await msg.update({ content: novoConteudo });
      }
    }

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="exaa-roll-msg">
        <p>⚡ <strong>Sobrecarga EXACOM!</strong> Dado ${minVal} convertido em 6.</p>
        <p class="exaa-resultado">Novo resultado: <strong>${resultadoTexto}</strong></p>
        <p class="exaa-consequence">1 EXApoint consumido e 1 Marca adicionada.</p>
      </div>`
    });
  });
});
