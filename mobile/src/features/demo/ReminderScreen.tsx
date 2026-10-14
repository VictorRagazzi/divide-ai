import { Redirect, router } from "expo-router";
import { AppButton } from "../../ui/components";
import { TripBrief, usePostTrip } from "./AfterTripUi";
import { DemoPage } from "./DemoPage";
import { stageHref } from "./domain";
import { Quiet, TextAction } from "./JourneyUi";

// Lembrete depois da viagem: primeiro pergunta se aconteceu, só então avalia.
export default function ReminderScreen() {
  const { state, send, post, companion } = usePostTrip();
  if (!post || !companion) return <Redirect href="/viagens" />;
  if (post.happened !== null) return <Redirect href={stageHref(state)} />;
  return (
    <DemoPage
      compact
      demoNote="badge"
      back="/viagens"
      title={`A viagem com ${companion.name} aconteceu?`}
      footer={
        <>
          <AppButton
            onPress={() => {
              send(
                {
                  type: "trip-happened",
                  negotiation: post.negotiation,
                  happened: true,
                },
                () => router.replace("/avaliar"),
              );
            }}
          >
            Sim, aconteceu
          </AppButton>
          <AppButton
            variant="secondary"
            onPress={() => router.push("/nao-realizada")}
          >
            Não aconteceu
          </AppButton>
          <TextAction
            label="Responder depois"
            onPress={() => router.replace("/viagens")}
          />
        </>
      }
    >
      <TripBrief />
      <Quiet>
        Responda antes de avaliar. O Divide aí não acompanha a corrida: vale o
        que você conta.
      </Quiet>
    </DemoPage>
  );
}
