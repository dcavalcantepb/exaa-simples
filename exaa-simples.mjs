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
      fisico: "Fisico",
      agilidade: "Agilidade",
      intelecto: "Intelecto",
      vontade: "Vontade"
    },
    habilidades: {
      atletismo: "Atletismo",
      combate: "Combate",
      sobrevivencia: "Sobrevivencia",
      pontaria: "Pontaria",
      furtividade: "Furtividade",
      pilotagem: "Pilotagem",
      percepcao: "Percepcao",
      tecnica: "Tecnica",
      medicina: "Medicina",
      comando: "Comando",
      influencia: "Influencia",
      disciplina: "Disciplina"
    },
    nucleos: {
      assalto: "Assalto",
      reconhecimento: "Reconhecimento",
      engenharia: "Engenharia",
      comando: "Comando"
    }
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
