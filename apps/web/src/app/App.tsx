import { Suspense } from "react";
import { RouterProvider } from "react-router-dom";
import { Toaster } from "sonner";

import { PageLoader } from "../components/feedback/page-loader";
import { router } from "./router";

export function App() {
  return (
    <>
      <Suspense fallback={<PageLoader message="Loading application..." />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster closeButton position="top-right" richColors />
    </>
  );
}
