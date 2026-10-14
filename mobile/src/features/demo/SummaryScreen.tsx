import { Redirect } from "expo-router";
import { isAgreed } from "./domain";
import { useDemo } from "./provider";

// O resumo virou parte da escolha em /proposta; a rota só protege links antigos.
export default function SummaryScreen() {
  const { state } = useDemo();
  return <Redirect href={isAgreed(state.proposal) ? "/viagem" : "/proposta"} />;
}
