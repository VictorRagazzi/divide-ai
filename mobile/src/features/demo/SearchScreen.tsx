import * as Location from "expo-location";
import { router } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { Keyboard, Pressable } from "react-native";
import { type TamaguiElement, Theme, XStack, YStack } from "tamagui";
import { services } from "../../services";
import { AppButton, AppModal, AppText, CheckField } from "../../ui/components";
import { type Place, pointLabel } from "../maps/geocoder";
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
import {
  demoCandidates,
  parseSearch,
  type SearchFields,
  stageHref,
  whenLabel,
} from "./domain";
import { LineIcon, Quiet } from "./JourneyUi";
import { Chip, DateTimeField, NumberField, RoundButton } from "./Kit";
import { useDemo } from "./provider";

const { geocoder } = services;
const pad = (value: number) => String(value).padStart(2, "0");
function localDate(date: Date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}
function localTime(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
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
      time: localTime(later),
    }));
  }, []);
  const [places, setPlaces] = useState(emptyPlaces);
  const placesRef = useRef(places);
  const [selected, setSelected] = useState<Endpoint>("destination");
  const [sheet, setSheet] = useState<"places" | "details" | null>(null);
  const [panelHeight, setPanelHeight] = useState(190);
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
            ? `Local atualizado.${hint()}`
            : `Ponto marcado no mapa.${hint()}`,
        );
      })
      .catch(() => {
        if (
          !controller.signal.aborted &&
          placesRef.current[endpoint].revision === revision
        )
          setMapNotice(`Ponto marcado. Nome da rua indisponível.${hint()}`);
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
      router.push(stageHref(state));
      return;
    }
    const trip = confirmedTrip(placesRef.current);
    if (!trip) {
      const endpoint = !placesRef.current.origin.place
        ? "origin"
        : "destination";
      setErrors({
        [endpoint]:
          placesRef.current.origin.place && placesRef.current.destination.place
            ? "Origem e destino devem ser diferentes."
            : "Escolha um endereço da lista ou um ponto no mapa.",
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
      setSheet("details");
      return;
    }
    cancelGps();
    searchAbort.current?.abort();
    reverseAbort.current.origin?.abort();
    reverseAbort.current.destination?.abort();
    Keyboard.dismiss();
    setSheet(null);
    // Com backend, os candidatos vêm do servidor junto da resposta do comando.
    send(
      {
        type: "start",
        intent: { ...result.intent, points: trip.points },
        candidates: services.config.demo ? demoCandidates(result.intent) : [],
      },
      () => router.push("/busca"),
    );
  };
  const values =
    active && state.intent
      ? { origin: state.intent.origin, destination: state.intent.destination }
      : { origin: places.origin.text, destination: places.destination.text };
  const timeZone =
    state.intent?.timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const planned = new Date(`${fields.date}T${fields.time}:00`).getTime();
  const shown =
    active && state.intent
      ? {
          departure: state.intent.departure,
          people: state.intent.passengers,
          walking: state.intent.walkingLimit,
          fixed: state.intent.fixed,
        }
      : {
          departure: Number.isNaN(planned) ? null : planned,
          people: fields.passengers === "2" ? 2 : 1,
          walking: Number(fields.walkingLimit),
          fixed: fields.fixed,
        };
  const timeChip = shown.departure
    ? `${whenLabel(shown.departure, timeZone, now)}${shown.fixed ? " · fixo" : ""}`
    : "Escolher horário";
  const peopleChip = `${shown.people} ${shown.people === 1 ? "pessoa" : "pessoas"}${shown.walking === 400 ? "" : ` · ${shown.walking} m`}`;
  const resume = state.matched
    ? "Companhia combinada · ver"
    : state.pending
      ? `Aguardando ${state.candidates.find((c) => c.id === state.pending)?.name ?? "resposta"} · ver`
      : "Busca ativa · ver";
  const chooseOnMap = () => {
    interaction.current += 1;
    searchAbort.current?.abort();
    Keyboard.dismiss();
    setSheet(null);
    setMapNotice(
      `Toque no mapa para escolher ${selected === "origin" ? "a partida" : "o destino"}.`,
    );
  };
  return (
    <DemoPage
      tab="buscar"
      flush
      scrollable={false}
      footer={
        <AppButton variant="ink" onPress={begin}>
          {active ? "Retomar viagem" : "Buscar companhia"}
        </AppButton>
      }
    >
      <YStack flex={1} backgroundColor="#E7EBE4">
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
          margin={12}
          padding={12}
          borderRadius={22}
          backgroundColor="$surface"
          gap={10}
          zIndex={1}
          onLayout={(event) => setPanelHeight(event.nativeEvent.layout.height)}
        >
          <PlaceFields
            values={values}
            selected={selected}
            disabled={active}
            onFocus={focus}
            onChange={edit}
            refs={mainInputRefs}
          />
          <XStack gap={8} flexWrap="wrap">
            {active ? (
              <Chip
                tone="success"
                icon="clock"
                label={resume}
                onPress={begin}
              />
            ) : null}
            <Chip
              icon="clock"
              label={timeChip}
              accessibilityLabel={`Horário: ${timeChip}${active ? "" : ". Alterar"}`}
              onPress={active ? undefined : () => setSheet("details")}
            />
            <Chip
              icon="person"
              label={peopleChip}
              accessibilityLabel={`Pessoas: ${peopleChip}${active ? "" : ". Alterar"}`}
              onPress={active ? undefined : () => setSheet("details")}
            />
          </XStack>
          {mapNotice ? (
            <AppText role="status" fontSize={12} lineHeight={17} color="$muted">
              {mapNotice}
            </AppText>
          ) : null}
        </YStack>
        {active ? null : (
          <YStack position="absolute" right={12} bottom={44} zIndex={1}>
            <RoundButton
              label={locating ? "Localizando…" : "Usar minha localização"}
              busy={locating}
              onPress={() => void locate()}
            >
              <LineIcon kind="locate" color="#121512" />
            </RoundButton>
          </YStack>
        )}
      </YStack>
      <Theme name="light">
        <AppModal
          open={Boolean(sheet)}
          title={sheet === "places" ? "Seu caminho" : "Quando e com quem"}
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
              {errors[selected] ? (
                <AppText fontSize={13} color="$errorText" role="alert">
                  {errors[selected]}
                </AppText>
              ) : null}
              <PlaceRow
                icon="locate"
                label={locating ? "Localizando…" : "Minha localização"}
                onPress={() => void locate()}
              />
              <PlaceRow
                icon="pin"
                label="Escolher no mapa"
                onPress={chooseOnMap}
              />
              {lookup.status === "loading" ? (
                <Quiet>Buscando endereços…</Quiet>
              ) : lookup.status === "error" ? (
                <>
                  <AppText fontSize={13} role="alert">
                    {lookup.error}
                  </AppText>
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
              ) : null}
              {lookup.results.map((place) => (
                <Pressable
                  key={place.id}
                  accessibilityRole="button"
                  accessibilityLabel={place.label}
                  onPress={() => choose(selected, place)}
                  style={{
                    minHeight: 56,
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: "#E0E4DA",
                  }}
                >
                  <AppText fontWeight="600">{place.title}</AppText>
                  {place.detail ? <Quiet>{place.detail}</Quiet> : null}
                </Pressable>
              ))}
              {lookup.results.length ? (
                <Quiet>Endereços por Photon / OpenStreetMap.</Quiet>
              ) : null}
            </>
          ) : (
            <>
              <DateTimeField
                date={fields.date}
                time={fields.time}
                now={now}
                error={errors.time ?? errors.date}
                onChange={(date, time) => {
                  setErrors({});
                  setFields((current) => ({ ...current, date, time }));
                }}
              />
              <CheckField
                label="Preciso sair nesse horário"
                checked={fields.fixed}
                onChange={(value) => change("fixed", value)}
              />
              <CheckField
                label="Vou com acompanhante"
                checked={fields.passengers === "2"}
                onChange={(value) => change("passengers", value ? "2" : "1")}
              />
              <NumberField
                label="Caminhada máxima (metros)"
                value={fields.walkingLimit}
                step={100}
                min={0}
                max={2000}
                error={errors.walkingLimit}
                onChange={(value) => {
                  setErrors({});
                  change("walkingLimit", value);
                }}
              />
              <AppButton
                onPress={() => {
                  const result = parseSearch(
                    { ...fields, origin: "Origem", destination: "Destino" },
                    Date.now(),
                  );
                  setErrors(result.errors);
                  if (result.intent) setSheet(null);
                }}
              >
                Concluir
              </AppButton>
            </>
          )}
        </AppModal>
      </Theme>
    </DemoPage>
  );
}

function PlaceRow({
  icon,
  label,
  onPress,
}: {
  icon: "locate" | "pin";
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 52,
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        opacity: pressed ? 0.6 : 1,
      })}
    >
      <LineIcon kind={icon} color="#121512" />
      <AppText fontWeight="600">{label}</AppText>
    </Pressable>
  );
}
