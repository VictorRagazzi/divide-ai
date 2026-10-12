import { useEffect, useRef } from "react";
import { YStack } from "tamagui";
import { Attribution } from "./Attribution";
import { mapHtml } from "./html";
import { type MapProps, mapUpdate, readMessage } from "./model";

export default function RealMap(props: MapProps) {
  const frame = useRef<HTMLIFrameElement>(null);
  const current = useRef(props);
  current.current = props;
  const update = mapUpdate(props);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.source !== frame.current?.contentWindow) return;
      const value = readMessage(event.data);
      if (value?.type === "ready")
        frame.current?.contentWindow?.postMessage(
          mapUpdate(current.current),
          "*",
        );
      if (value?.type === "selection" && current.current.editable)
        current.current.onSelect?.(value.endpoint, value.point);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, []);
  useEffect(() => {
    // The iframe may finish before hydration in a static export. Send on mount
    // as well as after its ready/load event, so neither event can be missed.
    frame.current?.contentWindow?.postMessage(update, "*");
  }, [update]);
  return (
    <YStack flex={1} overflow="hidden">
      <iframe
        ref={frame}
        title="Mapa interativo · origem A e destino B"
        srcDoc={mapHtml}
        sandbox="allow-scripts allow-same-origin"
        onLoad={() =>
          frame.current?.contentWindow?.postMessage(
            mapUpdate(current.current),
            "*",
          )
        }
        style={{ width: "100%", flex: 1, border: 0, minHeight: 0 }}
      />
      <Attribution />
    </YStack>
  );
}
