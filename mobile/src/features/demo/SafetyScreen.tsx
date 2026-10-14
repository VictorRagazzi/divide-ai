import { Redirect, router } from "expo-router";
import { useRef, useState } from "react";
import { XStack, YStack } from "tamagui";
import { services } from "../../services";
import {
  AppButton,
  AppModal,
  AppText,
  Field,
  Surface,
} from "../../ui/components";
import { DemoPage } from "./DemoPage";
import {
  MAX_REPORT_TEXT,
  type ReportReason,
  reportError,
  reportReasons,
} from "./domain";
import { ChoiceList } from "./FormKit";
import { Quiet, TextAction } from "./JourneyUi";
import { Avatar, Chip } from "./Kit";
import { useDemo } from "./provider";

type Target = { id: string; name: string };

// Denunciar e bloquear são ações independentes: nenhuma exige avaliar, e uma
// não dispara a outra. Funciona durante a negociação e depois da viagem.
export default function SafetyScreen() {
  const { state, send } = useDemo();
  // A pessoa fica guardada: bloquear a tira da negociação, mas a tela continua.
  const target = useRef<Target | null>(null);
  if (!target.current) {
    const id = state.postTrip?.companion ?? state.matched;
    const person = state.candidates.find((c) => c.id === id);
    if (person) target.current = { id: person.id, name: person.name };
  }
  const [form, setForm] = useState<"report" | "block" | null>(null);
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState("");
  const [tried, setTried] = useState(false);
  const [reported, setReported] = useState(false);
  if (!target.current) return <Redirect href="/viagens" />;
  const { id, name } = target.current;
  const blocked = state.blocked.includes(id);
  const negotiating = state.matched === id && !state.postTrip;
  const error = tried ? reportError(reason, details) : null;
  const goBack = () => {
    if (!state.matched && !state.postTrip) router.replace("/viagens");
    else if (router.canGoBack()) router.back();
    else router.replace("/viagens");
  };
  const close = () => {
    setForm(null);
    setTried(false);
  };
  return (
    <DemoPage
      compact
      demoNote="badge"
      onBack={goBack}
      title="Denunciar ou bloquear"
      footer={<TextAction label="Voltar" onPress={goBack} />}
    >
      <XStack gap={12} alignItems="center">
        <Avatar name={name} size={44} />
        <AppText fontSize={17} lineHeight={22} fontWeight="700">
          {name}
        </AppText>
      </XStack>
      <Quiet>
        Você pode fazer isso sem avaliar. São ações separadas: bloquear não
        envia denúncia, e denunciar não bloqueia.
      </Quiet>
      <Surface>
        <AppText fontSize={15} fontWeight="700">
          Denunciar
        </AppText>
        <Quiet>
          Conte o que aconteceu para que a ocorrência seja registrada.
        </Quiet>
        {reported ? (
          <XStack>
            <Chip
              tone="success"
              label={`Denúncia registrada${services.config.demo ? " (demo)" : ""}`}
            />
          </XStack>
        ) : (
          <AppButton variant="secondary" onPress={() => setForm("report")}>
            {`Denunciar ${name}`}
          </AppButton>
        )}
      </Surface>
      <Surface>
        <AppText fontSize={15} fontWeight="700">
          Bloquear
        </AppText>
        <Quiet>{`${name} não aparece mais nas suas sugestões.`}</Quiet>
        {blocked ? (
          <XStack gap={8} alignItems="center" flexWrap="wrap">
            <Chip tone="success" label={`${name} bloqueado`} />
            <TextAction
              label="Desbloquear"
              onPress={() => send({ type: "unblock", companion: id })}
            />
          </XStack>
        ) : (
          <AppButton variant="secondary" onPress={() => setForm("block")}>
            {`Bloquear ${name}`}
          </AppButton>
        )}
      </Surface>
      {services.config.demo ? (
        <Quiet>
          Demonstração: denúncias e bloqueios ficam só neste aparelho. Nenhuma
          equipe recebe o relato.
        </Quiet>
      ) : null}
      <AppModal
        open={form === "report"}
        title={`Denunciar ${name}`}
        onClose={close}
      >
        <ChoiceList
          label="Motivo da denúncia"
          options={reportReasons}
          value={reason}
          onChange={setReason}
        />
        <Field
          label="Descreva o que aconteceu"
          multiline
          rows={4}
          numberOfLines={4}
          minHeight={100}
          textAlignVertical="top"
          maxLength={MAX_REPORT_TEXT}
          value={details}
          onChangeText={setDetails}
          error={error && reason ? error : undefined}
          hint={`${reason === "other" ? "Obrigatório." : "Opcional."} ${details.length}/${MAX_REPORT_TEXT}`}
        />
        {error && !reason ? (
          <AppText
            fontSize={13}
            lineHeight={18}
            color="$errorText"
            role="alert"
          >
            {error}
          </AppText>
        ) : null}
        <AppButton
          onPress={() => {
            setTried(true);
            if (reportError(reason, details) || !reason) return;
            send({ type: "report", companion: id, reason, details }, () => {
              setReported(true);
              setReason(null);
              setDetails("");
              close();
            });
          }}
        >
          Enviar denúncia
        </AppButton>
      </AppModal>
      <AppModal
        open={form === "block"}
        title={`Bloquear ${name}?`}
        description={
          negotiating
            ? `Sua participação na viagem com ${name} será encerrada e vocês não se verão mais nas buscas.`
            : `${name} não aparecerá mais nas suas sugestões. Bloquear não envia denúncia.`
        }
        onClose={close}
      >
        <YStack gap={8}>
          <AppButton
            variant="danger"
            onPress={() => {
              send({ type: "block", companion: id }, close);
            }}
          >
            {`Bloquear ${name}`}
          </AppButton>
          <AppButton onPress={close}>Manter sem bloquear</AppButton>
        </YStack>
      </AppModal>
    </DemoPage>
  );
}
