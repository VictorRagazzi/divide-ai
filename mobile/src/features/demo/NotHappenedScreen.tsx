import { Redirect, router } from "expo-router";
import { useState } from "react";
import { AppButton, AppText } from "../../ui/components";
import { TripBrief, usePostTrip } from "./AfterTripUi";
import { DemoPage } from "./DemoPage";
import {
  type NotHappenedReason,
  notHappenedReasons,
  stageHref,
} from "./domain";
import { ChoiceList } from "./FormKit";
import { Quiet, TextAction } from "./JourneyUi";

// Viagem não realizada: pergunta o motivo e registra; não há avaliação.
export default function NotHappenedScreen() {
  const { state, send, post, companion } = usePostTrip();
  const [reason, setReason] = useState<NotHappenedReason | null>(null);
  if (!post || !companion) return <Redirect href="/viagens" />;
  if (post.happened === true) return <Redirect href={stageHref(state)} />;
  if (post.happened === false) {
    const label = notHappenedReasons.find((r) => r.id === post.reason)?.label;
    return (
      <DemoPage
        compact
        demoNote="badge"
        back="/viagens"
        title="Viagem não realizada"
        footer={
          <>
            <AppButton
              onPress={() => {
                send(
                  { type: "close-trip", negotiation: post.negotiation },
                  () => router.replace("/viagens"),
                );
              }}
            >
              Concluir
            </AppButton>
            {post.reason === "no-show" ? (
              <AppButton
                variant="secondary"
                onPress={() => router.push("/seguranca")}
              >
                {`Denunciar ${companion.name}`}
              </AppButton>
            ) : null}
          </>
        }
      >
        <TripBrief />
        <AppText fontSize={14} lineHeight={20} fontWeight="600">
          Motivo: {label ?? "registrado"}
        </AppText>
        <Quiet>
          Registrado. Esta viagem não conta como viagem feita e não há nada para
          avaliar.
        </Quiet>
      </DemoPage>
    );
  }
  return (
    <DemoPage
      compact
      demoNote="badge"
      back="/lembrete"
      title="O que aconteceu?"
      footer={
        <>
          <AppButton
            disabled={!reason}
            onPress={() => {
              if (!reason) return;
              send({
                type: "trip-happened",
                negotiation: post.negotiation,
                happened: false,
                reason,
              });
            }}
          >
            Registrar
          </AppButton>
          <TextAction
            label="Voltar"
            onPress={() => router.replace("/lembrete")}
          />
        </>
      }
    >
      <Quiet>
        Vamos registrar que a viagem com {companion.name} não aconteceu.
      </Quiet>
      <ChoiceList
        label="Motivo"
        options={notHappenedReasons}
        value={reason}
        onChange={setReason}
      />
    </DemoPage>
  );
}
