import {NavLink, Outlet, useLocation} from "react-router";
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarProvider,
    SidebarTrigger,
    useSidebar,
} from "./components/ui/sidebar.tsx";
import {
    ActivityIcon,
    ChargingStationIcon,
    ClockCounterClockwiseIcon,
    GearIcon,
    HouseIcon,
    KeyIcon,
} from "@phosphor-icons/react";
import "./App.css";
import {AnimatePresence, motion} from "framer-motion";

const navItems = [
    {title: "Home", to: "/", icon: HouseIcon},
    {title: "Chargers", to: "/chargers", icon: ChargingStationIcon},
    {title: "Sessions", to: "/sessions", icon: ClockCounterClockwiseIcon},
    {title: "Access", to: "/access", icon: KeyIcon},
    {title: "Events", to: "/events", icon: ActivityIcon},
    {title: "Settings", to: "/settings", icon: GearIcon},
];

function App() {


    return (
        <SidebarProvider>
            <AppLayout></AppLayout>
        </SidebarProvider>
    );
}

function AppLayout() {
    const {pathname} = useLocation();
    const isActive = (to: string) =>
        to === "/" ? pathname === "/" : pathname.startsWith(to);
    const {state} = useSidebar();
    return (
        <><Sidebar variant={"floating"} collapsible={"icon"} className={""}>
            <div className={"flex h-full flex-col"}>
                <SidebarHeader>
                    <AnimatePresence mode={"wait"} initial={false}>
                        {state !== "collapsed" && (<motion.h2
                            key="sidebar-header"
                            initial={{opacity: 0, height: 0, x: -10}}
                            animate={{opacity: 1, height: "auto", x: 0}}
                            exit={{opacity: 0, height: 0, x: -10}}
                            transition={{duration: 0.2, ease: "easeInOut"}}
                            className="overflow-hidden whitespace-nowrap px-2 py-2 text-md font-semibold font-display"
                        >
                            Grems EV Edge
                        </motion.h2>)}
                    </AnimatePresence>

                </SidebarHeader>

                <SidebarContent className={"flex-1"}>
                    <SidebarMenu className="p-2">
                        {navItems.map((item) => (
                            <SidebarMenuItem key={item.to} className={"mb-2"}>
                                <SidebarMenuButton
                                    isActive={isActive(item.to)}
                                    render={<NavLink to={item.to}/>}
                                    className={isActive(item.to) ? "text-primary!" : ""}
                                >
                                    <item.icon
                                        weight="bold"
                                        size={32}
                                        color={isActive(item.to) ? "#32cd32" : "currentColor"}
                                    />

                                    <span>{item.title}</span>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
                        ))}
                    </SidebarMenu>
                </SidebarContent>

                <SidebarFooter className={"mt-auto"}>
                    <AnimatePresence mode="wait" initial={false}>
                        {state !== "collapsed" ? (
                            <motion.div
                                key="footer-expanded"
                                initial={{opacity: 0, x: -10}}
                                animate={{opacity: 1, x: 0}}
                                exit={{opacity: 0, x: -10}}
                                transition={{duration: 0.2}}
                                className="overflow-hidden whitespace-nowrap p-2 text-muted-foreground text-xs"
                            >
                                Grems EV Edge v1.0
                            </motion.div>
                        ) : (
                            <motion.div
                                key="footer-collapsed"
                                initial={{opacity: 0}}
                                animate={{opacity: 1}}
                                exit={{opacity: 0}}
                                transition={{duration: 0.15}}
                                className="p-2 text-xs text-muted-foreground"
                            >
                                v1.0
                            </motion.div>
                        )}
                    </AnimatePresence>
                </SidebarFooter>
            </div>
        </Sidebar>


            <main className="flex-1 p-4">
                <SidebarTrigger/>
                <Outlet/>
            </main>
        </>
    )
}

export default App;