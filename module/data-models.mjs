const {
  ArrayField,
  BooleanField,
  HTMLField,
  NumberField,
  SchemaField,
  StringField
} = foundry.data.fields;

const bounded = (initial, max) => new SchemaField({
  value: new NumberField({ required: true, integer: true, min: 0, max, initial }),
  max: new NumberField({ required: true, integer: true, min: 0, initial: max })
});

const score = initial => new SchemaField({
  value: new NumberField({ required: true, integer: true, min: 0, max: 10, initial })
});

export class PilotoDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      atributos: new SchemaField({
        fisico: score(1),
        agilidade: score(1),
        intelecto: score(1),
        vontade: score(1)
      }),
      habilidades: new SchemaField({
        atletismo: score(0),
        combate: score(0),
        sobrevivencia: score(0),
        pontaria: score(0),
        furtividade: score(0),
        pilotagem: score(0),
        percepcao: score(0),
        tecnica: score(0),
        medicina: score(0),
        comando: score(0),
        influencia: score(0),
        disciplina: score(0)
      }),
      exapoints: bounded(3, 3),
      sindrome: bounded(0, 3),
      protagonismo: new NumberField({ required: true, integer: true, min: 0, max: 1, initial: 0 }),
      dano: new SchemaField({
        piloto: bounded(0, 3),
        exacom: bounded(0, 3)
      }),
      carga: new StringField({ required: true, initial: "medio" }),
      equipamentos: new ArrayField(
        new SchemaField({
          nome: new StringField({ required: true, blank: true, initial: "" }),
          tipo: new StringField({ required: true, blank: true, initial: "" }),
          porte: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 0 })
        }),
        { required: true, initial: Array(5).fill(null).map(() => ({ nome: "", tipo: "", porte: 0 })) }
      ),
      defeito: new StringField({ required: true, blank: true, initial: "" }),
      origem: new StringField({ required: true, blank: true, initial: "" }),
      objetivo: new StringField({ required: true, blank: true, initial: "" }),
      reves: new StringField({ required: true, blank: true, initial: "" }),
      exacom: new SchemaField({
        nome: new StringField({ required: true, blank: true, initial: "" }),
        nucleo: new StringField({ required: true, blank: true, initial: "nenhum" }),
        armaPrimaria: new StringField({ required: true, blank: true, initial: "" }),
        armaSecundaria: new StringField({ required: true, blank: true, initial: "" }),
        suporte: new StringField({ required: true, blank: true, initial: "" }),
        blindagem: new StringField({ required: true, blank: true, initial: "" })
      }),
      notas: new HTMLField({ required: true, blank: true })
    };
  }
}

export class AmeacaDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      objetivo: new StringField({ required: true, blank: true, initial: "" }),
      perigo: new NumberField({ required: true, integer: true, min: 0, max: 3, initial: 1 }),
      resistencia: bounded(0, 6),
      habilidadeEspecial: new HTMLField({ required: true, blank: true }),
      notas: new HTMLField({ required: true, blank: true })
    };
  }
}

class EXAAItemDataModel extends foundry.abstract.TypeDataModel {
  static defineSchema() {
    return {
      descricao: new HTMLField({ required: true, blank: true })
    };
  }
}

export class EquipamentoDataModel extends EXAAItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      tipo: new StringField({ required: true, blank: true, initial: "ferramenta" }),
      porte: new StringField({ required: true, blank: true, initial: "leve" }),
      custo: new NumberField({ required: true, integer: true, min: 1, max: 3, initial: 1 }),
      equipado: new BooleanField({ required: true, initial: false })
    };
  }
}

export class ModuloDataModel extends EXAAItemDataModel {
  static defineSchema() {
    return {
      ...super.defineSchema(),
      categoria: new StringField({ required: true, blank: true, initial: "suporte" }),
      nucleoRelacionado: new StringField({ required: true, blank: true, initial: "assalto" })
    };
  }
}
