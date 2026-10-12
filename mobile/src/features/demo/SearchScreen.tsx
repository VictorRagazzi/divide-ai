import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable } from "react-native";
import { type TamaguiElement, Theme, XStack, YStack } from "tamagui";
import {
  AppButton,
  AppModal,
  AppText,
  CheckField,
  Field,
} from "../../ui/components";
import { geocoder, type Place, pointLabel } from "../maps/geocoder";
import { type Endpoint, isPoint, type Point } from "../maps/model";
import { PlaceFields } from "../maps/PlaceFields";
import {
  changePlace,
  confirmedTrip,
  emptyPlaces,
  type PlaceCommand,
  selectedPoints,
} from "../maps/places";
import RealMap from "../maps/RealMap";
import { DemoPage } from "./DemoPage";
import { demoCandidates, parseSearch, type SearchFields } from "./domain";
import { Quiet, TextAction } from "./JourneyUi";
import { useDemo } from "./provider";

function localDate(date: Date) {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
export default function SearchScreen() {
  const { state, now, send } = useDemo();
  const active = Boolean(
    state.intent && (state.matched || state.intent.departure > now),
  );
  const [fields, setFields] = useState<SearchFields>({
    origin: "",
    destination: "",
    date: "",
    time: "",
    fixed: false,
    passengers: "1",
    walkingLimit: "400",
  });
  useEffect(() => {
    const later = new Date(Date.now() + 60 * 60_000);
    setFields((current) => ({
      ...current,
      date: localDate(later),
      time: `${String(later.getHours()).padStart(2, "0")}:${String(later.getMinutes()).padStart(2, "0")}`,
    }));
  }, []);
  const [places, setPlaces] = useState(emptyPlaces);
  const placesRef = useRef(places);
  const [selected, setSelected] = useState<Endpoint>("destination");
  const [sheet, setSheet] = useState<"places" | "time" | "people" | null>(null);
  const [panelHeight, setPanelHeight] = useState(260);
  const [compact, setCompact] = useState(false);
  const [mapNotice, setMapNotice] = useState("");
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<
    Partial<Record<keyof SearchFields, string>>
  >({});
  const [lookupResult, setLookup] = useState<{
    status: "idle" | "loading" | "done" | "error";
    results: Place[];
    error: string;
    scope: string;
  }>({ status: "idle", results: [], error: "", scope: "" });
  const [searchAttempt, setSearchAttempt] = useState(0);
  const searchAbort = useRef<AbortController | null>(null);
  const reverseAbort = useRef<Partial<Record<Endpoint, AbortController>>>({});
  const gpsRequest = useRef(0);
  const interaction = useRef(0);
  const mainOriginInput = useRef<TamaguiElement>(null);
  const mainDestinationInput = useRef<TamaguiElement>(null);
  const mainInputRefs = {
    origin: mainOriginInput,
    destination: mainDestinationInput,
  };
  const originInput = useRef<TamaguiElement>(null);
  const destinationInput = useRef<TamaguiElement>(null);
  const inputRefs = { origin: originInput, destination: destinationInput };
  const apply = (command: PlaceCommand) => {
    const next = changePlace(placesRef.current, command);
    placesRef.current = next;
    setPlaces(next);
    return next[command.endpoint].revision;
  };
  const cancelGps = () => {
    gpsRequest.current += 1;
    setLocating(false);
  };
  const cancelEndpoint = (endpoint: Endpoint) => {
    reverseAbort.current[endpoint]?.abort();
    if (endpoint === "origin") cancelGps();
  };
  useEffect(
    () => () => {
      gpsRequest.current += 1;
      searchAbort.current?.abort();
      reverseAbort.current.origin?.abort();
      reverseAbort.current.destination?.abort();
    },
    [],
  );
  const focus = (endpoint: Endpoint) => {
    if (active) return;
    // RN Web restores pre-modal focus. Blur the opener before that element is
    // captured, otherwise restoring focus would immediately reopen the picker.
    mainInputRefs[endpoint].current?.blur();
    interaction.current += 1;
    setSelected(endpoint);
    setSheet("places");
  };
  const edit = (endpoint: Endpoint, text: string) => {
    if (active) return;
    cancelEndpoint(endpoint);
    searchAbort.current?.abort();
    apply({ type: "edit", endpoint, text });
    setMapNotice("");
    setErrors({});
    focus(endpoint);
  };
  const field = places[selected];
  const scope = `${selected}:${field.revision}:${searchAttempt}`;
  const lookup =
    lookupResult.scope === scope
      ? lookupResult
      : { status: "idle", results: [], error: "" };
  useEffect(() => {
    searchAbort.current?.abort();
    const controller = new AbortController();
    searchAbort.current = controller;
    if (
      sheet !== "places" ||
      active ||
      field.place ||
      field.text.trim().length < 3
    ) {
      setLookup({ status: "idle", results: [], error: "", scope });
      return () => controller.abort();
    }
    const endpoint = selected;
    const revision = field.revision;
    setLookup({ status: "loading", results: [], error: "", scope });
    const timer = setTimeout(() => {
      geocoder
        .search(field.text, controller.signal)
        .then((results) => {
          if (
            !controller.signal.aborted &&
            placesRef.current[endpoint].revision === revision
          )
            setLookup({ status: "done", results, error: "", scope });
        })
        .catch((error) => {
          if (
            !controller.signal.aborted &&
            placesRef.current[endpoint].revision === revision
          )
            setLookup({
              status: "error",
              scope,
              results: [],
              error:
                error instanceof Error
                  ? error.message
                  : "Não foi possível buscar. Tente novamente.",
            });
        });
    }, 900);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [sheet, active, selected, field.place, field.text, field.revision, scope]);
  const choose = (endpoint: Endpoint, place: Place) => {
    if (active) return;
    interaction.current += 1;
    cancelEndpoint(endpoint);
    searchAbort.current?.abort();
    apply({ type: "select", endpoint, place });
    setErrors({});
    setMapNotice("");
    if (endpoint === "origin" && !placesRef.current.destination.place) {
      setSelected("destination");
      destinationInput.current?.focus();
    } else if (
      placesRef.current.origin.place &&
      placesRef.current.destination.place
    ) {
      Keyboard.dismiss();
      setSheet(null);
    }
  };
  const selectMap = (
    endpoint: Endpoint,
    point: Point,
    fallback = endpoint === "origin"
      ? "Partida escolhida no mapa"
      : "Destino escolhido no mapa",
    preserveContext = false,
    fromMap = false,
  ) => {
    if (active || !isPoint(point)) return;
    cancelEndpoint(endpoint);
    const revision = apply({
      type: "select",
      endpoint,
      place: { label: fallback, point },
    });
    // Only for map taps: after the departure, move straight to the missing
    // destination. GPS keeps whatever the user is editing.
    const awaitingDestination = () =>
      fromMap && endpoint === "origin" && !placesRef.current.destination.place;
    const hint = () =>
      awaitingDestination()
        ? " Agora toque no mapa para escolher o destino."
        : "";
    const advance = !preserveContext && awaitingDestination();
    if (!preserveContext) {
      interaction.current += 1;
      setSelected(advance ? "destination" : endpoint);
    }
    setErrors({});
    setMapNotice(`Identificando a rua ou bairro…${hint()}`);
    const controller = new AbortController();
    reverseAbort.current[endpoint] = controller;
    geocoder
      .reverse(point, controller.signal)
      .then((results) => {
        if (
          controller.signal.aborted ||
          placesRef.current[endpoint].revision !== revision
        )
          return;
        apply({
          type: "resolve",
          endpoint,
          revision,
          label: pointLabel(results[0], fallback),
        });
        setMapNotice(
          results.length
            ? `Local atualizado. Confira o ponto no mapa.${hint()}`
            : `Ponto escolhido. Você também pode procurar pelo nome da rua.${hint()}`,
        );
      })
      .catch(() => {
        if (
          !controller.signal.aborted &&
          placesRef.current[endpoint].revision === revision
        )
          setMapNotice(
            `Ponto escolhido no mapa. O nome da rua está indisponível; você pode buscar pelo endereço.${hint()}`,
          );
      });
  };
  const locate = async () => {
    if (active || locating) return;
    const id = ++gpsRequest.current;
    const context = interaction.current;
    const revision = placesRef.current.origin.revision;
    setLocating(true);
    setMapNotice("Aguardando sua localização…");
    let timeout: ReturnType<typeof setTimeout> | undefined;
    const current = () =>
      id === gpsRequest.current &&
      revision === placesRef.current.origin.revision;
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!current()) return;
      if (!permission.granted)
        throw new Error("Permissão negada. Digite sua rua ou escolha no mapa.");
      const position = await Promise.race([
        Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        }),
        new Promise<never>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(
                new Error(
                  "GPS demorou a responder. Digite sua rua ou escolha no mapa.",
                ),
              ),
            15000,
          );
        }),
      ]);
      if (!current()) return;
      if (!isPoint(position.coords))
        throw new Error(
          "Localização indisponível nessa área. Busque sua rua ou bairro.",
        );
      const preserveContext = interaction.current !== context;
      selectMap(
        "origin",
        {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        },
        "Minha localização atual",
        preserveContext,
      );
      if (!preserveContext) {
        Keyboard.dismiss();
        setSheet(null);
      }
    } catch (error) {
      if (current())
        setMapNotice(
          error instanceof Error
            ? error.message
            : "Localização indisponível. Digite sua rua.",
        );
    } finally {
      if (timeout) clearTimeout(timeout);
      if (id === gpsRequest.current) setLocating(false);
    }
  };
  const change = <K extends keyof SearchFields>(
    key: K,
    value: SearchFields[K],
  ) => setFields((current) => ({ ...current, [key]: value }));
  const begin = () => {
    if (active) {
      router.push(
        state.matched ? "/proposta" : state.pending ? "/espera" : "/busca",
      );
      return;
    }
    const trip = confirmedTrip(placesRef.current);
    if (!trip) {
      const endpoint = !placesRef.current.origin.place
        ? "origin"
        : "destination";
      setErrors({
        [endpoint]:
          "Escolha um endereço da lista ou um ponto no mapa. Origem e destino devem ser diferentes.",
      });
      focus(endpoint);
      return;
    }
    const result = parseSearch(
      { ...fields, origin: trip.origin, destination: trip.destination },
      Date.now(),
      trip.points,
    );
    setErrors(result.errors);
    if (!result.intent) {
      setSheet("time");
      return;
    }
    cancelGps();
    searchAbort.current?.abort();
    reverseAbort.current.origin?.abort();
    reverseAbort.current.destination?.abort();
    Keyboard.dismiss();
    setSheet(null);
    send({
      type: "start",
      intent: { ...result.intent, points: trip.points },
      candidates: demoCandidates(result.intent),
    });
    router.push("/busca");
  };
  const values =
    active && state.intent
      ? { origin: state.intent.origin, destination: state.intent.destination }
      : { origin: places.origin.text, destination: places.destination.text };
  const shown =
    active && state.intent
      ? {
          ...fields,
          passengers: String(state.intent.passengers),
          date: localDate(new Date(state.intent.departure)),
          time: new Intl.DateTimeFormat("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
            timeZone: state.intent.timeZone,
          }).format(state.intent.departure),
        }
      : fields;
  const chooseOnMap = () => {
    interaction.current += 1;
    searchAbort.current?.abort();
    Keyboard.dismiss();
    setSheet(null);
    setCompact(true);
    setMapNotice(
      `Toque no mapa para escolher ${selected === "origin" ? "a partida" : "o destino"}.`,
    );
  };
  return (
    <DemoPage
      tab="buscar"
      flush
      scrollable={false}
      header={<YStack height={8} />}
      footer={
        <AppButton variant="ink" onPress={begin}>
          {active ? "Retomar viagem" : "Buscar companhia"}
        </AppButton>
      }
    >
      <YStack
        flex={1}
        backgroundColor="#E7EBE4"
        onLayout={(event) => {
          if (event.nativeEvent.layout.height < 520) setCompact(true);
        }}
      >
        <YStack position="absolute" top={0} bottom={0} left={0} right={0}>
          <RealMap
            points={
              active && state.intent?.points
                ? state.intent.points
                : selectedPoints(places)
            }
            selected={selected}
            editable={!active && sheet === null}
            topInset={panelHeight + 16}
            onSelect={(endpoint, point) =>
              selectMap(endpoint, point, undefined, false, true)
            }
          />
        </YStack>
        <YStack
          margin={16}
          padding={16}
          borderRadius={22}
          backgroundColor="$surface"
          gap={10}
          zIndex={1}
          onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
        >
          <XStack alignItems="center" justifyContent="space-between">
            <AppText
              fontSize={24}
              lineHeight={29}
              fontWeight="800"
              letterSpacing={-1}
            >
              divide aí ↗
            </AppText>
            <TextAction
              label={compact ? "Opções ⌄" : "Mapa ⌃"}
              onPress={() => setCompact((value) => !value)}
            />
          </XStack>
          <PlaceFields
            values={values}
            selected={selected}
            disabled={active}
            onFocus={focus}
            onChange={edit}
            refs={mainInputRefs}
          />
          {!compact ? (
            <XStack gap={8}>
              <YStack flex={1} backgroundColor="$background" borderRadius={12}>
                <TextAction
                  icon="person"
                  label={`${shown.passengers} ${shown.passengers === "1" ? "pessoa" : "pessoas"}  ⌄`}
                  onPress={() => !active && setSheet("people")}
                />
              </YStack>
              <YStack
                flex={1.4}
                backgroundColor="$background"
                borderRadius={12}
              >
                <TextAction
                  icon="clock"
                  label={
                    shown.time
                      ? `${shown.date === localDate(new Date(now)) ? "Hoje" : shown.date.slice(5).split("-").reverse().join("/")} · ${shown.time}  ⌄`
                      : "Escolher horário"
                  }
                  onPress={() => !active && setSheet("time")}
                />
              </YStack>
            </XStack>
          ) : null}
          {!active && !compact ? (
            <TextAction
              label={locating ? "Localizando…" : "Usar minha localização atual"}
              onPress={() => void locate()}
            />
          ) : null}
          {mapNotice ? (
            <AppText role="status" fontSize={12}>
              {mapNotice}
            </AppText>
          ) : null}
        </YStack>
      </YStack>
      <Theme name="light">
        <AppModal
          open={Boolean(sheet)}
          title={
            sheet === "places"
              ? "Seu caminho"
              : sheet === "people"
                ? "Quem vai com você?"
                : "Quando você quer sair?"
          }
          description={
            sheet === "places"
              ? "Digite rua, número ou bairro. Inclua a cidade para encontrar o lugar certo."
              : "Escolha os dados da sua viagem de demonstração."
          }
          onClose={() => {
            interaction.current += 1;
            Keyboard.dismiss();
            setSheet(null);
          }}
        >
          {sheet === "places" ? (
            <>
              <PlaceFields
                values={values}
                selected={selected}
                onFocus={(endpoint) => {
                  interaction.current += 1;
                  setSelected(endpoint);
                }}
                onChange={edit}
                onSubmit={() => setSearchAttempt((value) => value + 1)}
                refs={inputRefs}
                autofocus
              />
              <XStack justifyContent="space-between" gap={12}>
                <TextAction
                  label={locating ? "Localizando…" : "Minha localização"}
                  onPress={() => void locate()}
                />
                <TextAction label="Escolher no mapa" onPress={chooseOnMap} />
              </XStack>
              {errors[selected] ? (
                <AppText color="$errorText" role="alert">
                  {errors[selected]}
                </AppText>
              ) : null}
              {lookup.status === "loading" ? (
                <Quiet>Buscando endereços…</Quiet>
              ) : lookup.status === "error" ? (
                <>
                  <AppText role="alert">{lookup.error}</AppText>
                  <AppButton
                    variant="secondary"
                    onPress={() => setSearchAttempt((value) => value + 1)}
                  >
                    Tentar novamente
                  </AppButton>
                </>
              ) : lookup.status === "done" && !lookup.results.length ? (
                <Quiet>
                  Nenhum local encontrado. Inclua a cidade ou escolha no mapa.
                </Quiet>
              ) : lookup.status === "idle" ? (
                <Quiet>
                  {field.place
                    ? "Local selecionado. Edite o outro campo ou ajuste no mapa."
                    : "Digite pelo menos 3 letras para buscar uma rua ou bairro."}
                </Quiet>
              ) : null}
              {lookup.results.map((place) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={place.label}
                  onPress={() => choose(selected, place)}
                  style={{
                    minHeight: 64,
                    paddingVertical: 12,
                    borderBottomWidth: 1,
                    borderBottomColor: "#E0E4DA",
                  }}
                >
                  <AppText fontWeight="600">{place.title}</AppText>
                  {place.detail ? <Quiet>{place.detail}</Quiet> : null}
                </Pressable>
              ))}
              <Quiet>Endereços por Photon / OpenStreetMap.</Quiet>
              <AppButton
                variant="ink"
                onPress={() => {
                  Keyboard.dismiss();
                  setSheet(null);
                }}
              >
                Conferir no mapa
              </AppButton>
            </>
          ) : sheet === "people" ? (
            <>
              <XStack gap={12}>
                {["1", "2"].map((count) => (
                  <YStack key={count} flex={1}>
                    <AppButton
                      selected={fields.passengers === count}
                      variant={
                        fields.passengers === count ? "primary" : "secondary"
                      }
                      onPress={() => change("passengers", count)}
                    >
                      {count === "1" ? "Só eu" : "Com acompanhante"}
                    </AppButton>
                  </YStack>
                ))}
              </XStack>
              <Quiet>
                Até 3 passageiros em duas contas. Com acompanhante, você
                responde por duas partes do valor.
              </Quiet>
            </>
          ) : (
            <>
              <Field
                label="Data"
                hint="AAAA-MM-DD"
                value={fields.date}
                error={errors.date}
                onChangeText={(v) => change("date", v)}
              />
              <Field
                label="Horário de saída"
                hint="HH:MM · horário local"
                value={fields.time}
                error={errors.time}
                onChangeText={(v) => change("time", v)}
                keyboardType="numbers-and-punctuation"
              />
              <CheckField
                label="Preciso sair nesse horário"
                checked={fields.fixed}
                onChange={(v) => change("fixed", v)}
              />
              <Quiet>
                {fields.fixed
                  ? "Horário fixo."
                  : "Você aceita sair até 15 minutos antes ou depois."}{" "}
                A busca encerra no horário original.
              </Quiet>
              <Field
                label="Limite de caminhada (metros)"
                hint="Separadamente no embarque e no desembarque."
                value={fields.walkingLimit}
                error={errors.walkingLimit}
                onChangeText={(v) => change("walkingLimit", v)}
                keyboardType="number-pad"
              />
            </>
          )}
          {sheet !== "places" ? (
            <AppButton
              onPress={() => {
                const result = parseSearch(
                  { ...fields, origin: "Origem", destination: "Destino" },
                  Date.now(),
                );
                setErrors(result.errors);
                if (result.intent) setSheet(null);
                else setSheet("time");
              }}
            >
              Salvar escolhas
            </AppButton>
          ) : null}
        </AppModal>
      </Theme>
    </DemoPage>
  );
}
