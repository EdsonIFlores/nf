# Arquitetura desktop recomendada

## Decisao

Usar Electron primeiro.

## Motivo

O Arquivo Claro ja usa Node.js para:

- IMAP;
- leitura e gravacao de arquivos;
- criacao de pastas;
- ZIP;
- servidor HTTP local.

Electron reaproveita esse codigo com menos reescrita. Tauri e uma boa opcao futura, mas exigiria mais ponte com Rust ou sidecars.

## Estrutura alvo

```text
electron-main.js
  cria a janela desktop
  inicia o servidor local interno
  controla ciclo de vida do app

server.js
  IMAP
  arquivos
  ZIP Vobi
  banco local

preload.js
  ponte segura entre tela e desktop

index.html / app.js / styles.css
  interface
```

## Regras

- O usuario nao deve ver terminal.
- O app deve iniciar em uma janela unica.
- Pastas e banco devem ficar em uma pasta de dados do usuario, nao dentro do codigo instalado.
- Senhas nao devem ficar em LocalStorage nem em arquivo aberto.

## Proximo passo tecnico

Antes de empacotar, criar SQLite e mover o catalogo para banco local. Isso evita empacotar uma base fragil.
