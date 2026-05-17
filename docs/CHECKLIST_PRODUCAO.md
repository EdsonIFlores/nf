# Checklist de producao

Use antes de publicar no Render ou gerar build desktop.

## Codigo

- Rodar `npm run check`.
- Confirmar que nao existem conflitos Git.
- Confirmar Gmail e Zoho funcionando em teste.
- Confirmar que `So nao lidos` busca somente e-mails nao lidos.
- Confirmar que `Marcar como lido` esta desmarcado por padrao.

## E-mail

- Gmail: usar senha de app.
- Zoho dominio proprio: usar `imappro.zoho.com`, porta `993`, SSL.
- Testar acesso antes de buscar anexos.
- Conferir pasta selecionada do e-mail.

## Arquivos

- Testar abrir PDF/XML.
- Testar baixar pasta.
- Testar baixar pacote Vobi.
- Conferir manifesto JSON no pacote Vobi.

## Seguranca

- Trocar qualquer senha de app exposta em conversa ou teste.
- Se publicar online, definir `APP_USER` e `APP_PASSWORD`.
- Nao armazenar senha de e-mail em texto aberto.

## Comercial

- Definir onde os arquivos ficarao armazenados.
- Definir politica de backup.
- Definir suporte para clientes com Gmail, Zoho e Outlook.
- Definir limitacao da versao inicial: busca em pasta escolhida, nao em todas simultaneamente.
