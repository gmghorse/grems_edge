import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import {BrowserRouter, Route, Routes} from "react-router";
import Home from "@/pages/home.tsx";
import Settings from "@/pages/settings.tsx";
import "@fontsource-variable/google-sans-flex"
import "@fontsource-variable/karla"
import Chargers from "@/pages/chargers.tsx";
import Sessions from "@/pages/sessions.tsx";
import Access from "@/pages/access.tsx";
import Events from "@/pages/events.tsx";

document.documentElement.classList.add("dark");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
        <BrowserRouter>
            <Routes>
                <Route element={<App/>}>
                    <Route index element={<Home/>}></Route>
                    <Route path={"chargers"} element={<Chargers/>}></Route>
                    <Route path={"sessions"} element={<Sessions/>}></Route>
                    <Route path={"access"} element={<Access/>}></Route>
                    <Route path={"events"} element={<Events/>}></Route>
                    <Route path={"settings"} element={<Settings/>}></Route>
                </Route>
            </Routes>
        </BrowserRouter>

    </React.StrictMode>,
);
