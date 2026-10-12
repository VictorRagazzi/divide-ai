import { router } from "expo-router";
import { type ReactNode, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme, XStack, YStack } from "tamagui";
import {
  AppButton,
  AppModal,
  AppText,
  Badge,
  CheckField,
  Feedback,
  Field,
  Heading,
  Notice,
  PageHeader,
  Surface,
} from "../../ui/components";
import { metrics, palette } from "../../ui/foundation";
import {
  CompanionCard,
  RouteSummary,
  SwapConfirmation,
  TimeWindow,
} from "../../ui/product";
import { useUi } from "../../ui/provider";

const sections = [
  "Fundação",
  "Ações",
  "Campos",
  "Feedback",
  "Produto",
] as const;
type Section = (typeof sections)[number];

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <YStack gap="$md">
      <Heading>{title}</Heading>
      {children}
    </YStack>
  );
}

export default function CatalogScreen() {
  const theme = useTheme();
  const { dark, toggleTheme, textScale, toggleTextScale } = useUi();
  const [section, setSection] = useState<Section>("Fundação");
  const [presses, setPresses] = useState(0);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("");
  const [checked, setChecked] = useState(false);
  const [validated, setValidated] = useState(false);
  const [modal, setModal] = useState(false);
  const [swap, setSwap] = useState(false);
  const [pending, setPending] = useState("Evandro");
  const [swapMessage, setSwapMessage] = useState("");
  const [retried, setRetried] = useState(false);
  const nextName = pending === "Evandro" ? "Bruno" : "Evandro";

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.background.val }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: metrics.space.md }}
        >
          <YStack
            width="100%"
            maxWidth={680}
            alignSelf="center"
            gap="$xl"
            paddingVertical="$md"
          >
            <PageHeader
              title="Catálogo de componentes"
              subtitle="Fundação visual para encontrar companhia e combinar o caminho."
            />
            <Notice title="Ambiente de demonstração">
              Todos os perfis, trajetos e ações são fictícios. Não há busca
              real, envio de solicitações ou conexão com serviços.
            </Notice>
            <AppButton variant="secondary" onPress={() => router.push("/")}>
              Abrir fluxo de busca demo
            </AppButton>
            <YStack gap="$sm">
              <AppButton variant="secondary" onPress={toggleTheme}>
                {dark ? "Usar tema claro" : "Usar tema escuro"}
              </AppButton>
              <AppButton variant="secondary" onPress={toggleTextScale}>
                {textScale === 1
                  ? "Prévia de fonte 150%"
                  : "Restaurar fonte 100%"}
              </AppButton>
              <AppText color="$muted">
                A prévia amplia os textos do catálogo. No Android, validar
                também o tamanho da fonte do sistema e o TalkBack.
              </AppText>
            </YStack>
            <XStack gap="$xs" flexWrap="wrap">
              {sections.map((item) => (
                <AppButton
                  key={item}
                  selected={section === item}
                  variant={section === item ? "primary" : "secondary"}
                  onPress={() => setSection(item)}
                >
                  {item}
                </AppButton>
              ))}
            </XStack>

            {section === "Fundação" ? (
              <Group title="Cores e ritmo">
                <AppText color="$muted">
                  Neutros claros, verde profundo e cores semânticas. Tema atual:{" "}
                  {dark ? "escuro" : "claro"}.
                </AppText>
                <XStack flexWrap="wrap" gap="$sm">
                  {Object.entries(palette[dark ? "dark" : "light"]).map(
                    ([token, value]) => (
                      <YStack
                        key={token}
                        flexBasis={144}
                        flexGrow={1}
                        gap="$xs"
                      >
                        <YStack
                          height={48}
                          borderRadius="$control"
                          backgroundColor={value}
                          borderWidth={1}
                          borderColor="$border"
                        />
                        <AppText fontWeight="600">{token}</AppText>
                        <AppText color="$muted" fontSize="$2" lineHeight="$2">
                          {value}
                        </AppText>
                      </YStack>
                    ),
                  )}
                </XStack>
                <Surface>
                  <AppText fontSize="$8" lineHeight="$8" fontWeight="700">
                    Seu caminho, em boa companhia.
                  </AppText>
                  <AppText>
                    Texto de leitura · 16 / 24 · fonte do sistema
                  </AppText>
                  <AppText color="$muted" fontSize="$2" lineHeight="$2">
                    Texto auxiliar · 14 / 21
                  </AppText>
                </Surface>
                <Surface>
                  <AppText>Espaçamentos: 8, 12, 16, 24 e 32.</AppText>
                  <AppText>Raios: 12 nos controles e 20 nos cards.</AppText>
                  <AppText>Ícones: 20 e 24. Toque mínimo: 48 × 48.</AppText>
                </Surface>
              </Group>
            ) : null}

            {section === "Ações" ? (
              <Group title="Botões e cards">
                <AppButton onPress={() => setPresses(presses + 1)}>
                  Testar botão principal
                </AppButton>
                <AppText aria-live="polite">
                  Acionamentos: {presses}. Segure o botão para inspecionar o
                  estado pressionado.
                </AppText>
                <AppButton variant="secondary" onPress={() => setPresses(0)}>
                  Zerar contador
                </AppButton>
                <AppButton disabled>Indisponível · desabilitado</AppButton>
                <AppButton busy>Enviando demo</AppButton>
                <AppButton busy={busy} onPress={() => setBusy(true)}>
                  Simular envio
                </AppButton>
                {busy ? (
                  <AppButton variant="secondary" onPress={() => setBusy(false)}>
                    Concluir simulação
                  </AppButton>
                ) : null}
                <Notice title="Falha demonstrativa" tone="error">
                  Não foi possível completar a ação. Use o botão abaixo para
                  testar a tentativa local.
                </Notice>
                <AppButton
                  variant="danger"
                  onPress={() => setPresses(presses + 1)}
                >
                  Tentar ação novamente
                </AppButton>
                <Surface>
                  <AppText>Card padrão · conteúdo em superfície.</AppText>
                </Surface>
                <Surface tone="selected">
                  <AppText>Seleção sinalizada por borda e texto.</AppText>
                </Surface>
                <Surface tone="error">
                  <AppText>Erro sinalizado por borda e texto.</AppText>
                </Surface>
              </Group>
            ) : null}

            {section === "Campos" ? (
              <Group title="Entrada e escolhas">
                <Field
                  label="Nome de demonstração"
                  value={name}
                  onChangeText={setName}
                  placeholder="Como podemos chamar você?"
                  error={
                    validated && !name.trim()
                      ? "Informe um nome para continuar a demonstração."
                      : undefined
                  }
                  hint="Este valor fica apenas na memória do catálogo."
                  autoCapitalize="words"
                  onBlur={() => setValidated(true)}
                />
                <AppButton onPress={() => setValidated(true)}>
                  Validar campo demo
                </AppButton>
                {validated && name.trim() ? (
                  <Notice title="Campo preenchido" tone="success">
                    O nome atende a esta demonstração local.
                  </Notice>
                ) : null}
                <Field
                  label="Campo desabilitado"
                  value="Somente demonstração"
                  disabled
                />
                <CheckField
                  label="Preciso sair nesse horário"
                  checked={checked}
                  onChange={setChecked}
                />
                <TimeWindow
                  start={checked ? "18h15" : "18h00"}
                  end="18h30"
                  fixed={checked}
                />
                <CheckField
                  label="Opção desabilitada"
                  checked={false}
                  disabled
                  onChange={() => {}}
                />
              </Group>
            ) : null}

            {section === "Feedback" ? (
              <Group title="Estados e modal">
                <XStack flexWrap="wrap" gap="$xs">
                  <Badge>Demo</Badge>
                  <Badge tone="success">Preenchido</Badge>
                  <Badge tone="warning">Atenção</Badge>
                  <Badge tone="error">Falha</Badge>
                </XStack>
                <Notice title="Atenção ao horário" tone="warning">
                  A flexibilidade não prolonga o prazo da busca.
                </Notice>
                <Feedback
                  kind="empty"
                  title="Ainda sem sugestões"
                  description="Exemplo visual de busca vazia; nenhuma busca está ativa aqui."
                />
                <Feedback
                  kind="loading"
                  title="Carregando demonstração"
                  description="Exemplo de carregamento, sem requisição real."
                />
                {retried ? (
                  <Notice title="Tentativa local concluída" tone="success">
                    Nenhum serviço foi chamado.
                  </Notice>
                ) : (
                  <Feedback
                    kind="error"
                    title="Não foi possível carregar"
                    description="Falha fictícia para inspecionar a mensagem e a ação."
                    onRetry={() => setRetried(true)}
                  />
                )}
                <AppButton onPress={() => setModal(true)}>
                  Abrir modal de exemplo
                </AppButton>
              </Group>
            ) : null}

            {section === "Produto" ? (
              <Group title="Peças do trajeto">
                <Surface>
                  <RouteSummary
                    origin="Região do Centro"
                    destination="Região do campus"
                  />
                  <TimeWindow start="18h15" end="18h30" />
                  <AppText>
                    Dupla de contas; até três pessoas contando acompanhantes.
                    Rateio igual por pessoa, acertado por fora.
                  </AppText>
                </Surface>
                <CompanionCard
                  name={nextName}
                  onInspect={() => setSwap(true)}
                />
                <Notice title={`Solicitação demo: ${pending}`}>
                  Abrir e fechar o modal preserva a seleção. Confirmar troca
                  apenas este estado local e não confirma uma viagem.
                </Notice>
                {swapMessage ? (
                  <Notice title="Troca local concluída" tone="success" live>
                    {swapMessage}
                  </Notice>
                ) : null}
              </Group>
            ) : null}
            <AppText color="$muted" textAlign="center">
              Design system inicial · etapas 0 e 1
            </AppText>
          </YStack>
        </ScrollView>
      </KeyboardAvoidingView>
      <AppModal
        open={modal}
        onClose={() => setModal(false)}
        title="Modal de exemplo"
        description="Conteúdo rolável, sem animação e com ação explícita para fechar."
      >
        <AppText>
          Experimente fonte ampliada, navegação por teclado e o retorno do
          Android. O estado do catálogo será preservado.
        </AppText>
      </AppModal>
      <SwapConfirmation
        open={swap}
        currentName={pending}
        nextName={nextName}
        onClose={() => setSwap(false)}
        onConfirm={() => {
          setSwapMessage(
            `A solicitação demo com ${pending} foi substituída pela de ${nextName}. Nenhuma solicitação real foi enviada; a viagem não está confirmada.`,
          );
          setPending(nextName);
          setSwap(false);
        }}
      />
    </SafeAreaView>
  );
}
