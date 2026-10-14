import { router } from "expo-router";
import { XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppButton, AppText, Surface } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import { ownRating } from "./domain";
import { Quiet, TextAction } from "./JourneyUi";
import { Avatar } from "./Kit";
import { useDemo } from "./provider";

export default function ProfileScreen() {
  const { state, send } = useDemo();
  const profile = state.profile;
  const rating = ownRating(state.history);
  const trips = state.history.filter((trip) => trip.happened).length;
  const nameOf = (id: string) =>
    state.candidates.find((c) => c.id === id)?.name ??
    state.history.find((trip) => trip.companion === id)?.name ??
    id.charAt(0).toUpperCase() + id.slice(1);
  return (
    <DemoPage
      tab="perfil"
      compact
      demoNote="badge"
      title="Seu perfil"
      footer={
        // Atalho de desenvolvimento: fora da versão exportada.
        __DEV__ ? (
          <AppButton
            variant="secondary"
            onPress={() => router.push("/catalogo")}
          >
            Catálogo de componentes
          </AppButton>
        ) : undefined
      }
    >
      <Surface>
        <XStack gap={14} alignItems="center">
          <Avatar name={profile?.name ?? "?"} size={64} />
          <YStack flex={1} minWidth={0} gap={2}>
            <AppText fontSize={20} lineHeight={26} fontWeight="700">
              {profile?.name ?? "Você"}
            </AppText>
            <AppText fontSize={14} lineHeight={20} fontWeight="600">
              {rating
                ? `★ ${rating.average.toFixed(1).replace(".", ",")} · ${rating.count} ${rating.count === 1 ? "avaliação" : "avaliações"}`
                : "Sem avaliações ainda"}
            </AppText>
            <Quiet>
              {trips} {trips === 1 ? "viagem realizada" : "viagens realizadas"}
            </Quiet>
          </YStack>
        </XStack>
        {profile ? <Quiet>{profile.email} · só você vê este dado</Quiet> : null}
      </Surface>
      {state.blocked.length ? (
        <Surface>
          <AppText fontSize={14} fontWeight="700">
            Pessoas bloqueadas
          </AppText>
          {state.blocked.map((id) => (
            <XStack key={id} alignItems="center" justifyContent="space-between">
              <AppText fontSize={14}>{nameOf(id)}</AppText>
              <TextAction
                label="Desbloquear"
                accessibilityLabel={`Desbloquear ${nameOf(id)}`}
                onPress={() => send({ type: "unblock", companion: id })}
              />
            </XStack>
          ))}
        </Surface>
      ) : null}
      <Quiet>
        O Divide aí organiza o encontro. A corrida e o repasse são combinados
        por fora.
      </Quiet>
      {services.config.demo ? (
        <AppButton
          variant="secondary"
          onPress={() => {
            send({ type: "reset" });
            router.replace("/");
          }}
        >
          Reiniciar demonstração
        </AppButton>
      ) : null}
      <TextAction
        danger
        label="Sair"
        onPress={() => {
          send({ type: "sign-out" });
          router.replace("/entrar");
        }}
      />
    </DemoPage>
  );
}
