import { Redirect } from "expo-router";
import { useState } from "react";
import { services } from "../../services";
import { ApiError } from "../../services/http";
import { AppButton, Field, Notice } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import {
  DEMO_OTP,
  emailError,
  OTP_LENGTH,
  otpError,
  otpFormatError,
  otpStatus,
} from "./domain";
import { Quiet, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

const failure = (reason: unknown) =>
  reason instanceof ApiError
    ? reason.message
    : "Não foi possível concluir. Tente novamente.";

// Entrada sem senha: e-mail → código de 6 números (válido por 10 min, reenvio
// após 60 s). Na demonstração nenhum e-mail é enviado: o código aparece na tela.
// Com Supabase configurado, o envio e a conferência do código são do servidor.
export default function SignInScreen() {
  const { state, now, send, refresh } = useDemo();
  const { auth, session } = services;
  const demoAuth = auth.kind === "demo";
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [sentAt, setSentAt] = useState<number | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  if (state.session)
    return <Redirect href={state.profile ? "/" : "/cadastro"} />;
  const status = sentAt === null ? null : otpStatus(sentAt, now);
  const sendCode = async () => {
    const problem = emailError(email);
    setError(problem);
    if (problem || busy) return;
    setBusy(true);
    try {
      await auth.requestCode(email.trim());
      setSentAt(Date.now());
      setCode("");
      setError(null);
    } catch (reason) {
      setError(failure(reason));
    } finally {
      setBusy(false);
    }
  };
  const enter = async () => {
    if (sentAt === null || busy) return;
    const problem = (demoAuth ? otpError : otpFormatError)(
      code,
      sentAt,
      Date.now(),
    );
    setError(problem);
    if (problem) return;
    setBusy(true);
    try {
      await session.signIn(email, code);
      // Carrega perfil e viagens antes de entrar: quem já tem cadastro vai
      // direto ao início (o Redirect do topo decide entre "/" e "/cadastro").
      await refresh("state");
      send({ type: "verify-email", email });
    } catch (reason) {
      setError(failure(reason));
    } finally {
      setBusy(false);
    }
  };
  if (sentAt === null || !status)
    return (
      <DemoPage
        compact
        noBack
        demoNote="badge"
        title="Entre no Divide aí"
        footer={
          <AppButton busy={busy} onPress={sendCode}>
            Enviar código
          </AppButton>
        }
      >
        <Field
          label="E-mail"
          placeholder="nome@exemplo.com"
          keyboardType="email-address"
          inputMode="email"
          autoCapitalize="none"
          autoComplete="email"
          autoCorrect={false}
          autoFocus
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setError(null);
          }}
          onSubmitEditing={sendCode}
          returnKeyType="send"
          error={error ?? undefined}
          hint="Sem senha: enviamos um código por e-mail."
        />
      </DemoPage>
    );
  return (
    <DemoPage
      compact
      demoNote="badge"
      onBack={() => {
        setSentAt(null);
        setError(null);
      }}
      title="Digite o código"
      footer={
        <>
          <AppButton busy={busy} onPress={enter}>
            Entrar
          </AppButton>
          <TextAction
            label={
              status.resendIn > 0
                ? `Reenviar código em ${status.resendIn} s`
                : "Reenviar código"
            }
            accessibilityLabel={
              status.resendIn > 0
                ? `Reenviar código disponível em ${status.resendIn} segundos`
                : "Reenviar código"
            }
            onPress={() => {
              if (status.resendIn > 0) return;
              setError(null);
              void sendCode();
            }}
          />
        </>
      }
    >
      <Quiet>{`Enviamos um código de ${OTP_LENGTH} números para ${email.trim()}. Ele vale por 10 minutos.`}</Quiet>
      <Field
        label="Código"
        placeholder="000000"
        keyboardType="number-pad"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={OTP_LENGTH}
        autoFocus
        value={code}
        onChangeText={(value) => {
          setCode(value.replace(/\D/g, ""));
          setError(null);
        }}
        onSubmitEditing={enter}
        error={error ?? undefined}
      />
      {demoAuth ? (
        <Notice title="Demonstração">
          {`Nenhum e-mail foi enviado. Use o código ${DEMO_OTP}.`}
        </Notice>
      ) : null}
    </DemoPage>
  );
}
