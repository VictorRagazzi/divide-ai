import { YStack } from "tamagui";
import { AppButton, AppModal, AppText, Badge, Surface } from "./components";

export function RouteSummary({
  origin,
  destination,
}: {
  origin: string;
  destination: string;
}) {
  return (
    <YStack gap="$xs">
      <AppText color="$muted">TRAJETO DEMONSTRATIVO</AppText>
      <AppText fontWeight="600">Origem · {origin}</AppText>
      <AppText fontWeight="600">Destino · {destination}</AppText>
    </YStack>
  );
}

export function TimeWindow({
  start,
  end,
  fixed = false,
}: {
  start: string;
  end: string;
  fixed?: boolean;
}) {
  return (
    <YStack gap="$xs">
      <AppText fontWeight="600">
        {fixed
          ? `Horário fixo · ${start}`
          : `Intervalo compatível · ${start}–${end}`}
      </AppText>
      {fixed ? <Badge tone="warning">Precisa sair nesse horário</Badge> : null}
    </YStack>
  );
}

export function Walking({
  pickup,
  dropoff,
  limit,
}: {
  pickup: number;
  dropoff: number;
  limit: number;
}) {
  return (
    <YStack gap="$xs">
      <AppText>{pickup} m a pé da sua origem até o embarque</AppText>
      <AppText>{dropoff} m a pé do desembarque até seu destino</AppText>
      <AppText color="$muted">
        Limite de {limit} m aplicado separadamente em cada extremo. Distâncias
        fictícias.
      </AppText>
    </YStack>
  );
}

export function CompanionCard({
  name,
  onInspect,
}: {
  name: string;
  onInspect: () => void;
}) {
  return (
    <Surface>
      <Badge>Demonstração · perfil fictício</Badge>
      <AppText fontSize="$7" lineHeight="$7" fontWeight="700">
        {name}
      </AppText>
      <AppText color="$muted">
        4,8 / 5 · 12 viagens fictícias · 1 passageiro
      </AppText>
      <TimeWindow start="18h15" end="18h30" />
      <Walking pickup={300} dropoff={200} limit={400} />
      <AppText>
        Divisão igual por pessoa. Foto e endereços exatos ocultos antes do
        aceite mútuo.
      </AppText>
      <AppButton variant="secondary" onPress={onInspect}>
        Inspecionar troca demo
      </AppButton>
    </Surface>
  );
}

export function IncomingConfirmation({
  open,
  incomingName,
  nextName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  incomingName: string;
  nextName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Já tem alguém querendo viajar com você"
      description={`${incomingName} pediu para viajar com você. Para aceitar ${nextName}, a solicitação de ${incomingName} será recusada. A viagem ainda não estará confirmada; ${nextName} também precisa aceitar.`}
    >
      <AppButton
        onPress={onConfirm}
      >{`Recusar ${incomingName} e aceitar ${nextName}`}</AppButton>
      <AppButton
        variant="secondary"
        onPress={onClose}
      >{`Voltar e ver ${incomingName}`}</AppButton>
    </AppModal>
  );
}

export function SwapConfirmation({
  open,
  currentName,
  nextName,
  onClose,
  onConfirm,
}: {
  open: boolean;
  currentName: string;
  nextName: string;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Trocar de companhia?"
      description={`Você está aguardando ${currentName}. Para aceitar ${nextName}, sua solicitação anterior será cancelada. A viagem ainda não estará confirmada; ${nextName} também precisa aceitar.`}
    >
      <Badge tone="warning">Simulação local · nenhum envio real</Badge>
      <AppButton
        onPress={onConfirm}
      >{`Cancelar com ${currentName} e aceitar ${nextName}`}</AppButton>
      <AppButton
        variant="secondary"
        onPress={onClose}
      >{`Manter solicitação com ${currentName}`}</AppButton>
    </AppModal>
  );
}
