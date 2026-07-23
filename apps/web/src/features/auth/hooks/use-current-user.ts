import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";

import { useAppDispatch, useAppSelector } from "../../../app/store";
import { clearAuth, setUser } from "../store/auth.slice";
import { getCurrentUser } from "../api/auth.api";
import { authQueryKeys } from "../api/auth-query-keys";

export const useCurrentUser = () => {
  const dispatch = useAppDispatch();
  const accessToken = useAppSelector((state) => state.auth.accessToken);
  const query = useQuery({
    queryKey: authQueryKeys.currentUser(),
    queryFn: getCurrentUser,
    enabled: accessToken !== null,
  });

  useEffect(() => {
    if (query.data) {
      dispatch(setUser(query.data));
    }
  }, [dispatch, query.data]);

  useEffect(() => {
    if (query.isError) {
      dispatch(clearAuth());
    }
  }, [dispatch, query.isError]);

  return query;
};
