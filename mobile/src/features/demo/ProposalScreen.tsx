import { Redirect, router } from "expo-router";
import { useState } from "react";
import { Pressable } from "react-native";
import { Theme, XStack, YStack } from "tamagui";
import { AppButton, AppModal, AppText, Surface } from "../../ui/components";
import {
  AgreementDetails,
  AgreementHeader,
  EndNegotiation,
} from "./AgreementUi";
import { DemoPage } from "./DemoPage";
import {
  isAgreed,
  makeProposal,
  type ProposalChoice,
  type ProposalPick,
  samePick,
  stageHref,
  stopOptions,
  validProposal,
} from "./domain";
import { DemoAction } from "./FormKit";
import { Quiet } from "./JourneyUi";
import { Chip } from "./Kit";
import { useDemo } from "./provider";

function Tag({ label }: { label: string }) {
  return (
    <YStack
      paddingHorizontal={7}
      paddingVertical={1}
      borderRadius={8}
      backgroundColor="$primary"
    >
      <AppText
        fontSize={10}
        lineHeight={15}
        fontWeight="700"
        color="$onPrimary"
      >
        {label}
      </AppText>
    </YStack>
  );
}

// Opção de trajeto em grade 2x2: título, legenda curta e quem já escolheu.
function ChoiceTile({
  title,
  caption,
  tags,
  disabled,
  onPress,
}: {
  title: string;
  caption: string;
  tags: string[];
  disabled: boolean;
  onPress: () => void;
}) {
  const chosen = tags.length > 0;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={
        chosen ? `${caption}. Escolhida por ${tags.join(" e ")}` : caption
      }
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <YStack
        flex={1}
        minHeight={88}
        padding={12}
        gap={2}
        borderRadius={14}
        borderWidth={chosen ? 2 : 1}
        borderColor={chosen ? "$primary" : "$controlBorder"}
        backgroundColor={chosen ? "$success" : "$surface"}
      >
        <AppText fontSize={13} lineHeight={18} fontWeight="700">
          {title}
        </AppText>
        <AppText fontSize={11} lineHeight={15} color="$muted">
          {caption}
        </AppText>
        {chosen ? (
          <XStack gap={4} marginTop={4} flexWrap="wrap">
            {tags.map((tag) => (
              <Tag key={tag} label={tag} />
            ))}
          </XStack>
        ) : null}
      </YStack>
    </Pressable>
  );
}

