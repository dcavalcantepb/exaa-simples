# Instalacao por Manifest usando GitHub Releases

Para instalar pelo Manifest, o Foundry precisa de duas URLs publicas:

- `manifest`: URL publica do arquivo `system.json`.
- `download`: URL publica do arquivo `.zip` da versao atual.

## Fluxo recomendado

1. Crie um repositorio no GitHub, por exemplo `exaa-simples`.
2. Envie todo o conteudo desta pasta para o repositorio.
3. No arquivo `system.json`, adicione estes campos no final:

```json
"url": "https://github.com/SEU_USUARIO/exaa-simples",
"manifest": "https://raw.githubusercontent.com/SEU_USUARIO/exaa-simples/main/system.json",
"download": "https://github.com/SEU_USUARIO/exaa-simples/releases/download/v0.1.0/exaa-simples-v0.1.0.zip"
```

4. Crie uma Release no GitHub chamada `v0.1.0`.
5. Anexe o arquivo `exaa-simples-v0.1.0.zip` na Release.
6. No Foundry, va em `Game Systems > Install System`.
7. Cole a URL do manifest:

```text
https://raw.githubusercontent.com/SEU_USUARIO/exaa-simples/main/system.json
```

8. Clique em instalar.

## Importante

O zip usado no campo `download` deve conter `system.json` diretamente na raiz do arquivo, nao dentro de uma pasta extra.

Exemplo correto dentro do zip:

```text
system.json
exaa-simples.mjs
module/
templates/
styles/
lang/
```

Exemplo ruim para Manifest:

```text
exaa-simples/system.json
exaa-simples/exaa-simples.mjs
```

O segundo formato funciona melhor para instalacao manual, mas pode falhar no instalador automatico.
