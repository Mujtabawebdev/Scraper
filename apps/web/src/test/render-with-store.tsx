import { render, type RenderResult } from "@testing-library/react";
import type { ReactElement } from "react";
import { Provider } from "react-redux";

import { createAppStore } from "../app/store";

type TestAppStore = ReturnType<typeof createAppStore>;

type RenderWithStoreOptions = {
  store?: TestAppStore;
};

type RenderWithStoreResult = RenderResult & {
  store: TestAppStore;
};

export function renderWithStore(
  ui: ReactElement,
  options: RenderWithStoreOptions = {},
): RenderWithStoreResult {
  const store = options.store ?? createAppStore();
  const result = render(<Provider store={store}>{ui}</Provider>);

  return {
    ...result,
    store,
  };
}
