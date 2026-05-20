# Roadmap comercial do FiscalFlow

Este roteiro preserva o app atual funcionando e evolui em etapas menores, com menos risco.

## Fase 1 - Produto confiavel

- Manter importacao IMAP atual funcionando para Gmail e Zoho.
- Adicionar selecao de pastas do e-mail.
- Melhorar mensagens de erro para usuario final.
- Baixar pastas em ZIP e pacote Vobi.
- Criar checklist de publicacao antes de cada deploy.

## Fase 2 - Persistencia profissional

- Substituir LocalStorage por SQLite.
- Salvar catalogo, fornecedores, documentos, historico de importacao e configuracoes.
- Migrar dados existentes do navegador para o banco local.
- Criar backup/restauracao do banco.

## Fase 3 - Aplicativo desktop

- Empacotar em Electron.
- Remover dependencia de terminal e `.bat`.
- Iniciar servidor interno automaticamente.
- Abrir janela nativa com a interface.
- Configurar instalador Windows.

## Fase 4 - Seguranca

- Guardar senhas de e-mail no gerenciador de credenciais do Windows.
- Proteger o app com senha local.
- Criar logs tecnicos sem gravar senhas.
- Criar build ofuscado para distribuicao.

## Fase 5 - Inteligencia de documentos

- Ler texto de PDFs com `pdf-parse`.
- Usar OCR apenas quando o PDF for imagem.
- Extrair CNPJ, valor, numero da nota, data e chave de acesso.
- Melhorar classificacao entre nota fiscal, boleto e documento.

## Fase 6 - Licenciamento B2B

- Gerar ID da maquina.
- Validar chave de licenca em API externa.
- Cache local de licenca para permitir uso offline por periodo limitado.
- Painel simples para ativar/desativar clientes.

## Ordem recomendada

1. SQLite.
2. Electron.
3. Credenciais seguras.
4. OCR/PDF.
5. Licenciamento.

Essa ordem reduz retrabalho e evita comercializar antes da base local estar confiavel.
