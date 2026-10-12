import { useEffect, useRef, useState } from "react";
import WebView from "react-native-webview";
import { YStack } from "tamagui";
import { AppText } from "../../ui/components";
import { Attribution } from "./Attribution";
import { mapHtml } from "./html";
import { type MapProps, mapUpdate, readMessage } from "./model";

const source = { html: mapHtml, baseUrl: "https://divideai.com/" };

export default function RealMap(props: MapProps) {
  const webview = useRef<WebView>(null);
  const [generation, setGeneration] = useState(0);
  const [failed, setFailed] = useState(false);
  const update = mapUpdate(props);
  useEffect(() => {
    if (generation > 0)
      webview.current?.injectJavaScript(
        `window.divideMapUpdate(${JSON.stringify(update)});true;`,
      );
  }, [update, generation]);
  return (
    <YStack flex={1} overflow="hidden">
      <WebView
        ref={webview}
        style={{ flex: 1, backgroundColor: "#E7EBE4" }}
        source={source}
        originWhitelist={["*"]}
        applicationNameForUserAgent="DivideAiDemo/0.1 (+https://divideai.com)"
        cacheEnabled
        javaScriptEnabled
        geolocationEnabled={false}
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={(request) =>
          request.url === "about:blank" ||
          request.url === "https://divideai.com/"
        }
        onError={() => setFailed(true)}
        onMessage={(event) => {
          const value = readMessage(event.nativeEvent.data);
          if (value?.type === "ready") {
            setFailed(false);
            setGeneration((value) => value + 1);
          }
          if (value?.type === "selection" && props.editable)
            props.onSelect?.(value.endpoint, value.point);
        }}
      />
      {failed ? (
        <AppText>
          Não foi possível abrir o mapa. Busque sua rua ou bairro em Seu
          caminho.
        </AppText>
      ) : null}
      <Attribution />
    </YStack>
  );
}
