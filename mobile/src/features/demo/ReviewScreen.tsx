import { Redirect, router } from "expo-router";
import { useState } from "react";
import { YStack } from "tamagui";
import { AppButton, AppText, Field } from "../../ui/components";
import { usePostTrip } from "./AfterTripUi";
import { DemoPage } from "./DemoPage";
import { MAX_REVIEW_TEXT, reviewError, stageHref } from "./domain";
import { DemoAction, StarRating } from "./FormKit";
import { Quiet, TextAction } from "./JourneyUi";

export default function ReviewScreen() {
  const { state, send, post, companion } = usePostTrip();
  const [stars, setStars] = useState(0);
  const [comment, setComment] = useState("");
  const [tried, setTried] = useState(false);
  if (!post || !companion) return <Redirect href="/viagens" />;
  if (post.happened !== true || post.mine)
    return <Redirect href={stageHref(state)} />;
  const error = tried ? reviewError(stars, comment) : null;
  const submit = () => {
    setTried(true);
    if (reviewError(stars, comment)) return;
    send(
      {
        type: "rate",
        negotiation: post.negotiation,
        stars,
        comment,
      },
      () => router.replace("/avaliacao-enviada"),
    );
  };
  return (
    <DemoPage
      compact
      demoNote="badge"
      back="/viagens"
      title={`Como foi com ${companion.name}?`}
      footer={
        <>
          <AppButton onPress={submit}>Enviar avaliação</AppButton>
          <YStack flexDirection="row" justifyContent="space-between">
            <TextAction
              label="Denunciar ou bloquear"
              onPress={() => router.push("/seguranca")}
            />
            <TextAction
              label="Avaliar depois"
              onPress={() => router.replace("/viagens")}
            />
          </YStack>
        </>
      }
    >
      <YStack gap={4}>
        <StarRating
          label={`Nota para ${companion.name}`}
          value={stars}
          onChange={setStars}
        />
        {error && stars === 0 ? (
          <AppText
            fontSize={13}
            lineHeight={18}
            color="$errorText"
            role="alert"
          >
            {error}
          </AppText>
        ) : null}
      </YStack>
      <Field
        label="O que aconteceu?"
        placeholder="Conte como foi a experiência"
        multiline
        rows={4}
        numberOfLines={4}
        minHeight={110}
        textAlignVertical="top"
        maxLength={MAX_REVIEW_TEXT}
        value={comment}
        onChangeText={setComment}
        error={stars > 0 ? (error ?? undefined) : undefined}
        hint={`${stars > 0 && stars < 3 ? "Obrigatório para notas abaixo de 3." : "Opcional."} ${comment.length}/${MAX_REVIEW_TEXT}`}
      />
      <Quiet>
        {post.theirs
          ? `${companion.name} já avaliou você. Envie a sua para ver.`
          : `Você verá a avaliação de ${companion.name} depois de enviar a sua.`}
      </Quiet>
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
