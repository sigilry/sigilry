import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CantonReactProvider } from "@sigilry/react";

import { DemoLayout } from "./components/layout";
import { App } from "./App";
import "./styles.css";

const queryClient = new QueryClient();

const rootElement = document.getElementById("root");
if (!rootElement) {
  throw new Error("Root element not found");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <CantonReactProvider>
        <DemoLayout>
          <App />
        </DemoLayout>
      </CantonReactProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
