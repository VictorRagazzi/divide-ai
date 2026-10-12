import { router } from "expo-router";
import { YStack } from "tamagui";
import { AppButton, AppText, Surface } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import { Quiet } from "./JourneyUi";
import { useDemo } from "./provider";

export default function ProfileScreen() {
  const { send } = useDemo();
  return (
    <DemoPage
      tab="perfil"
      title="Seu perfil"
      eyebrow="DEMONSTRAÇÃO"
      subtitle="Explore o fluxo usando um perfil fictício."
      footer={
        <AppButton variant="secondary" onPress={() => router.push("/catalogo")}>
          Catálogo de componentes
        </AppButton>
      }
    >
      <Surface>
        <YStack
          width={64}
          height={64}
          borderRadius={40}
          backgroundColor="$success"
          alignItems="center"
          justifyContent="center"
        >
          <AppText fontSize={24} fontWeight="700">
            V
          </AppText>
        </YStack>
        <AppText fontWeight="700">Você · perfil de demonstração</AppText>
        <Quiet>
          Sem cadastro, envio de e-mail ou autenticação real. Foto e endereços
          da companhia ficam ocultos antes do aceite mútuo.
        </Quiet>
      </Surface>
      <Quiet>
        O Divide aí organiza o encontro. A corrida e o repasse são combinados
        por fora.
      </Quiet>
      <AppButton
        variant="secondary"
        onPress={() => {
          send({ type: "reset" });
          router.replace("/");
        }}
      >
        Reiniciar demonstração
      </AppButton>
    </DemoPage>
  );
}
