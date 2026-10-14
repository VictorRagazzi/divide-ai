import { Redirect, router } from "expo-router";
import { useWindowDimensions } from "react-native";
import { XStack, YStack } from "tamagui";
import { AppButton, AppText } from "../../ui/components";
import RealMap from "../maps/RealMap";
import { DemoPage } from "./DemoPage";
import { clockTime, eligible, whenLabel } from "./domain";
import { RouteLines, TextAction } from "./JourneyUi";
import { Chip, PulseDot } from "./Kit";
import { PersonRow } from "./PersonCard";
import { useDemo } from "./provider";

export default function ActiveSearchScreen() {
  const { state, now, send } = useDemo();
  const { height } = useWindowDimensions();
  if (!state.intent) return <Redirect href="/" />;
  if (state.matched) return <Redirect href="/proposta" />;
  const intent = state.intent;
  const expired = now >= intent.departure;
  const pending = state.candidates.find((c) => c.id === state.pending);
  const incoming = state.candidates.find((c) => c.id === state.incoming);
  const nearby = state.candidates.filter(
    (c) =>
      c.id !== state.pending &&
      c.id !== state.incoming &&
      eligible(intent, c, now),
  );
  const count = nearby.length;
  const until = clockTime(intent.departure, intent.timeZone);
  // No servidor a busca continua ativa até ser cancelada; só então a tela volta.
  const reset = () =>
    send({ type: "cancel-search" }, () => router.replace("/"));
  return (
    <DemoPage
      demoNote="badge"
      footer={
        <>
          {expired ? (
            <AppButton onPress={() => router.push("/")}>
              Escolher outro horário
            </AppButton>
          ) : incoming ? (
            <>
              <AppButton
                onPress={() =>
                  send({
                    type: "request",
                    id: incoming.id,
                    expectedRevision: state.revision,
                  })
                }
              >
                {`Aceitar ${incoming.name}`}
              </AppButton>
              <AppButton
                variant="secondary"
                onPress={() => send({ type: "decline", id: incoming.id })}
              >
                Recusar
              </AppButton>
            </>
          ) : pending ? (
            <>
              <AppButton onPress={() => router.push("/espera")}>
                {`Ver solicitação de ${pending.name}`}
              </AppButton>
              {count ? (
                <AppButton
                  variant="secondary"
                  onPress={() => router.push("/sugestoes")}
                >
                  {`Ver ${count} ${count === 1 ? "pessoa" : "pessoas"}`}
                </AppButton>
              ) : null}
            </>
          ) : count ? (
            <AppButton onPress={() => router.push("/sugestoes")}>
              {`Ver ${count} ${count === 1 ? "pessoa" : "pessoas"}`}
            </AppButton>
          ) : (
            <AppButton onPress={reset}>Ajustar busca</AppButton>
          )}
          {expired || incoming ? null : (
            <TextAction danger label="Cancelar busca" onPress={reset} />
          )}
        </>
      }
    >
      <YStack gap={6}>
        <XStack gap={10} alignItems="center">
          {expired ? null : <PulseDot />}
          <AppText
            role="heading"
            fontSize={26}
            lineHeight={31}
            fontWeight="700"
            letterSpacing={-0.8}
          >
            {expired ? "Busca encerrada" : "Procurando companhia"}
          </AppText>
        </XStack>
        <AppText fontSize={14} lineHeight={20} color="$muted">
          {expired
            ? "Seu horário chegou. Escolha outro para uma nova busca."
            : `Busca aberta até ${until}`}
        </AppText>
      </YStack>
      {incoming && !expired ? (
        <PersonRow
          candidate={incoming}
          intent={intent}
          heading="Quer viajar com você"
        />
      ) : null}
      <YStack
        borderRadius={18}
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$surface"
        overflow="hidden"
      >
        {intent.points ? (
          <YStack height={incoming ? 120 : height < 700 ? 150 : 210}>
            <RealMap points={intent.points} />
          </YStack>
        ) : null}
        <YStack padding={14} gap={12}>
          <RouteLines origin={intent.origin} destination={intent.destination} />
          <XStack gap={8} flexWrap="wrap">
            <Chip
              icon="clock"
              label={whenLabel(intent.departure, intent.timeZone, now)}
            />
            <Chip
              icon="person"
              label={`${intent.passengers} ${intent.passengers === 1 ? "pessoa" : "pessoas"}`}
            />
          </XStack>
        </YStack>
      </YStack>
      {expired || incoming ? null : (
        <YStack
          gap={4}
          padding={14}
          borderRadius={14}
          backgroundColor="$success"
          aria-live="polite"
        >
          <AppText
            fontSize={16}
            lineHeight={22}
            fontWeight="700"
            color="$successText"
          >
            {count
              ? `${count} ${count === 1 ? "pessoa" : "pessoas"} no seu caminho`
              : "Ninguém no seu caminho ainda"}
          </AppText>
          {count ? null : (
            <AppText fontSize={13} lineHeight={19} color="$successText">
              Aumente a caminhada ou mude o horário para ver mais opções.
            </AppText>
          )}
        </YStack>
      )}
    </DemoPage>
  );
}
