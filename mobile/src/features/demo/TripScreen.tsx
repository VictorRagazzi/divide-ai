import { Redirect, router } from "expo-router";
import { YStack } from "tamagui";
import { AppButton, AppText, Surface } from "../../ui/components";
import { AgreementDetails, EndNegotiation } from "./AgreementUi";
import { DemoPage } from "./DemoPage";
import { Quiet, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

export default function TripScreen() {
  const { state } = useDemo();
  if (!state.matched || !state.proposal) return <Redirect href="/viagens" />;
  if (!state.proposal.mine || !state.proposal.theirs)
    return <Redirect href="/resumo" />;
  return (
    <DemoPage
      eyebrow="ACORDO CONFIRMADO"
      title="Viagem combinada"
      subtitle={`Vocês dois confirmaram a proposta ${state.proposal.version}.`}
      back="/viagens"
      footer={
        <>
          <AppButton onPress={() => router.push("/chat")}>Abrir chat</AppButton>
          <EndNegotiation />
        </>
      }
    >
      <YStack
        width={64}
        height={64}
        borderRadius={40}
        backgroundColor="$success"
        alignItems="center"
        justifyContent="center"
      >
        <AppText fontSize={32} lineHeight={40} color="$primary">
          ✓
        </AppText>
      </YStack>
      <AgreementDetails />
      <Surface>
        <AppText fontSize={15} fontWeight="700">
          O próximo passo é de vocês
        </AppText>
        <Quiet>
          Combinem no chat quem pede o carro no Uber/99 e como fazem o repasse.
          O acordo não significa que um carro foi solicitado.
        </Quiet>
      </Surface>
      <TextAction
        label="Alterar detalhes da viagem"
        onPress={() => router.push("/proposta")}
      />
      <Quiet>
        Uma alteração pede novas confirmações dos dois. O MVP combina apenas
        duas contas.
      </Quiet>
    </DemoPage>
  );
}
