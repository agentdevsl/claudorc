import { createRoot } from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { router } from "./router";
import "./styles/globals.css";

const mount = document.getElementById("root");

if (mount) {
  createRoot(mount).render(<RouterProvider router={router} />);
}
