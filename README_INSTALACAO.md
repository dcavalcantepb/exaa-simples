# EXAA Simples para Foundry VTT

Este e um sistema inicial para jogar EX:AA - Alvorada de Aco no Foundry VTT.

Ele foi montado a partir dos PDFs de Piloto e Operador e inclui:

- Atores do tipo `piloto` e `ameaca`.
- Itens do tipo `equipamento` e `modulo`.
- Atributos: Fisico, Agilidade, Intelecto e Vontade.
- Habilidades: Atletismo, Combate, Sobrevivencia, Pontaria, Furtividade, Pilotagem, Percepcao, Tecnica, Medicina, Comando, Influencia e Disciplina.
- EXApoints, Marcas da Sindrome, Ponto de Protagonismo, Carga, Defeito e Background.
- EXACOM com Nucleo, Condicao e quatro modulos narrativos.
- Rolagem de Teste de Habilidade com d6.

## Como instalar manualmente

1. Feche o Foundry VTT.
2. Encontre a pasta de dados do Foundry.
   - No Foundry, ela costuma aparecer em `Configure Settings > Application Configuration > User Data Path`.
   - Em Windows, muitas instalacoes usam algo parecido com `%localappdata%/FoundryVTT/Data`.
3. Dentro da pasta `Data`, abra ou crie a pasta `systems`.
4. Copie a pasta inteira `exaa-simples` para dentro de `Data/systems`.
5. Abra o Foundry VTT.
6. Crie um mundo novo usando o sistema `EXAA Simples`.
7. Dentro do mundo, crie um Actor do tipo `piloto`.

O nome da pasta precisa ser exatamente `exaa-simples`, porque o Foundry compara o nome da pasta com o campo `id` dentro de `system.json`.

## Como funciona a rolagem

Na ficha de Piloto:

1. Escolha o Atributo no campo `Teste de Habilidade`.
2. Preencha modificador do Operador, se houver.
3. Preencha quantos EXApoints serao usados como dados extras, se houver.
4. Clique em `Rolar` ao lado da Habilidade desejada.

A rolagem usa:

`Atributo + Habilidade + Modificador - Marcas da Sindrome + EXApoints`

O sistema limita o teste a 10d6. Se o total base de dados ficar em zero ou menos, e nenhum EXApoint for usado, ele rola 2d6 mantendo o menor resultado.

## O que ainda fica manual nesta primeira versao

- Gastar EXApoints automaticamente.
- Marcar Sindrome automaticamente quando um dado de EXApoint cair 1.
- Sobrecarga do EXACOM.
- Calculo automatico de bonus por Nucleo do EXACOM.
- Medidores de Progresso da Missao.

Essas automacoes sao possiveis, mas e melhor validar primeiro se a ficha esta correta para o seu jogo.
