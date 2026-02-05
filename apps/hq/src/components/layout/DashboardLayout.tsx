import { Sidebar } from "./Sidebar";
// 🔒 PROTECTED FILE: DO NOT EDIT WITHOUT EXPLICIT USER APPROVAL
// Module: Core Layout
// Status: STABLE
import { Outlet } from "react-router-dom";

export default function DashboardLayout() {
    console.log("📐 [DashboardLayout] Rendering Layout");
    return (
        <div className="h-full relative flex">
            {/* Hidden on mobile, fixed on desktop */}
            <div className="hidden h-full md:flex md:w-72 md:flex-col md:fixed md:inset-y-0 z-[80] bg-transparent">
                <Sidebar />
            </div>

            <main className="md:pl-72 w-full min-h-screen bg-transparent">
                {/* Header will go here */}
                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
