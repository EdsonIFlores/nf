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
- Cria pastas por fornecedor e por data, salvando os anexos no computador.

## E-mails aceitos

O aplicativo usa IMAP, que é o modo mais comum para aceitar Gmail, Outlook/Hotmail, Yahoo, UOL, BOL, Terra, Locaweb, KingHost e e-mails de domínio próprio. Se o provedor não estiver na lista, escolha "Manual" e informe o servidor IMAP.

Em alguns provedores, a senha normal não funciona em aplicativos externos. Nesse caso, ative IMAP e crie uma "senha de app" nas configurações de segurança do seu e-mail.
