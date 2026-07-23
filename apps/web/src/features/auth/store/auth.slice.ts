import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

import type { AuthCredentials, AuthState, AuthUser } from "../types/auth.types";

const initialState: AuthState = {
  user: null,
  accessToken: null,
  isAuthenticated: false,
  isInitializing: true,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setCredentials: (state, action: PayloadAction<AuthCredentials>) => {
      state.accessToken = action.payload.accessToken;
      if (action.payload.user !== undefined) {
        state.user = action.payload.user;
      }
      state.isAuthenticated = state.user !== null;
    },
    setUser: (state, action: PayloadAction<AuthUser>) => {
      state.user = action.payload;
      state.isAuthenticated = state.accessToken !== null;
    },
    clearAuth: (state) => {
      state.user = null;
      state.accessToken = null;
      state.isAuthenticated = false;
      state.isInitializing = false;
    },
    setInitializing: (state, action: PayloadAction<boolean>) => {
      state.isInitializing = action.payload;
    },
  },
});

type AuthRootState = {
  auth: AuthState;
};

export const { clearAuth, setCredentials, setInitializing, setUser } = authSlice.actions;

export const selectAuth = (state: AuthRootState): AuthState => state.auth;
export const selectCurrentUser = (state: AuthRootState): AuthUser | null => state.auth.user;
export const selectAccessToken = (state: AuthRootState): string | null =>
  state.auth.accessToken;
export const selectIsAuthenticated = (state: AuthRootState): boolean =>
  state.auth.isAuthenticated;
export const selectIsAuthInitializing = (state: AuthRootState): boolean =>
  state.auth.isInitializing;

export const authReducer = authSlice.reducer;
export default authReducer;
