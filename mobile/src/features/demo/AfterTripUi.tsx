import { XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppText, Surface } from "../../ui/components";
import { formatInstant } from "./domain";
import { Quiet, RouteLines } from "./JourneyUi";
import { Avatar, Chip } from "./Kit";
import { useDemo } from "./provider";

// Tudo que as telas do pós-viagem precisam: a negociação encerrada e a pessoa.
export function usePostTrip() {
  const { state, send } = useDemo();
  const post = state.postTrip;
  const companion = post
    ? state.candidates.find((c) => c.id === post.companion)
    : undefined;
  return {
    state,
    send,
    post,
    companion,
    proposal: state.proposal,
    intent: state.intent,
  };
}

// Resumo curto da viagem que acabou: quem, por onde e quando.
export function TripBrief() {
  const { post, companion, proposal, intent } = usePostTrip();
  if (!post || !companion || !proposal || !intent) return null;
  return (
    <Surface>
      <XStack gap={12} alignItems="center">
        <Avatar name={companion.name} size={44} />
        <YStack flex={1} minWidth={0}>
          <AppText fontSize={17} lineHeight={22} fontWeight="700">
            {companion.name}
          </AppText>
          <Quiet>
            ★ {companion.rating} · {companion.trips} viagens
            {services.config.demo ? " · perfil fictício" : ""}
          </Quiet>
        </YStack>
      </XStack>
      <RouteLines origin={proposal.pickup} destination={proposal.dropoff} />
      <XStack>
        <Chip
          icon="clock"
          label={formatInstant(proposal.departure, intent.timeZone)}
        />
      </XStack>
    </Surface>
  );
}
