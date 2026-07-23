import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";

import {
  authReducer,
  clearAuth,
  setCredentials,
} from "../features/auth/store/auth.slice";
import { authQueryKeys } from "../features/auth/api/auth-query-keys";
import { connectApiClientToAuth } from "../services/api-client";
import { queryClient } from "./query-client";

export const createAppStore = () =>
  configureStore({
    reducer: {
      auth: authReducer,
    },
  });

export const store = createAppStore();

connectApiClientToAuth({
  getAccessToken: () => store.getState().auth.accessToken,
  setAccessToken: (accessToken) => {
    store.dispatch(setCredentials({ accessToken }));
  },
  clearAuthentication: () => {
    store.dispatch(clearAuth());
    void queryClient.cancelQueries({ queryKey: authQueryKeys.all });
    queryClient.removeQueries({ queryKey: authQueryKeys.all });
  },
});

export type AppStore = typeof store;
export type RootState = ReturnType<AppStore["getState"]>;
export type AppDispatch = AppStore["dispatch"];

export const useAppDispatch = useDispatch.withTypes<AppDispatch>();
export const useAppSelector = useSelector.withTypes<RootState>();
