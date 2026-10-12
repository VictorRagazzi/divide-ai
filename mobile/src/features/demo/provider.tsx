import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useState,
} from "react";
import { AppState } from "react-native";
import {
  type Command,
  type DemoState,
  initialState,
  transition,
} from "./domain";

const DemoContext = createContext<{
  state: DemoState;
  now: number;
  send: (command: Command) => void;
} | null>(null);

export function DemoProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState(initialState);
  const [now, setNow] = useState(Date.now);
  const send = (command: Command) => {
    const instant = Date.now();
    setNow(instant);
    setState((current) => transition(current, command, instant));
  };
  useEffect(() => {
    const tick = () => {
      const instant = Date.now();
      setNow(instant);
      setState((current) => transition(current, { type: "tick" }, instant));
    };
    const timer = setInterval(tick, 1000);
    const subscription = AppState.addEventListener("change", (status) => {
      if (status === "active") tick();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return (
    <DemoContext.Provider value={{ state, now, send }}>
      {children}
    </DemoContext.Provider>
  );
}

export function useDemo() {
  const context = useContext(DemoContext);
  if (!context) throw new Error("DemoProvider ausente");
  return context;
}
