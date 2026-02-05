import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import KioskAuth from './pages/KioskAuth';
import AdminDashboard from './pages/AdminDashboard';
import EmployeeManager from './pages/EmployeeManager';
import ShiftHistory from './pages/ShiftHistory';
import Scheduler from './pages/Scheduler';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={<KioskAuth />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/employees" element={<EmployeeManager />} />
                <Route path="/history" element={<ShiftHistory />} />
                <Route path="/scheduler" element={<Scheduler />} />
                <Route path="/kiosk" element={<KioskAuth />} />
            </Routes>
        </BrowserRouter>
    );
}
