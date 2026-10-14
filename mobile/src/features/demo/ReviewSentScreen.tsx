import { Redirect, router } from "expo-router";
import { YStack } from "tamagui";
import { services } from "../../services";
import { AppButton, AppText, Surface } from "../../ui/components";
import { usePostTrip } from "./AfterTripUi";
import { DemoPage } from "./DemoPage";
import { receivedState, stageHref } from "./domain";
import { DemoAction, StarsText } from "./FormKit";
import { Quiet, TextAction } from "./JourneyUi";
import { StatusSteps } from "./Kit";

// Avaliação enviada. A recebida só aparece depois que a pessoa também avaliou.
export default function ReviewSentScreen() {
  const { state, send, post, companion } = usePostTrip();
  if (!post || !companion) return <Redirect href="/viagens" />;
  if (!post.mine || post.happened !== true)
    return <Redirect href={stageHref(state)} />;
  const received = receivedState(post);
  return (
    <DemoPage
      compact
      demoNote="badge"
      back="/viagens"
      title="Avaliação enviada"
      footer={
        <>
          <AppButton
            onPress={() => {
              send({ type: "close-trip", negotiation: post.negotiation }, () =>
                router.replace("/viagens"),
              );
            }}
          >
            Concluir
          </AppButton>
          <TextAction
            label="Denunciar ou bloquear"
            onPress={() => router.push("/seguranca")}
          />
        </>
      }
    >
      <StatusSteps
        steps={[
          { label: "Você avaliou", state: "done" },
          {
            label: `${companion.name} avalia`,
            state: post.theirs ? "done" : "current",
          },
          {
            label: "Avaliação liberada",
            state: post.theirs ? "done" : "todo",
          },
        ]}
      />
      <Surface>
        <AppText fontSize={14} fontWeight="700">
          Sua avaliação
        </AppText>
        <StarsText stars={post.mine.stars} />
        {post.mine.comment ? <Quiet>{post.mine.comment}</Quiet> : null}
      </Surface>
      <YStack aria-live="polite">
        <Surface>
          <AppText fontSize={14} fontWeight="700">
            Avaliação de {companion.name}
          </AppText>
          {received === "visible" && post.theirs ? (
            <>
              <StarsText stars={post.theirs.stars} />
              {services.config.demo ? (
                <Quiet>Avaliação simulada para a demonstração.</Quiet>
              ) : null}
            </>
          ) : (
            <Quiet>
              Ainda não chegou. Você vê aqui quando {companion.name} avaliar.
            </Quiet>
          )}
        </Surface>
      </YStack>
      {post.theirs ? null : (
        <DemoAction
          label={`Demo · simular avaliação de ${companion.name}`}
          onPress={() =>
            send({
              type: "simulate-their-review",
              negotiation: post.negotiation,
            })
          }
        />
      )}
    </DemoPage>
  );
}
