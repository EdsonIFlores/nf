# Arquivo Claro

Aplicativo local para organizar arquivos PDF e XML em um catálogo pesquisável.

## Como abrir

Para usar somente a organização manual, abra `index.html` no navegador.

Para importar notas fiscais direto do e-mail e criar pastas reais no computador:

1. Abra `iniciar-arquivo-claro.bat`.
2. Use o endereço `http://localhost:8787`.
3. No painel "Importar do e-mail", informe provedor, e-mail e senha.
4. Clique em "Buscar notas fiscais".

As notas baixadas ficam em `NotasFiscais/Nome do fornecedor/AAAA-MM`.

## O que ele faz

- Importa PDFs e XMLs individualmente ou por pasta.
- Lê dados básicos de XML/NFe quando disponíveis, como empresa, CNPJ, período e chave.
- Permite editar cliente, período, categoria, status, tags e observações.
- Sugere um caminho de organização por cliente, período, categoria, tipo e status.
- Salva o catálogo no próprio navegador.
- Exporta CSV, backup JSON e plano de pastas.
- Conecta por IMAP para buscar anexos PDF/XML de notas fiscais no e-mail.
- Cria pastas por fornecedor, mes e tipo de documento, salvando os anexos no computador ou servidor.
- Separa notas fiscais, boletos e outros documentos.
- Ignora anexos duplicados pelo conteudo do arquivo.
- Gera um pacote ZIP para envio ao Vobi, com manifesto JSON e arquivos organizados.

## Organizacao das pastas

Os anexos importados por e-mail sao gravados em:

`NotasFiscais/Fornecedor/AAAA-MM/Notas Fiscais`

ou:

`NotasFiscais/Fornecedor/AAAA-MM/Boletos`

O nome do arquivo recebe a data do e-mail no inicio para facilitar a conferencia.

## Pacote Vobi

Use o botao "Baixar pacote Vobi" para gerar um ZIP com os arquivos filtrados na tela. O ZIP mantem as pastas por fornecedor e periodo, e inclui `manifesto-vobi.json` com cliente, CNPJ, chave da nota e caminho de cada arquivo.

## Conferencia do e-mail

Antes de buscar anexos, use "Testar acesso". O app confirma se conseguiu entrar no e-mail, mostra a caixa usada, quantas mensagens existem e quantas estao nao lidas.

Depois do teste, o app lista as pastas disponiveis no e-mail. Use "Pasta do e-mail" para buscar em INBOX, arquivados ou pastas especificas do provedor.

Ao clicar em "Buscar PDFs e XMLs", a tela mostra:

- modo da busca;
- mensagens encontradas;
- mensagens verificadas;
- anexos analisados;
- PDFs/XMLs encontrados;
- arquivos importados;
- duplicados ignorados;
- anexos de outros tipos ignorados.

## Baixar pastas

A area "Pastas criadas" mostra as pastas montadas pelo sistema. Use "Baixar pasta" para salvar no computador um ZIP daquela pasta especifica, ou "Baixar pacote Vobi" para baixar todos os arquivos filtrados.

## E-mails aceitos

O aplicativo usa IMAP, que é o modo mais comum para aceitar Gmail, Outlook/Hotmail, Yahoo, UOL, BOL, Terra, Locaweb, KingHost e e-mails de domínio próprio. Se o provedor não estiver na lista, escolha "Manual" e informe o servidor IMAP.

Em alguns provedores, a senha normal não funciona em aplicativos externos. Nesse caso, ative IMAP e crie uma "senha de app" nas configurações de segurança do seu e-mail.
