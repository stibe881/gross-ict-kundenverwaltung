import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

/**
 * A global hook that provides a pull-to-refresh mechanism.
 * Calling `onRefresh` invalidates all cached react-query queries,
 * forcing the app to fetch the latest data from the backend seamlessly.
 */
export function useGlobalRefresh() {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // Invalidate everything so that active screen components refetch
    await queryClient.invalidateQueries();
    // A small delay makes the UI feedback feel more natural if requests are very fast
    setTimeout(() => {
        setRefreshing(false);
    }, 500);
  }, [queryClient]);

  return { refreshing, onRefresh };
}
