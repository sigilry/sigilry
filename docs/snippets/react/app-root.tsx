declare function App(): React.ReactNode;
// ---cut---
import { CantonReactProvider } from "@sigilry/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const queryClient = new QueryClient();

export function AppRoot() {
  return (
    <QueryClientProvider client={queryClient}>
      <CantonReactProvider>
        <App />
      </CantonReactProvider>
    </QueryClientProvider>
  );
}
