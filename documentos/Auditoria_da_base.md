# Divide aí — auditoria da base e fundação visual

8 de outubro de 2026. Escopo autorizado: etapas 0 e 1, Android primeiro, dados demo. Sem backend, e-mail, serviços faturáveis ou publicação.

## Diagnóstico e reaproveitamento

O rascunho tinha `mobile/src/` vazio, sem rotas, `node_modules` ou lockfile. A configuração importava Tamagui sem declarar seus pacotes. Biome também não estava instalado; o script de testes dependia de `tsx` e de uma pasta inexistente, e `check` usava pnpm não disponível. O README ainda orientava ESLint e reset de template.

Mantidos Expo SDK 57, React 19.2.3 e React Native 0.86.3. Esses majors correspondem à [tabela oficial do SDK 57](https://docs.expo.dev/versions/v57.0.0/); a recomendação exata foi conferida por `expo install --check`. Node local 22.16.0 atende ao mínimo 22.13 do SDK. Não houve recriação do projeto, descarte de arquivos locais, reset, commit ou alteração do índice Git.

O repositório Git encontrado está em `C:/Users/T.i/Desktop/trampo`, acima deste projeto; o projeto aparece como não rastreado. Mudanças externas ao projeto foram preservadas. Não há diff histórico próprio que comprove a origem de cada arquivo do rascunho.

## Entrega implementada

- `mobile/package.json` e `package-lock.json`: npm 10.9.2, scripts de Biome/TypeScript, Doctor e export local; Tamagui e config fixados em 2.7.7, Biome 2.5.15. Retirado o script de teste inexistente. Nenhuma suíte de interação foi criada nesta etapa.
- `mobile/tamagui.config.ts` e `src/ui/foundation.ts`: tokens semânticos claro/escuro, tipografia do sistema, espaços, raios, ícones, sombras e toque mínimo de 48 dp. Preset v5, conforme [configuração oficial Tamagui](https://tamagui.dev/docs/core/config-v5); sem compilador ou driver adicional de animação. Longhands habilitados para legibilidade; tema escolhido pelo sistema ou pelo controle do catálogo.
- `src/ui/provider.tsx`, `components.tsx` e `product.tsx`: texto, botão, campo, checkbox, card, badge, aviso, cabeçalho, feedback vazio/erro/carregamento, modal, trajeto, horário, caminhada, companhia e confirmação de troca demo.
- `src/app/`: provider raiz, rota inicial para `/catalogo`, catálogo e retorno para página desconhecida. Código não relacionado a rotas permanece fora dessa pasta, conforme [Expo Router](https://docs.expo.dev/router/installation/).
- `src/features/catalog/CatalogScreen.tsx`: cinco categorias, alternância de tema, prévia de fonte 150%, campo editável com validação, contador, estados ocupado/desabilitado/falha, checkbox alternável e modais com estado local preservado ao fechar.
- `mobile/app.json`: nome, slug, scheme, versão demo e fundo do splash alinhados. Assets Expo originais preservados; identidade final ainda não aprovada.
- `mobile/README.md`: execução, organização e checklist de validação visual/Android.

O modal usa o [Modal do React Native](https://reactnative.dev/docs/modal), com conteúdo Tamagui, rolagem, ação explícita de fechar e `onRequestClose` para retorno Android; não usa animação. Isso evita dependência nativa extra de portal nesta fundação. A revisão do assessor também conferiu a retenção de foco fornecida pelo Modal do React Native Web; ainda falta testar esse comportamento em UI real.

Os dados são fictícios. A troca só altera estado local; não envia solicitação nem confirma viagem. Caminhadas usam 400 m por extremo; duplas são duas contas e podem somar até três pessoas contando acompanhantes. Fotos/endereços privados não entram no card. As divergências históricas de caminhada, terceiro no MVP e OTP/remetente foram sincronizadas em requisitos, decisões, plano, contratos e roteiro. Não foram resolvidas pendências novas de produto.

## Evidências de validação

Registro final dos comandos e resultados mantido também em [Passagem_de_trabalho.md](Passagem_de_trabalho.md). Não confundir instalação, checagem de tipos, export, renderização estática e execução no aparelho.

- Instalação npm inicial concluída; Tamagui/config instalados pelo Expo. Um comando `expo install ... --dev` instalou Biome/Doctor, mas terminou com erro de diretório `mobile/install`; os pacotes foram conferidos por `npm ls`, e o lockfile foi sincronizado depois. `npm ci --no-audit --no-fund` reinstalou 745 pacotes com exit 0, comprovando a instalação pelo lockfile. Não tratar a saída isolada do primeiro comando como sucesso do CLI.
- `expo install --check`: dependências atualizadas.
- `npm run doctor`: 21/21 verificações aprovadas.
- `npm run check`: Biome (15 arquivos) e TypeScript aprovados após os ajustes finais de campo e contraste.
- Cálculo numérico sobre a paleta final: menor contraste dos pares de texto usados pela UI de 5,31:1 no tema claro e 6,41:1 no escuro; bordas de controles de pelo menos 3,11:1 e 4,35:1, respectivamente. Foram criados tokens `controlBorder` próprios; bordas decorativas de cards continuam suaves. Isso não comprova contraste de todos os pixels/estados renderizados.
- Export Android aprovado: bundle Hermes, 2.275 módulos; isso não é APK nem execução no aparelho.
- Export web aprovado com dois workers: bundle web, bundle de renderização e quatro rotas estáticas, incluindo `/catalogo`. A primeira tentativa com concorrência padrão foi interrompida por lentidão. O CLI emitiu aviso de encerramento forçado após exportar; não houve erro de bundle/renderização na tentativa concluída.
- `adb devices`: nenhum dispositivo. Ferramenta de navegador: inventário vazio, navegador interno indisponível. Nenhuma screenshot, inspeção visual, execução Android, TalkBack ou interação em navegador foi comprovada.

## Audit de dependências

`npm audit` em 08/10/2026 relatou **29 ocorrências: 11 moderadas e 18 altas**. Muitas são propagação de quatro dependências, não 29 falhas independentes. O audit não está aprovado. Alcance de exploração no app não foi comprovado.

| Dependência raiz | Cadeia confirmada localmente | Alcance a revisar |
|---|---|---|
| braces 3.0.3 | Metro → metro-file-map → micromatch → braces | Ferramentas de bundling; padrões profundamente aninhados. [Advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) |
| node-forge | Expo CLI → code-signing-certificates → node-forge | Assinaturas RSA em ferramentas Expo. [Advisory](https://github.com/advisories/GHSA-86w9-cpqp-85rv) |
| decode-uri-component | Expo Router → query-string → decode-uri-component | Potencialmente embarcado; Router importa query-string em conversão de URLs/estado. Prioridade para revisão de deep links e entradas de URL. [Advisory](https://github.com/advisories/GHSA-vcc3-ghjq-m6fr) |
| uuid 7 | Expo config-plugins → xcode → uuid | Ferramenta nativa; advisory depende de certas versões/algoritmos com buffer externo. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq) |

`npm explain` foi executado; a saída extensa foi complementada com leitura dos manifests e imports imediatos. Não foram aplicados `audit fix --force`, downgrades Expo 44/RN 0.72 ou overrides incompatíveis sugeridos pelo audit. Manter esse risco documentado para a demo local; antes de distribuição ou integração real, avaliar atualização compatível, repetir audit e validar as entradas afetadas. Consulta Astra confirmou essa direção, sem substituir validações.

## Pendências para concluir a fundação

Etapa 0 tem base instalável e compilável; etapa 1 tem catálogo implementado. A aceitação visual/funcional integral da etapa 1 permanece pendente: Android com fonte ampliada do sistema, teclado, TalkBack, toque, temas, fechamento pelo retorno e preservação do estado. O checklist completo está no README mobile. A prévia 150% auxilia inspeção, mas não substitui teste de fonte do sistema. Também falta verificar foco/teclado/interações web no navegador. Não iniciar backend, serviços ou publicação para resolver essas pendências.

Modelos efetivos confirmados nos metadados: principal GPT-6.1 Sol/medium; pesquisas GPT-6 Luna/high, somente leitura, até duas; assessor GPT-6 Astra/low para decisões, audit e revisão de lacunas. Somente o principal editou e integrou.
