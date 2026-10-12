import { Redirect, router } from "expo-router";
import { YStack } from "tamagui";
import { AppButton, AppText, Surface } from "../../ui/components";
import RealMap from "../maps/RealMap";
import { DemoPage } from "./DemoPage";
import { formatInstant } from "./domain";
import { Quiet, RouteLines, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

export default function ActiveSearchScreen() {
  const { state, now, send } = useDemo();
  if (!state.intent) return <Redirect href="/" />;
  if (state.matched) return <Redirect href="/proposta" />;
  const intent = state.intent;
  const expired = now >= intent.departure;
  return (
    <DemoPage
      eyebrow="ENCONTRAR COMPANHIA"
      title={expired ? "Busca encerrada" : "Seu caminho.\nBoa companhia."}
      subtitle={
        expired
          ? "Seu horário escolhido chegou. Prepare uma nova busca."
          : "Encontrando pessoas que vão na mesma direção."
      }
      footer={
        <>
          {state.pending ? (
            <AppButton onPress={() => router.push("/espera")}>
              Ver solicitação aberta
            </AppButton>
          ) : null}
          <AppButton
            variant="secondary"
            onPress={() => router.push(expired ? "/" : "/sugestoes")}
          >
            {expired ? "Escolher outro horário" : "Ver sugestões"}
          </AppButton>
          <TextAction
            danger
            label="Cancelar busca"
            onPress={() => {
              send({ type: "reset" });
              router.replace("/");
            }}
          />
        </>
      }
    >
      <YStack
        borderRadius={18}
        borderWidth={1}
        borderColor="$border"
        backgroundColor="$surface"
        overflow="hidden"
      >
        {intent.points ? (
          <YStack height={200}>
            <RealMap points={intent.points} />
          </YStack>
        ) : null}
        <YStack padding={14}>
          <RouteLines origin={intent.origin} destination={intent.destination} />
        </YStack>
      </YStack>
      <YStack gap={12}>
        <AppText fontSize={14} fontWeight="600">
          ◷ {formatInstant(intent.departure, intent.timeZone)}
        </AppText>
        <YStack height={1} backgroundColor="$border" />
        <AppText fontSize={14}>
          ♙ {intent.passengers} {intent.passengers === 1 ? "pessoa" : "pessoas"}{" "}
          · divisão igual por passageiro
        </AppText>
      </YStack>
      <Quiet>
        {intent.fixed
          ? "Horário fixo"
          : "Flexibilidade de 15 minutos para cada lado"}
        . Caminhada de até {intent.walkingLimit} m em cada extremo.
      </Quiet>
      <Surface>
        <AppText fontSize={13} color="$primary" fontWeight="600">
          ● {expired ? "Busca encerrada" : "Buscando combinações"}
        </AppText>
        <Quiet>
          Busca válida até {formatInstant(intent.departure, intent.timeZone)}.
          Na demo, as sugestões e caminhadas são simuladas; os pontos do mapa
          não calculam compatibilidade geográfica real.
        </Quiet>
      </Surface>
    </DemoPage>
  );
}
