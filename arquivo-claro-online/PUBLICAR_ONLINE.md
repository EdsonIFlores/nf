# Publicar online

Este app precisa rodar como servidor Node.js para conseguir ler e-mails por IMAP e salvar anexos PDF/XML.

## Opção rápida: Render

1. Crie uma conta em https://render.com.
2. Crie um novo projeto do tipo "Web Service".
3. Envie esta pasta para um repositório GitHub ou faça upload do projeto.
4. Use:
   - Build command: `npm install`
   - Start command: `npm start`
   - Node version: `20`
   - Environment variable: `PORT=10000`
5. Depois da publicação, abra o link gerado pelo Render.

O arquivo `render.yaml` já deixa essa configuração pronta quando o projeto está no GitHub.

## Opção com Docker

Em qualquer servidor que aceite Docker:

```bash
docker build -t arquivo-claro .
docker run -p 8787:8787 -v notas:/app/NotasFiscais arquivo-claro
```

Depois abra `http://SEU_SERVIDOR:8787`.

## Atenção sobre anexos

Em hospedagens gratuitas, os arquivos salvos no servidor podem ser apagados quando o serviço reinicia. Para uso real, escolha uma hospedagem com disco persistente ou conecte uma pasta/volume persistente.

## Atenção sobre e-mail

O aplicativo usa IMAP. Muitos provedores exigem:

- IMAP ativado nas configurações do e-mail.
- Senha de app em vez da senha normal.
- Liberação de acesso para aplicativos externos.

O app não grava a senha do e-mail no catálogo. Ela é usada somente na busca que você aciona na tela.