export default function ProposalScreen() {
  const { state, send } = useDemo();
  const [open, setOpen] = useState<ProposalChoice | null>(null);
  const [stop, setStop] = useState(0);
  if (state.postTrip) return <Redirect href={stageHref(state)} />;
  if (!state.matched || !state.proposal || !state.intent)
    return <Redirect href={state.pending ? "/espera" : "/"} />;
  const proposal = state.proposal;
  const intent = state.intent;
  const companion = state.candidates.find((c) => c.id === state.matched);
  if (!companion) return <Redirect href="/" />;
  const name = companion.name;
  const agreed = isAgreed(proposal);
  const { mine, theirs } = proposal.picks;
  const stops = stopOptions(intent);
  const options: { choice: ProposalChoice; title: string; caption: string }[] =
    [
      {
        choice: "suggestion",
        title: "Sugestão do app",
        caption: "Ponto de encontro em comum",
      },
      {
        choice: "mine",
        title: "Meu trajeto",
        caption: `${name} vem até você`,
      },
      {
        choice: "theirs",
        title: `Trajeto de ${name}`,
        caption: "Você vai até a companhia",
      },
      {
        choice: "stop",
        title: "Adicionar parada",
        caption: "Embarque antes do destino",
      },
    ];
  const pickOf = (choice: ProposalChoice, stopIndex = stop): ProposalPick =>
    choice === "stop" ? { choice, stop: stops[stopIndex] } : { choice };
  const contentOf = (pick: ProposalPick) =>
    makeProposal(
      intent,
      companion,
      pick.choice,
      proposal.negotiation,
      proposal.version + 1,
      pick.stop,
    );
  const available = (choice: ProposalChoice) =>
    validProposal(contentOf(pickOf(choice, 0)), intent, companion);
  const labelOf = (pick: ProposalPick | null) =>
    pick
      ? (options.find((o) => o.choice === pick.choice)?.title ?? "")
      : "ainda não escolheu";
  const pick = (who: "mine" | "theirs", value: ProposalPick) =>
    send({
      type: "pick",
      who,
      choice: value.choice,
      stop: value.stop,
      negotiation: proposal.negotiation,
      expectedVersion: proposal.version,
    });
  const demoSame = () => pick("theirs", mine ?? pickOf("suggestion", 0));
  const demoOther = () => {
    const order: ProposalChoice[] = ["theirs", "mine", "suggestion", "stop"];
    const choice = order.find(
      (c) => c !== mine?.choice && c !== theirs?.choice && available(c),
    );
    if (choice) pick("theirs", pickOf(choice, 0));
  };
  const openOption = (choice: ProposalChoice) => {
    const current = mine?.choice === choice ? mine.stop : undefined;
    setStop(Math.max(0, stops.indexOf(current ?? stops[0])));
    setOpen(choice);
  };
  const tagsOf = (choice: ProposalChoice) =>
    [
      mine?.choice === choice ? "Você" : null,
      theirs?.choice === choice ? name : null,
    ].filter((tag): tag is string => tag !== null);
  const preview = open ? contentOf(pickOf(open)) : null;
  const same = open !== null && samePick(mine, pickOf(open));
  const undoesAgreement = agreed && open !== null && !same;
  const diverges = Boolean(mine && theirs && !agreed);
  const tile = (option: (typeof options)[number]) => (
    <ChoiceTile
      key={option.choice}
      title={option.title}
      caption={
        available(option.choice) ? option.caption : "Longe demais para caminhar"
      }
      tags={tagsOf(option.choice)}
      disabled={!available(option.choice)}
      onPress={() => openOption(option.choice)}
    />
  );
  return (
    <DemoPage
      header={<AgreementHeader active="proposta" />}
      footer={
        <>
          {agreed ? (
            <AppButton onPress={() => router.push("/viagem")}>
              Ver viagem combinada
            </AppButton>
          ) : null}
          <EndNegotiation />
        </>
      }
    >
      <Surface>
        <AppText fontSize={14} fontWeight="700" aria-live="polite">
          {agreed
            ? "✓ Vocês escolheram a mesma opção"
            : diverges
              ? "Escolhas diferentes"
              : theirs
                ? `${name} já escolheu`
                : "Escolham a mesma opção"}
        </AppText>
        <XStack gap={10}>
          {[
            ["Você", mine],
            [name, theirs],
          ].map(([who, value]) => (
            <YStack
              key={who as string}
              flex={1}
              padding={10}
              borderRadius={12}
              backgroundColor={value ? "$success" : "$background"}
            >
              <AppText fontSize={11} lineHeight={15} color="$muted">
                {who as string}
              </AppText>
              <AppText fontSize={13} lineHeight={18} fontWeight="700">
                {labelOf(value as ProposalPick | null)}
              </AppText>
            </YStack>
          ))}
        </XStack>
        {diverges && theirs ? (
          <XStack gap={8}>
            <YStack flex={1}>
              <Chip
                fullWidth
                label="Escolher a mesma"
                accessibilityLabel={`Escolher a mesma de ${name}`}
                onPress={() => openOption(theirs.choice)}
              />
            </YStack>
            <YStack flex={1}>
              <Chip
                fullWidth
                label="Abrir o chat"
                onPress={() => router.push("/chat")}
              />
            </YStack>
          </XStack>
        ) : null}
      </Surface>
      <YStack gap={8}>
        <AppText fontSize={14} fontWeight="700">
          Toque numa opção para ver e escolher
        </AppText>
        <XStack gap={10}>{options.slice(0, 2).map(tile)}</XStack>
        <XStack gap={10}>{options.slice(2).map(tile)}</XStack>
      </YStack>
      <XStack gap={8}>
        <YStack flex={1}>
          <DemoAction
            label={`Demo: ${name} escolhe a mesma`}
            onPress={demoSame}
          />
        </YStack>
        <YStack flex={1}>
          <DemoAction
            label={`Demo: ${name} prefere outra`}
            onPress={demoOther}
          />
        </YStack>
      </XStack>
      <Theme name="light">
        <AppModal
          open={open !== null}
          title={options.find((o) => o.choice === open)?.title ?? ""}
          onClose={() => setOpen(null)}
        >
          {preview ? <AgreementDetails preview={preview} /> : null}
          {open === "stop" ? (
            <YStack gap={8}>
              <AppText fontSize={14} fontWeight="700">
                Onde fica a parada?
              </AppText>
              {stops.map((label, index) => (
                <AppButton
                  key={label}
                  variant={stop === index ? "primary" : "secondary"}
                  selected={stop === index}
                  onPress={() => setStop(index)}
                >
                  {label}
                </AppButton>
              ))}
              <Quiet>Só vale se {name} escolher a mesma parada.</Quiet>
            </YStack>
          ) : null}
          {undoesAgreement ? (
            <Quiet>
              Isso desfaz a viagem combinada. {name} precisará escolher de novo.
            </Quiet>
          ) : null}
          <AppButton
            disabled={same}
            onPress={() => {
              if (!open) return;
              pick("mine", pickOf(open));
              setOpen(null);
            }}
          >
            {same ? "Você já escolheu esta" : "Escolher esta opção"}
          </AppButton>
        </AppModal>
      </Theme>
    </DemoPage>
  );
}
