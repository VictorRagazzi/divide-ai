import { Redirect, router } from "expo-router";
import { useState } from "react";
import { XStack, YStack } from "tamagui";
import { AppButton, AppText, Field } from "../../ui/components";
import { DemoPage } from "./DemoPage";
import { parseProfile } from "./domain";
import { BirthField } from "./FormKit";
import { Quiet } from "./JourneyUi";
import { Avatar, Chip } from "./Kit";
import { useDemo } from "./provider";

// Cadastro depois do código: nome, nascimento, telefone e foto (opcionais).
// Idade mínima, necessidade do telefone e CPF seguem como decisões pendentes.
export default function SignUpScreen() {
  const { state, send } = useDemo();
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [birth, setBirth] = useState({ day: "", month: "", year: "" });
  const [photo, setPhoto] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<"name" | "phone" | "birth", string>>
  >({});
  if (!state.session) return <Redirect href="/entrar" />;
  if (state.profile) return <Redirect href="/" />;
  const submit = () => {
    const result = parseProfile(
      { name, phone, ...birth, email: state.session ?? "", photo },
      Date.now(),
    );
    setErrors(result.errors);
    if (!result.profile) return;
    send({ type: "save-profile", profile: result.profile }, () =>
      router.replace("/"),
    );
  };
  return (
    <DemoPage
      compact
      demoNote="badge"
      back="/entrar"
      title="Crie seu perfil"
      footer={<AppButton onPress={submit}>Criar perfil</AppButton>}
    >
      <Field
        label="Nome"
        placeholder="Como você quer ser chamado?"
        autoComplete="given-name"
        autoFocus
        maxLength={60}
        value={name}
        onChangeText={(value) => {
          setName(value);
          setErrors((current) => ({ ...current, name: undefined }));
        }}
        error={errors.name}
      />
      <BirthField
        {...birth}
        error={errors.birth}
        onChange={(parts) => {
          setBirth(parts);
          setErrors((current) => ({ ...current, birth: undefined }));
        }}
      />
      <Field
        label="Telefone (opcional)"
        placeholder="(DDD) número"
        keyboardType="phone-pad"
        inputMode="tel"
        autoComplete="tel"
        maxLength={16}
        value={phone}
        onChangeText={(value) => {
          setPhone(value);
          setErrors((current) => ({ ...current, phone: undefined }));
        }}
        error={errors.phone}
      />
      <YStack gap={8}>
        <AppText fontWeight="600">Foto (opcional)</AppText>
        <XStack gap={12} alignItems="center">
          <Avatar name={name.trim() || "?"} size={48} />
          <Chip
            icon="person"
            label={photo ? "Remover foto (demo)" : "Adicionar foto (demo)"}
            onPress={() => setPhoto(!photo)}
          />
        </XStack>
      </YStack>
      <Quiet>
        Seu e-mail, telefone e data de nascimento não aparecem para outras
        pessoas. Sua foto não aparece antes do aceite mútuo.
      </Quiet>
    </DemoPage>
  );
}
